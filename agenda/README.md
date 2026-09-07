# Daily agenda pages

What we're doing today and what's due, written by you. One page per grade —
6-1 and 6-2 share the Theology 6 agenda, 7-6 and 7-7 share Theology 7.

| Page | Shows |
| --- | --- |
| `agenda/theology6/` | Theology 6 |
| `agenda/theology7/` | Theology 7 |

Both share `agenda.js` and `agenda.css`; each page file only names its grade.
The content lives in `agenda.json`.

## What students see

Today's entry: a numbered list of what the class is doing, then a homework
block. If today has nothing posted yet, they see the **most recent class**
instead, with a line saying so — better than an empty box on a Monday morning.

Below that, **Previous classes** opens the last five entries, so anyone who was
out can catch up without asking.

## Writing an agenda

Open the page with `?edit=1`:

```
https://elastres25.github.io/myBelen-page/agenda/theology6/?edit=1
```

The date defaults to today. Change it to write ahead or fix an earlier day.
**+ Add a step** adds a line; ↑ ↓ reorder and ✕ removes. Homework is free text
and keeps its line breaks — leave it blank and students see "No homework posted
for this class."

**Save to site** commits it, and students see it about a minute later.

Empty steps and empty days are dropped on save, so the file stays tidy. Days you
clear disappear from the Previous classes list.

## Embedding in a Blackbaud bulletin board

Add a **Content** block, open its HTML view, and paste this — **only the `src`
line changes** between boards.

```html
<iframe src="https://elastres25.github.io/myBelen-page/agenda/theology6/"
        style="width:100%;border:0;height:340px" scrolling="no"
        title="Today's Agenda"></iframe>
<script>
window.addEventListener("message", function (e) {
  if (!e.data || !e.data.agendaHeight) return;
  var frames = document.getElementsByTagName("iframe");
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].contentWindow === e.source) {
      frames[i].style.height = (e.data.agendaHeight + 20) + "px";
    }
  }
});
</script>
```

Use `agenda/theology7/` on the 7th-grade boards.

The frame resizes itself as the agenda grows or as students open Previous
classes. The `340px` is only what shows before the first message arrives. The
script matches the frame by message source, so it is safe to paste unchanged —
including on a board that also embeds assignments.

**If the block strips `<script>`,** use a fixed frame and let students scroll:

```html
<iframe src="https://elastres25.github.io/myBelen-page/agenda/theology6/"
        style="width:100%;border:0;height:340px"
        title="Today's Agenda"></iframe>
```

Never put `?edit=1` in an embed. It is yours alone, and editing is switched off
inside a frame anyway.

## Editing the file directly

`agenda.json` is plain JSON and can be edited on github.com:

```json
{
  "grades": {
    "theology6": {
      "label": "Theology 6",
      "days": {
        "2026-09-08": {
          "agenda": ["Opening prayer", "Notes: Creation", "Small-group discussion"],
          "homework": "Read pp. 12-18. Answer Q1-3."
        }
      }
    }
  }
}
```

Dates are `YYYY-MM-DD` and are read as plain calendar days in your own timezone,
not UTC — the same rule the assignments pages follow, so nothing renders a day
early.

## Adding a grade or section

Copy `theology6/`, then change the `grade:` and `heading:` lines at the bottom of
its `index.html`. A grade key that isn't in `agenda.json` yet is created the
first time you save.
