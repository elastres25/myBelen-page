# Theology 6 Home Base — how it works

## Editing the site

Go to **<https://elastres25.github.io/myBelen-page/?edit=1>**

The `?edit=1` on the end is what brings up the editing bar at the bottom. Paste your
access token once (steps below) and your browser remembers it — after that, the same
URL puts you straight into editing.

While editing:

- **Click any text** to change it — headings, blurbs, announcements, everything.
- **Upload a banner photo or logo** with the buttons under the header.
- **Up / Down / Delete** reorders or removes any item.
- **+ Add a box** makes a new colored box on the home page *and* a new sub-page behind it.
- Inside a box, **Open "…" to edit it** jumps to that sub-page's editor.
- On a sub-page: **+ Text section**, **+ Files & links section**, **+ Picture**, and
  **⬆ Upload a document** for PDFs, Word docs, slides, images.
- **Save to site** commits the change. Students see it in about a minute.

Nothing is live until you press **Save to site**. **Discard** throws away unsaved edits.

---

## Making your access token

Do this once. It takes about two minutes.

1. Go to <https://github.com/settings/personal-access-tokens/new> (log into GitHub first)
2. **Token name:** `Class page editor`
3. **Expiration:** pick a date — a year out is reasonable. When it expires the site keeps
   working for students; you just paste a new token to edit again.
4. **Repository access:** choose **Only select repositories**, then pick **myBelen-page**
5. **Permissions** → **Repository permissions** → find **Contents** → set it to
   **Read and write**
6. Click **Generate token** and copy the string starting with `github_pat_`
7. Open the site with `?edit=1`, paste it, click **Unlock**

### Keeping it safe

- **Only paste it on your own computer.** It sits in that browser's storage. Never on a
  classroom, lab, or shared machine.
- **Sign out** on the edit bar wipes it from that browser.
- If it ever leaks, go to <https://github.com/settings/personal-access-tokens>, delete
  that token, and make a new one. Deleting it instantly kills any access.
- The token is never stored in this repository, so students can't find it in the code.

### Why students can't edit

The page has no secret password in it — those can always be read from the source. Instead,
saving goes through GitHub, and GitHub checks your token **on its own servers**. A student
can add `?edit=1` and see a **LOCKED** bar, and that's as far as they get: without a valid
token nothing becomes editable and nothing can be saved. Even if they modified the page in
their own browser's dev tools, it would affect only their screen and vanish on refresh.

---

## The Blackbaud embed

Embed this URL — **without** `?edit=1`:

```
https://elastres25.github.io/myBelen-page/
```

Links are set up so the embed never gets yanked away:

- **Boxes that open a page on this site** load *inside* the Blackbaud frame.
- **Outside links, email, and uploaded documents** open in a *new tab*, leaving your
  Blackbaud page sitting where it was.

Editing is deliberately disabled inside the embed — browsers isolate stored data in
embedded frames, so the token can't be kept there. Always edit at the direct URL above.

---

## Assignments

These update themselves. You don't type them, and you don't maintain a second list.

A GitHub Action (`.github/workflows/update-assignments.yml`) reads your Blackbaud iCal
feed every hour, writes `assignments/assignments.json`, and commits it. The per-section
pages under `assignments/` read that file, so they always show the current list.

The home page's **Assignments** card has one button per section, pointing at those pages:

| Button | Opens | Shows |
|---|---|---|
| 6-1 | `assignments/theology6-1/` | Theology 6 - 1 |
| 6-2 | `assignments/theology6-3/` | Theology 6 - 3 |
| 7-6 | `assignments/theology7-5/` | Theology 7 - 5 |
| 7-7 | `assignments/theology7-6/` | Theology 7 - 6 |

Because those pages live on this site, they open **inside** the Blackbaud embed — students
never get thrown out to another tab.

### If a section is wrong

Each button has its own **LINK** field while editing, plus ↑ ↓ and Delete, and
**+ Add a section** makes another. To add a genuinely new section you also need a page for
it: copy an existing folder under `assignments/`, and change the `SECTION` line near the
top of its `index.html` to match the course name exactly as it appears in the feed
(for example `Theology 6 - 1`).

A section with no link yet is hidden from students rather than shown as a dead button.

### The iCal feed

The feed URL is stored as the repository secret `BLACKBAUD_ICAL_URL` — never in the page,
so students can't see it. That's what makes automatic syncing safe here: the fetch happens
on GitHub's servers, and the public page only ever reads a plain JSON file.

If assignments stop updating, check Actions → **Update Blackbaud assignments** for a failed
run. The usual cause is an expired or rotated feed URL, fixed by updating that secret.

### Linking straight to Blackbaud instead

Any link you paste that points at `*.myschoolapp.com`, `*.blackbaud.com`, or `*.oncampus.*`
automatically **replaces the whole window** rather than opening in the embed, because
Blackbaud refuses to be displayed inside another page. Your own pages stay in the frame,
and everything else (Google Drive, websites, uploaded PDFs) opens in a new tab.

---

## Files

| Path | What it is |
|---|---|
| `index.html` | Home page |
| `page.html` | Renders any sub-page (`page.html?p=syllabus`) |
| `content.json` | All home page text and boxes |
| `pages/*.json` | One file per sub-page |
| `uploads/` | Documents and images you upload |
| `assets/style.css` | All styling |
| `assets/app.js` | Page rendering + the editor |
| `assignments/` | Auto-synced assignment pages (do not hand-edit `assignments.json`) |
| `flex/` | Flex-period schedule pages |
| `update_assignments.py` | Run hourly by GitHub Actions to refresh the feed |

You can always edit the `.json` files directly on GitHub if you prefer — the site reads
from them either way.

**Note:** deleting a box on the home page leaves its `pages/*.json` file behind. It becomes
unreachable, which is harmless; delete the file on GitHub if you want it truly gone.
