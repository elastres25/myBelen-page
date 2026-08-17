#!/usr/bin/env python3
import os, re, json, html, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ICAL_URL = os.environ.get('BLACKBAUD_ICAL_URL')
if not ICAL_URL:
    raise SystemExit('Missing BLACKBAUD_ICAL_URL environment variable')
if ICAL_URL.startswith('webcal://'):
    ICAL_URL = 'https://' + ICAL_URL[len('webcal://'):]

req = urllib.request.Request(ICAL_URL, headers={'User-Agent':'Mozilla/5.0 BlackbaudAssignmentFeed/1.0'})
with urllib.request.urlopen(req, timeout=30) as r:
    raw = r.read().decode('utf-8', errors='replace')

# RFC 5545 line unfolding
lines=[]
for line in raw.replace('\r\n','\n').replace('\r','\n').split('\n'):
    if line.startswith((' ', '\t')) and lines:
        lines[-1] += line[1:]
    else:
        lines.append(line)

def ical_unescape(s):
    return (s.replace('\\n','\n').replace('\\N','\n').replace('\\,',',')
             .replace('\\;',';').replace('\\\\','\\'))

def clean_desc(s):
    s = ical_unescape(s or '')
    # Convert common HTML-ish Blackbaud text to readable plain text.
    s = re.sub(r'(?i)<br\s*/?>', '\n', s)
    s = re.sub(r'(?i)</p\s*>', '\n', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = html.unescape(s)
    s = re.sub(r'\n{3,}', '\n\n', s)
    return s.strip()

def parse_dt(v):
    if not v: return None
    v=v.strip()
    for fmt in ('%Y%m%dT%H%M%SZ','%Y%m%dT%H%M%S','%Y%m%d'):
        try:
            d=datetime.strptime(v,fmt)
            if fmt.endswith('Z'): d=d.replace(tzinfo=timezone.utc)
            return d.isoformat()
        except ValueError:
            pass
    return v

def guess_course(summary, categories, desc, location):
    text=' '.join(filter(None,[summary,categories,desc,location]))
    m=re.search(r'\bTheology\s*([67])\b',text,re.I)
    if m: return f'Theology {m.group(1)}'
    # Preserve a useful category if one is present.
    if categories:
        first=ical_unescape(categories).split(',')[0].strip()
        if first: return first
    return ''

events=[]
in_event=False
current={}
for line in lines:
    if line == 'BEGIN:VEVENT':
        in_event=True; current={}; continue
    if line == 'END:VEVENT':
        if in_event:
            title=ical_unescape(current.get('SUMMARY','')).strip()
            desc=clean_desc(current.get('DESCRIPTION',''))
            cats=ical_unescape(current.get('CATEGORIES','')).strip()
            loc=ical_unescape(current.get('LOCATION','')).strip()
            start=parse_dt(current.get('DTSTART'))
            end=parse_dt(current.get('DTEND'))
            # For assignment-style events, DTSTART is usually the due date. Keep both keys for flexibility.
            events.append({
                'id': ical_unescape(current.get('UID','')).strip(),
                'title': title or 'Assignment',
                'course': guess_course(title,cats,desc,loc),
                'categories': cats,
                'description': desc,
                'location': loc,
                'start': start,
                'due': start,
                'end': end,
                'url': ical_unescape(current.get('URL','')).strip()
            })
        in_event=False; current={}; continue
    if not in_event or ':' not in line: continue
    keypart, value = line.split(':',1)
    key = keypart.split(';',1)[0].upper()
    if key in {'SUMMARY','DESCRIPTION','CATEGORIES','LOCATION','DTSTART','DTEND','URL','UID'}:
        current[key]=value

out={
    'updated_at': datetime.now(timezone.utc).isoformat(),
    'assignments': events
}
Path('assignments.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Wrote {len(events)} assignments')
