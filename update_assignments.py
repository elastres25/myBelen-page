import os, json, re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import requests
from icalendar import Calendar

FEED = os.environ["BLACKBAUD_ICAL_URL"].replace("webcal://", "https://", 1)
OUT = Path("assignments/assignments.json")

def clean_text(value):
    if value is None:
        return ""
    return str(value).replace("\\n", "\n").strip()

def dt_to_iso(value):
    if value is None:
        return None
    dt = value.dt if hasattr(value, "dt") else value
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)

def to_local_date(value):
    """The calendar day an event falls on, as a plain date.

    All-day assignments arrive as a `date`; timed ones as a tz-aware
    `datetime`. Either way what matters is the school day, not the instant.
    """
    if value is None:
        return None
    dt = value.dt if hasattr(value, "dt") else value
    if isinstance(dt, datetime):
        return dt.date()
    if isinstance(dt, date):
        return dt
    return None

# "Theology 7 - 5: 8/28: HW Journal Entry" — the M/D the teacher typed.
TITLE_DATE_RE = re.compile(r"(?:^|:)\s*(\d{1,2})/(\d{1,2})\s*:")

def resolve_due(title, feed_date):
    """The date an assignment is actually due.

    Blackbaud's DTSTART is the date the work was ASSIGNED, which for anything
    given out ahead of time is earlier than the due date. Teachers put the real
    due date in the title ("8/28: HW Journal Entry for Class on Thursday" was
    posted on 8/25), so trust that when it names a later day in the same term.
    Only ever moves a due date later, never earlier, so nothing disappears from
    the upcoming list before it should.
    """
    if feed_date is None:
        return None
    m = TITLE_DATE_RE.search(title or "")
    if not m:
        return feed_date

    month, day = int(m.group(1)), int(m.group(2))
    try:
        candidate = date(feed_date.year, month, day)
    except ValueError:
        return feed_date

    # Assigned in December, due in January — the year rolled over.
    if (feed_date - candidate).days > 180:
        try:
            candidate = date(feed_date.year + 1, month, day)
        except ValueError:
            return feed_date

    offset = (candidate - feed_date).days
    return candidate if 0 <= offset <= 60 else feed_date

def infer_course(event, title, description, categories):
    hay = f"{title}\n{description}"

    # IMPORTANT: capture the full Blackbaud section first.
    # Example: "Theology 6 - 1: 8/26: HW Signed Syllabus"
    # becomes course = "Theology 6 - 1"
    m = re.search(r"(Theology\s*[67]\s*-\s*\d+)", hay, re.I)
    if m:
        value = re.sub(r"\s+", " ", m.group(1)).strip()
        # normalize only the word Theology; preserve section number
        value = re.sub(r"^theology", "Theology", value, flags=re.I)
        return value

    # Fallback to just the grade-level course if no section is found.
    m = re.search(r"(Theology\s*[67])", hay, re.I)
    if m:
        return re.sub(r"^theology", "Theology", m.group(1), flags=re.I)

    # Ignore Blackbaud's generic calendar categories.
    cat = clean_text(categories)
    if cat and cat.lower() not in {"podium, events", "podium", "events"}:
        return cat

    return ""

def get_url(component):
    url = clean_text(component.get("URL"))
    if url:
        return url
    description = clean_text(component.get("DESCRIPTION"))
    m = re.search(r'https?://[^\s<>"\']+', description)
    return m.group(0).rstrip(").,") if m else ""

headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/151.0.0.0 Safari/537.36",
    "Accept": "text/calendar,text/plain;q=0.9,*/*;q=0.8",
    "Referer": "https://belenjesuit.myschoolapp.com/"
}

resp = requests.get(FEED, headers=headers, timeout=30)
resp.raise_for_status()
cal = Calendar.from_ical(resp.content)

items = []
for event in cal.walk("VEVENT"):
    title = clean_text(event.get("SUMMARY")) or "Assignment"
    description = clean_text(event.get("DESCRIPTION"))

    categories_prop = event.get("CATEGORIES")
    categories = ""
    if categories_prop:
        try:
            categories = ", ".join(str(x) for x in categories_prop.cats)
        except Exception:
            categories = clean_text(categories_prop)

    due = dt_to_iso(event.get("DTSTART"))
    if not due:
        continue

    assigned_date = to_local_date(event.get("DTSTART"))
    due_date = resolve_due(title, assigned_date)

    items.append({
        "id": clean_text(event.get("UID")),
        "title": title,
        "description": description,
        # `due_date` / `assigned` are plain school days (YYYY-MM-DD) — the pages
        # read these. `due` stays as the raw feed value for back-compat.
        "due_date": due_date.isoformat() if due_date else None,
        "assigned": assigned_date.isoformat() if assigned_date else None,
        "due": due,
        "end": dt_to_iso(event.get("DTEND")),
        "url": get_url(event),
        "location": clean_text(event.get("LOCATION")),
        "categories": categories,
        "course": infer_course(event, title, description, categories),
    })

items.sort(key=lambda x: (x["due_date"] or "", x["title"]))

payload = {
    "updated_at": datetime.now(timezone.utc).isoformat(),
    "assignments": items
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Wrote {len(items)} events to {OUT}")
