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

Your page does **not** keep a copy of your assignment list. It points at the one Blackbaud
already maintains, so there is nothing to retype and it can never fall out of date.

Under the four boxes there's an **Assignments** card with one button per section — 6-1,
6-2, 7-6, 7-7. A student taps their own section and lands in that course's Blackbaud
assignment center. All four links are already filled in.

### Adding, renaming, or removing a section

While editing, each button has its own **BLACKBAUD LINK** field, plus ↑ ↓ and Delete.
**+ Add a section** makes another. To get the link for a new section: open that course's
assignment center in Blackbaud and copy the address bar. It looks like this, where the
number is the course:

```
https://belenjesuit.myschoolapp.com/lms-assignment/assignment-center/course/98937428/0?svcid=edu
                                                                      ^^^^^^^^
```

A section with no link yet is **hidden from students** rather than shown as a dead button,
and the editor tells you so. If none of them have links, the whole card disappears.

### Check it as a student once

These links carry a *course* ID, not a user ID, so they should work for anyone in that
course. That's read off the URL's shape, though — not confirmed from a student account.
Ask one student to tap their section before you rely on it.

A student tapping someone else's section won't see anything useful, which is fine; they'll
only ever tap their own.

### Why the buttons take over the whole window

Blackbaud refuses to be displayed inside another page, so an assignment center opened
inside your embed would come up blank. Blackbaud links therefore **replace the whole
window**, landing the student in Blackbaud where they already were. This happens
automatically for `*.myschoolapp.com`, `*.blackbaud.com`, and `*.oncampus.*`. Everything
else — Google Drive, websites, uploaded PDFs — still opens in a new tab so your class page
stays put.

### If you ever want a typed list too

Sub-pages support an **Assignments section** (**+ Assignments section** while editing) where
you type a title, due date, note, and link per row. Handy for spotlighting two or three
things — but you'd maintain it alongside Blackbaud, so the section buttons above are
usually the better deal.

### Why it can't pull assignments in automatically

Reading assignments out of Blackbaud needs a password-like key. This site is public, so a
student could read that key out of the page and reach far more than assignments. Browsers
also block a page on `github.io` from reading data on `myschoolapp.com` outright. Real
syncing would need a server running and maintained somewhere — a much bigger project than
this page, and these buttons get you the same place in one tap.

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

You can always edit the `.json` files directly on GitHub if you prefer — the site reads
from them either way.

**Note:** deleting a box on the home page leaves its `pages/*.json` file behind. It becomes
unreachable, which is harmless; delete the file on GitHub if you want it truly gone.
