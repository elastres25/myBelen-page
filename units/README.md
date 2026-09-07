# Current Unit and Topics pages

The unit you're teaching now, and everything you've taught before. One pair per
grade — 6-1 and 6-2 share Theology 6, 7-6 and 7-7 share Theology 7.

| Page | Shows |
| --- | --- |
| `units/theology6/` | Theology 6 — the current unit |
| `units/theology6/topics/` | Theology 6 — every unit, current and past |
| `units/theology7/` | Theology 7 — the current unit |
| `units/theology7/topics/` | Theology 7 — every unit, current and past |

All four share `units.js` and `units.css`; each page file only names its grade
and which view it is. The content lives in `units.json`.

## The workflow

Teach a unit. When it's done, open the current-unit page with `?edit=1` and press
**Finish this unit & start a new one**:

- the unit moves to the Topics page, keeping everything in it
- its end date is filled in with today's, if you left it blank
- a blank unit takes its place, ready for the next one

Nothing is deleted. Students can still read the finished unit under Topics.
The current-unit page grows a **See all our units ›** link once anything is
archived.

## Writing a unit

```
https://elastres25.github.io/myBelen-page/units/theology6/?edit=1
```

| Field | What it's for |
| --- | --- |
| Unit title | e.g. `Unit 2 — The Covenant` |
| Subtitle | optional single line under the title |
| Starts / Ends | optional; shown as a date range |
| Summary | a few sentences on what the unit is about |
| What we're learning | the learning goals, one per line |
| Materials | links — a Drive file, a website, an uploaded PDF |

**Save to site** commits it; students see it about a minute later.

Past units are edited on the Topics page with `?edit=1` — open one and the same
fields appear, plus **Delete this unit**.

## Embedding in a Blackbaud bulletin board

Add a **Content** block, open its HTML view, and paste this — **only the `src`
line changes** between boards.

```html
<iframe src="https://elastres25.github.io/myBelen-page/units/theology6/"
        style="width:100%;border:0;height:300px" scrolling="no"
        title="Current Unit"></iframe>
<script>
window.addEventListener("message", function (e) {
  if (!e.data || !e.data.unitsHeight) return;
  var frames = document.getElementsByTagName("iframe");
  for (var i = 0; i < frames.length; i++) {
    if (frames[i].contentWindow === e.source) {
      frames[i].style.height = (e.data.unitsHeight + 20) + "px";
    }
  }
});
</script>
```

Use `units/theology7/` on the 7th-grade boards.

Each embedded section reports its own height and the listener matches frames by
message source, so a board can carry assignments, agenda and current unit
together and all three size themselves correctly.

**If the block strips `<script>`,** use a fixed frame:

```html
<iframe src="https://elastres25.github.io/myBelen-page/units/theology6/"
        style="width:100%;border:0;height:300px"
        title="Current Unit"></iframe>
```

Never put `?edit=1` in an embed.

### Linking to Topics

The Topics page stands on its own and reads fine on a phone, so it works as a
plain link as well as an embed:

```html
<a href="https://elastres25.github.io/myBelen-page/units/theology6/topics/">Our units so far</a>
```

## Editing the file directly

`units.json` is plain JSON and can be edited on github.com. `past` is newest
first — the order the Topics page shows them in.

```json
{
  "grades": {
    "theology6": {
      "label": "Theology 6",
      "current": {
        "title": "Unit 2 — The Covenant",
        "subtitle": "God's promise to his people",
        "start": "2026-10-06",
        "end": "",
        "summary": "What a covenant is and why it matters.",
        "objectives": ["Explain what a covenant is"],
        "resources": [{ "label": "Unit 2 packet", "url": "../uploads/unit2.pdf" }]
      },
      "past": []
    }
  }
}
```

Dates are `YYYY-MM-DD`, read as plain calendar days in your own timezone.

Material links follow the same rule as the rest of the site: a link to this site
opens in place, a Blackbaud link replaces the whole window (Blackbaud refuses to
be framed), and anything else opens in a new tab.

## Adding a grade

Copy `theology6/` including its `topics/` folder, then change the `grade:` and
`heading:` lines at the bottom of both `index.html` files. A grade key that isn't
in `units.json` yet is created the first time you save.
