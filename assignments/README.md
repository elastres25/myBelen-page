# Assignment pages

Auto-synced from the Blackbaud iCal feed. You never type these in.

`../update_assignments.py` runs hourly (see `.github/workflows/update-assignments.yml`),
writes `assignments.json`, and commits it. Every page here reads that one file, so
they always show the current list. **Do not hand-edit `assignments.json`** — the next
run overwrites it.

| Page | Shows |
| --- | --- |
| `assignments/` | every class, with the class name on each row |
| `assignments/theology6-1/` | Theology 6 - 1 |
| `assignments/theology6-3/` | Theology 6 - 3 |
| `assignments/theology7-5/` | Theology 7 - 5 |
| `assignments/theology7-6/` | Theology 7 - 6 |

All five share `assignments.js` and `assignments.css`; each page file only sets its
heading and which section it filters to.

## Tabs

**Upcoming** (opens here) · **Past due** · **All**, each with a count.

An assignment stays under Upcoming through the end of the day it is due, and moves
to Past due the next morning. Past due lists the most recently missed first.

## Due dates

Two things to know, because Blackbaud makes this less obvious than it looks:

- A date in the feed is a **plain calendar day**, and is treated as one. Parsing
  `"2026-08-25"` with `new Date()` would read it as UTC midnight — 8pm on Aug 24 in
  Miami — so every date would show a day early. `parseLocalDate` builds it from its
  parts instead.
- Blackbaud's date on an event is when the work was **assigned**, not when it is due.
  The due date is the one you type into the title: `Theology 7 - 5: 8/28: HW Journal
  Entry` posted on 8/25 is due on the **28th**. When a title names a later date within
  the term, that wins. It only ever moves a due date *later*, so nothing drops off
  Upcoming early, and anything ambiguous falls back to the feed date. Where the two
  differ, the assignment's detail panel shows both.

So: **put the real due date in the assignment title** and the pages will follow it.

## Embedding in a Blackbaud bulletin board

Add a **Content** block, open its HTML view, and paste this. It is the same on every
board — **only the `src` line changes.**

```html
<iframe src="https://elastres25.github.io/myBelen-page/assignments/theology6-1/"
        style="width:100%;border:0;height:520px" scrolling="no"
        title="Assignments"></iframe>
<script>
window.addEventListener("message", function (e) {
  if (!e.data || !e.data.assignmentsHeight) return;
  var frames = document.getElementsByTagName("iframe");
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].contentWindow === e.source) {
      frames[i].style.height = (e.data.assignmentsHeight + 20) + "px";
    }
  }
});
</script>
```

Swap the `src` for whichever board you are on:

```
https://elastres25.github.io/myBelen-page/assignments/            all classes
https://elastres25.github.io/myBelen-page/assignments/theology6-1/
https://elastres25.github.io/myBelen-page/assignments/theology6-3/
https://elastres25.github.io/myBelen-page/assignments/theology7-5/
https://elastres25.github.io/myBelen-page/assignments/theology7-6/
```

The page reports its height and the listener resizes the frame to match, so the box
grows and shrinks as students switch tabs or open an assignment. The `520px` is only
what shows before the first message arrives. The script needs no `id` and matches the
frame by message source, so it is safe to paste unchanged — including twice on one
board.

**If the block strips `<script>`,** use a fixed frame and let students scroll inside it:

```html
<iframe src="https://elastres25.github.io/myBelen-page/assignments/theology6-1/"
        style="width:100%;border:0;height:520px"
        title="Assignments"></iframe>
```

### Options on the URL

| Add to the URL | Effect |
| --- | --- |
| `?limit=all` | no cap on Upcoming (default shows 6 with a "Show all" button) |
| `?limit=3` | shorter list, for a narrow column |
| `?course=Theology%206%20-%201` | filter the all-classes page to one section |

## Adding a section

Copy an existing folder, then change the `section:` line near the bottom of its
`index.html` to the course name exactly as it appears in the feed (for example
`Theology 6 - 1`), and the heading above it. Nothing else needs editing.
