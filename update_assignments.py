import os, json, re
from datetime import datetime, timezone
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

def infer_course(event, title, description, categories):
    hay = f"{title}\n{description}"

    # First, look for the actual course name in the assignment title
    patterns = [
        r"(Theology\s*6)",
        r"(Theology\s*7)",
    ]

    for p in patterns:
        m = re.search(p, hay, re.I)
        if m:
            return m.group(1).title()

    # Ignore Blackbaud's generic feed categories
    if categories:
        cat = clean_text(categories)
        if cat.lower() not in ["podium, events", "podium", "events"]:
            return cat

    return ""

def get_url(component):
    # Standard iCal URL property
    url = clean_text(component.get("URL"))
    if url:
        return url

    # Sometimes a usable URL is included inside DESCRIPTION
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

resp = requests.get(
    FEED,
    headers=headers,
    timeout=30
)
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

    items.append({
        "id": clean_text(event.get("UID")),
        "title": title,
        "description": description,
        "due": due,
        "end": dt_to_iso(event.get("DTEND")),
        "url": get_url(event),
        "location": clean_text(event.get("LOCATION")),
        "categories": categories,
        "course": infer_course(event, title, description, categories),
    })

items.sort(key=lambda x: x["due"] or "")

payload = {
    "updated_at": datetime.now(timezone.utc).isoformat(),
    "assignments": items
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Wrote {len(items)} events to {OUT}")
