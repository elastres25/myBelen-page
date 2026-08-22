# FLEX 7-1 schedule page

`index.html` shows the semester as a compressed Monday-to-Friday month grid,
with every FLEX 7-1 day highlighted and Mass days in gold. Days with nothing
special say "Normal". Below the grid it repeats the same information as a Mass
list and a day-by-day list.

Above all of that sits an announcements strip for anything you need to tell the
class. It hides itself when there is nothing to say.

It reads `schedule.json`, `overrides.json` and `announcements.json` from the same
folder, so the page itself never has to be edited to change what it shows.

## Publishing on myBelen

GitHub Pages serves this repository from the `main` branch, so once these files
are on `main` the page is live at:

```
https://elastres25.github.io/myBelen-page/flex/
```

The page draws on a transparent background with no outer margins, so it sits
inside a Blackbaud content area cleanly.

### Embedding it

Add a **Content** block to the myBelen page and paste one of these into its HTML
view.

**Auto-sizing (recommended).** The page is around 5,000px tall, so a fixed frame
either clips it or leaves a lot of blank space. The page posts its height to the
parent, and this listener resizes the frame to match:

```html
<iframe id="flex71"
        src="https://elastres25.github.io/myBelen-page/flex/"
        style="width:100%;border:0;height:1200px" scrolling="no"
        title="FLEX 7-1 Schedule"></iframe>
<script>
window.addEventListener("message", function (e) {
  if (e.data && e.data.flex71Height) {
    document.getElementById("flex71").style.height = (e.data.flex71Height + 20) + "px";
  }
});
</script>
```

**Fixed height,** if the block strips `<script>`. Students scroll inside the
frame:

```html
<iframe src="https://elastres25.github.io/myBelen-page/flex/"
        style="width:100%;border:0;height:900px"
        title="FLEX 7-1 Schedule"></iframe>
```

**Or just link to it** — the page stands on its own and reads fine on a phone:

```html
<a href="https://elastres25.github.io/myBelen-page/flex/">FLEX 7-1 Schedule</a>
```

Remember the `?edit=1` URL is yours alone; do not put it in the embed.

## Where the data comes from

`schedule.json` is built by `../update_flex.py` from two Blackbaud iCal feeds:

| Secret | Feed |
| --- | --- |
| `FLEX_ICAL_URL` | your own class schedule — supplies the `FLEX 7 - 1` blocks |
| `SCHOOL_ICAL_URL` | the school-wide events feed — supplies Masses and activities |

Add both under **Settings → Secrets and variables → Actions**. Until they are
set, `.github/workflows/update-flex.yml` skips the rebuild and leaves the
committed `schedule.json` in place; once they are set it refreshes daily.

Only events whose audience includes a 7th grader are kept — `All MS`,
`6th, 7th & 8th`, `7th`, school-wide, and section ranges that contain 7-1.
Masses for other grades are filtered out.

## Changing what a day says

Two ways, and they end up in the same place.

**Edit the file.** Open `flex/overrides.json` on github.com, add a date, commit.

```json
{
  "2026-09-22": { "label": "Quiz review - bring notebook" },
  "2026-10-13": { "label": "Mass - meet at the chapel door" }
}
```

The label replaces whatever the page would otherwise show for that day. Delete
the entry to go back to the automatic label. An optional `"kind"` sets the
colour: `normal`, `mass`, `reconciliation`, `assembly` or `activity` — leave it
out and the day keeps the colour it already had, so relabelling a Mass day still
shows gold and the Special Dress tag.

**Or click through it.** Open the page with `?edit=1` on the end:

```
https://<your-page-url>/flex/?edit=1
```

That reveals an edit bar and makes every FLEX day clickable. Type a label, press
Enter to save or Esc to cancel; an empty box restores the automatic label.
Edited days get a small dot. When you are done, hit **Copy labels** and paste the
result into `flex/overrides.json`. The same edit bar handles announcements.

Edit mode is deliberately not linked from the page, so students never stumble
into it. Work in progress is held in your own browser until you paste it in —
nothing your students load changes until that file is committed.

`overrides.json` and `announcements.json` are never written by the daily
refresh, so your edits survive every rebuild.

## Announcements

Same two doors as the labels.

**Edit the file.** `flex/announcements.json` holds a list. Only `text` is
required:

```json
{
  "announcements": [
    {
      "title": "Field Day permission slips",
      "text": "Due back this Friday. No slip, no Field Day.",
      "posted": "2026-09-28",
      "until": "2026-10-07",
      "pinned": true
    }
  ]
}
```

| Field | What it does |
| --- | --- |
| `text` | the announcement itself; line breaks are kept |
| `title` | optional bold heading |
| `posted` | optional, shown to students as "Posted Sep 28" |
| `until` | optional last day it shows — after that it drops off by itself |
| `pinned` | optional, keeps it at the top with an "Important" tag |

An empty list hides the whole section, so students never see an empty heading.

**Or click through it.** In `?edit=1` mode, **+ Add announcement** appears under
the section with fields for each of the above. Announcements past their
`until` date stay visible to you, greyed out and marked, so you can see what
your students no longer see. **Copy announcements** hands you the JSON to paste
back into `flex/announcements.json`.

## Events the school feed is missing

The Blackbaud feed does not carry every date from the
[2026-27 Mass and Reconciliation Service schedule](https://docs.google.com/document/d/1sfpm4QOxaXpH0O10nW6d2fGdCLz-kJpVfelfaYSFraA/edit).
Those are listed in `MANUAL_EVENTS` at the top of `../update_flex.py`; add a dict
there and the next rebuild picks it up. They render with a `†` and a footnote so
students know to double-check the date.

Currently listed manually:

- **Wed, Nov 18** — Reconciliation Service for 7-1 through 7-4. The feed only has
  the Nov 20 service for 7-5 through 7-8.

## Changing the semester

`SEMESTER` at the top of `../update_flex.py` bounds which dates are included.
For the spring, set it to the spring term's first and last day and re-run.
