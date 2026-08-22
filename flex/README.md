# FLEX 7-1 schedule page

`index.html` shows the semester as a compressed Monday-to-Friday month grid,
with every FLEX 7-1 day highlighted and Mass days in gold. Days with nothing
special say "Normal". Below the grid it repeats the same information as a Mass
list and a day-by-day list.

It reads `schedule.json` and `overrides.json` from the same folder, so the page
itself never has to be edited to change the schedule.

## Publishing on myBelen

Point a myBelen content block at the published page, the same way the
`assignments/` page is embedded. The page draws on a transparent background with
no outer margins so it sits inside a Blackbaud content area cleanly.

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
Edited days get a small dot. When you are done, hit **Copy JSON** and paste the
result into `flex/overrides.json`.

Edit mode is deliberately not linked from the page, so students never stumble
into it. Work in progress is held in your own browser until you paste it in —
nothing your students load changes until that file is committed.

`overrides.json` is never written by the daily refresh, so your labels survive
every rebuild.

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
