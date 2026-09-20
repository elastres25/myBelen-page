# Class board — one embed per Blackbaud page

This is the whole bulletin board in a single page: assignments, today's agenda,
and the current unit, stacked. **One `<iframe>` per Blackbaud board** instead of
three, and everything is written here rather than in Blackbaud.

| Board page | Paste it on | Assignments from | Agenda & unit from |
| --- | --- | --- | --- |
| `board/6-1/` | your 6-1 bulletin board | Theology 6 - 1 | Theology 6 |
| `board/6-2/` | your 6-2 bulletin board | Theology 6 - 3 | Theology 6 |
| `board/7-6/` | your 7-6 bulletin board | Theology 7 - 5 | Theology 7 |
| `board/7-7/` | your 7-7 bulletin board | Theology 7 - 6 | Theology 7 |

The folders use **your** names for the sections, so the board you're standing on
is the folder you want. Assignments stay per section because the feed is; the
agenda and unit are shared by the grade, so writing one covers both its boards.

## Embedding

Add a **Content** block to the bulletin board, open its HTML view, paste this,
and save. **Only the `src` line changes** between boards.

```html
<iframe src="https://elastres25.github.io/myBelen-page/board/7-7/"
        style="width:100%;border:0;height:600px" scrolling="no"
        title="Class Board"></iframe>
<script>
window.addEventListener("message", function (e) {
  if (!e.data || !e.data.boardHeight) return;
  var frames = document.getElementsByTagName("iframe");
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].contentWindow === e.source) {
      frames[i].style.height = (e.data.boardHeight + 20) + "px";
    }
  }
});
</script>
```

The frame grows and shrinks with its contents — when a student opens **Show all
upcoming**, or an assignment's details, or **Previous classes**. The `600px` is
only what shows before the first measurement arrives.

**If the block strips `<script>`,** use a fixed frame and let students scroll:

```html
<iframe src="https://elastres25.github.io/myBelen-page/board/7-7/"
        style="width:100%;border:0;height:900px"
        title="Class Board"></iframe>
```

Never put `?edit=1` in the embed. Editing is switched off inside a frame anyway.

## Updating it

Everything on the board is written from one page:

```
https://elastres25.github.io/myBelen-page/board/7-7/?edit=1
```

Unlock once and both the agenda and the current unit become editable in place,
with a single **Save to site**. Only the parts you actually changed get written —
edit just the agenda and the unit file isn't touched.

You do not write the assignments. They sync themselves from Blackbaud every hour.

Because agenda and unit are per grade, editing on the `7-7` board also updates
the `7-6` board, and `6-1` updates `6-2`. Two boards to keep current, not four.

## What it's built from

The board doesn't reimplement anything — it mounts the same three modules the
standalone pages use, each into its own container:

| Section | Module | Data |
| --- | --- | --- |
| Assignments | `assignments/assignments.js` | `assignments/assignments.json` (hourly sync) |
| Agenda | `agenda/agenda.js` | `agenda/agenda.json` |
| Current Unit | `units/units.js` | `units/units.json` |

So there is still exactly one copy of the assignment due-date logic, one agenda
renderer and one unit renderer. Fix a bug once and every page gets it.

`board.css` loads after the three module stylesheets and only adds the section
frames and titles — it deliberately avoids the `.header` class the modules style
for their own pages, using `.sechead` instead.

The standalone pages still work and are still useful:

- `units/theology6/topics/` — the Topics archive, which the board links to
- `assignments/` — every class at once
- `agenda/theology6/` — the agenda on its own

## Changing what's on a board

Open that board's `index.html`. The block at the bottom is the whole configuration:

```js
Board.mount({
  section:    "Theology 7 - 6",   // must match the feed exactly
  grade:      "theology7",        // which agenda/unit to show
  gradeLabel: "Theology 7",       // used in commit messages
  title:      "Theology 7-7"      // the small label at the top
});
```

To reorder the sections, move the three `<section class="boardsec">` blocks in
that file — they render in document order. To drop one, delete its block.

`limit:` (default 6) sets how many upcoming assignments show before the
**Show all** button.

## Adding a board

Copy the closest folder and change the `Board.mount({…})` block. If it's a new
section, `section:` must match the course name in `assignments.json` exactly —
check with:

```
https://github.com/elastres25/myBelen-page/blob/main/assignments/assignments.json
```
