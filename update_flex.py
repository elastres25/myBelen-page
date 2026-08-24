"""Build flex/schedule.json for the FLEX 7-1 homeroom page.

Reads two Blackbaud iCal feeds:
  FLEX_ICAL_URL    the teacher's own class schedule (has "FLEX 7 - 1" blocks
                   and the A/B rotation day markers)
  SCHOOL_ICAL_URL  the school-wide events feed (Masses, assemblies, activities)

Writes a date-keyed schedule of every FLEX 7-1 meeting for the semester, with
the Masses / Reconciliation Services / activities that fall on those days
attached to them.
"""

import os, json, re, html
from datetime import datetime, date, timezone
from zoneinfo import ZoneInfo
from pathlib import Path
import requests
from icalendar import Calendar

OUT = Path("flex/schedule.json")
TZ = ZoneInfo("America/New_York")  # CI runners are UTC; school times are Miami time

# The fall semester runs from the first full day of class through the last day
# before Christmas break. Exams start 12/15, so the last FLEX is 12/11.
SEMESTER = {"name": "Fall 2026", "start": date(2026, 8, 20), "end": date(2026, 12, 18)}

SECTION = "FLEX 7 - 1"
GRADE = 7
MY_SECTION = 1

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/151.0.0.0 Safari/537.36",
    "Accept": "text/calendar,text/plain;q=0.9,*/*;q=0.8",
    "Referer": "https://belenjesuit.myschoolapp.com/",
}

# Events that belong on this page but are missing from the school feed.
# Source: 2026-27 Mass and Reconciliation Service Schedule (Fr. Joseph Hill, SJ)
# https://docs.google.com/document/d/1sfpm4QOxaXpH0O10nW6d2fGdCLz-kJpVfelfaYSFraA
MANUAL_EVENTS = [
    {
        "date": "2026-11-18",
        "kind": "reconciliation",
        "title": "Reconciliation Service",
        "audience": "7-1 through 7-4",
        "time": "1:15 PM",
        "location": "Our Lady of Belen Chapel",
        "dress": "",
        "source": "mass-schedule-doc",
    },
]


# --------------------------------------------------------------------------
# relevance: does this school-wide event apply to a 7-1 student?
# --------------------------------------------------------------------------

# "Reconciliation Service for 7-5 & 7-8" -> sections 5 through 8 of grade 7
SECTION_RANGE = re.compile(r"\b(\d)[-:](\d)\s*(?:&|and|through|-|–)\s*\1?[-:]?(\d)\b")

# audiences that include a 7th grader
INCLUDES_ME = re.compile(
    r"(6th,?\s*7th,?\s*&?\s*8th"
    r"|7th\s*(?:,|and|&)\s*8th"
    r"|\b7th\b"
    r"|\ball\s*ms\b"
    r"|\bmiddle\s*school\b"
    r"|\bms\b"
    r"|school[\s-]*wide)",
    re.I,
)

# audiences that clearly exclude a 7th grader (checked only when INCLUDES_ME misses)
OTHER_GRADES_ONLY = re.compile(
    r"^(?!.*(?:7th|all\s*ms|middle\s*school|school[\s-]*wide))"
    r".*\b(6th|8th|9th|10th|11th|12th|senior|junior|sophomore|freshman)\b",
    re.I,
)

ATHLETIC_NAME = re.compile(
    r"^(Football|Basketball|Baseball|Soccer|Bowling|Cross Country|Golf|Swimming"
    r"|Tennis|Track|Volleyball|Water Polo|Wrestling|Crew|Lacrosse|Sailing|Rugby|Flag)",
    re.I,
)
ATHLETIC_WORD = re.compile(
    r"\b(Varsity|JV|Junior Varsity|Game|Practice|Tryout|Scrimmage|Meet)\b", re.I
)


# events held in the FLEX block itself, regardless of how the title reads
FLEX_CONTEXT = re.compile(r"\bflex\b", re.I)

# a title that names its audience at all
NAMES_A_GRADE = re.compile(
    r"\b(6th|7th|8th|9th|10th|11th|12th|senior|junior|sophomore|freshman"
    r"|all\s*ms|\bms\b|middle\s*school|high\s*school|school[\s-]*wide)\b",
    re.I,
)


def applies_to_me(title, description="", location=""):
    """True when a school-wide event's audience includes a 7-1 student."""
    if ATHLETIC_NAME.match(title) or ATHLETIC_WORD.search(title):
        return False

    # "Reconciliation Service for 7-5 & 7-8" -> only sections 5..8
    m = SECTION_RANGE.search(title)
    if m:
        grade, lo, hi = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return grade == GRADE and lo <= MY_SECTION <= hi

    if INCLUDES_ME.search(title):
        return True

    # named for other grades only -> not ours
    if NAMES_A_GRADE.search(title):
        return False

    # no audience in the title. Anything scheduled into the FLEX block is ours...
    if FLEX_CONTEXT.search(title) or FLEX_CONTEXT.search(location):
        return True

    # ...as is a Mass that names no grade, which means school-wide. Some of those
    # carry the audience in the body instead (e.g. the Immaculate Conception Mass).
    if classify(title) in ("mass", "reconciliation"):
        if NAMES_A_GRADE.search(description):
            return bool(INCLUDES_ME.search(description))
        return True

    return False


def classify(title):
    t = title.lower()
    if "reconciliation" in t:
        return "reconciliation"
    if "mass" in t:
        return "mass"
    if "assembly" in t or "rehearsal" in t:
        return "assembly"
    return "activity"


def audience_of(title):
    """Pull the grade audience out of a title, for display."""
    m = re.search(r"for\s+(.+?)(?:\s*-\s*SPECIAL|$)", title, re.I)
    if m:
        return re.sub(r"^all\s+", "", m.group(1).strip(), flags=re.I)
    return ""


def strip_audience(title):
    """'Our Lady of Charity Mass for 6th, 7th & 8th Grade' -> 'Our Lady of Charity Mass'"""
    out = re.split(r"\s+for\s+", title, maxsplit=1, flags=re.I)[0]
    out = re.sub(r"\s*-\s*SPECIAL DRESS UNIFORM\s*$", "", out, flags=re.I)
    return out.strip()


TIME_TOKEN = re.compile(r"\b(\d{1,2}:\d{2}\s*[ap]\.?m\.?)", re.I)


def time_for_me(description):
    """Some all-day Mass entries list a start time per grade in the body:
    '6th, 7th & 8th Grade 8:00 am  9th & 10th Grade 11:00 am ...'"""
    m = INCLUDES_ME.search(description)
    if not m:
        return "", ""
    tail = description[m.end():m.end() + 60]
    t = TIME_TOKEN.search(tail)
    if not t:
        return "", ""
    return t.group(1).upper().replace(".", ""), m.group(0).strip()


def dress_of(title, description):
    if re.search(r"special\s*dress", f"{title} {description}", re.I):
        return "Special Dress Uniform"
    return ""


# --------------------------------------------------------------------------
# feed reading
# --------------------------------------------------------------------------

def fetch(url):
    url = url.replace("webcal://", "https://", 1)
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return Calendar.from_ical(resp.content)


def clean(value):
    """Blackbaud puts HTML entities in its iCal bodies (&amp;, &#160;)."""
    if value is None:
        return ""
    text = html.unescape(str(value).replace("\\n", " "))
    return re.sub(r"\s+", " ", text.replace("\xa0", " ")).strip()


def normalize(cal):
    """iCal -> [{date, start_dt, all_day, summary, description, location}]"""
    items = []
    for ev in cal.walk("VEVENT"):
        dtstart = ev.get("DTSTART")
        if not dtstart:
            continue
        dt = dtstart.dt
        all_day = not isinstance(dt, datetime)
        day = dt if all_day else dt.astimezone(TZ).date()
        items.append({
            "date": day,
            "start_dt": None if all_day else dt,
            "all_day": all_day,
            "summary": clean(ev.get("SUMMARY")),
            "description": clean(ev.get("DESCRIPTION")),
            "location": clean(ev.get("LOCATION")),
        })
    return items


def fmt_time(dt):
    if dt is None:
        return ""
    local = dt.astimezone(TZ)
    return local.strftime("%-I:%M %p")


# --------------------------------------------------------------------------
# assembly
# --------------------------------------------------------------------------

def build(flex_items, school_items):
    in_semester = lambda d: SEMESTER["start"] <= d <= SEMESTER["end"]

    flex_days = sorted({
        i["date"] for i in flex_items
        if i["summary"].startswith(SECTION) and in_semester(i["date"])
    })
    flex_times = {}
    for i in flex_items:
        if i["summary"].startswith(SECTION) and i["start_dt"]:
            flex_times[i["date"]] = fmt_time(i["start_dt"])

    # day-level notes that change whether FLEX actually happens
    notes_by_day = {}
    for i in school_items:
        if re.search(r"early release", i["summary"], re.I):
            notes_by_day.setdefault(i["date"], []).append("Early Release — confirm FLEX still meets")

    # school events that apply to us, keyed by date
    mine = {}
    for i in school_items:
        if not in_semester(i["date"]) or not applies_to_me(
                i["summary"], i["description"], i["location"]):
            continue
        body_time, body_audience = time_for_me(i["description"])
        mine.setdefault(i["date"], []).append({
            "kind": classify(i["summary"]),
            "title": strip_audience(i["summary"]),
            "audience": audience_of(i["summary"]) or body_audience,
            "time": (fmt_time(i["start_dt"]) if not i["all_day"] else body_time),
            "location": i["location"],
            "dress": dress_of(i["summary"], i["description"]),
            "source": "school-calendar",
        })

    for m in MANUAL_EVENTS:
        d = date.fromisoformat(m["date"])
        if not in_semester(d):
            continue
        same = [e for e in mine.get(d, []) if e["kind"] == m["kind"]]
        if not same:
            mine.setdefault(d, []).append({k: v for k, v in m.items() if k != "date"})

    days = []
    for d in flex_days:
        events = sorted(mine.get(d, []), key=lambda e: (e["kind"] != "mass", e["time"]))
        days.append({
            "date": d.isoformat(),
            "weekday": d.strftime("%A"),
            "rotation": "A",
            "time": flex_times.get(d, "1:15 PM"),
            "events": events,
            "notes": notes_by_day.get(d, []),
        })

    # Things that matter to the class but land outside a FLEX block: the 8:00 AM
    # MS Mass, the Fall Dance, Field Day, evening awards nights.
    flex_day_set = set(flex_days)
    extras = []
    for d, evs in sorted(mine.items()):
        if d in flex_day_set:
            continue
        for e in evs:
            extras.append({"date": d.isoformat(), "weekday": d.strftime("%A"), **e})

    return {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "section": "FLEX 7-1",
        "semester": {
            "name": SEMESTER["name"],
            "start": SEMESTER["start"].isoformat(),
            "end": SEMESTER["end"].isoformat(),
        },
        "days": days,
        "other_events": extras,
    }


def main():
    flex_cal = fetch(os.environ["FLEX_ICAL_URL"])
    school_cal = fetch(os.environ["SCHOOL_ICAL_URL"])
    payload = build(normalize(flex_cal), normalize(school_cal))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(payload['days'])} FLEX days to {OUT}")


if __name__ == "__main__":
    main()
