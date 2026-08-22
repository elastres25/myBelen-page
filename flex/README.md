# FLEX 7-1 schedule page

`index.html` renders every FLEX 7-1 meeting for the semester and highlights the
days we have Mass or a Reconciliation Service. It reads `schedule.json` from the
same folder, so the page never has to be edited to change the schedule.

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
