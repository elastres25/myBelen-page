/* =============================================================
   agenda.js — shared by every daily-agenda page.

   Each page's index.html only says which grade it shows. The data
   lives in agenda.json and is written through the ?edit=1 editor.
   ============================================================= */
(function (global) {
  "use strict";

  var REPO_PATH = "agenda/agenda.json";   // path used when committing
  var DATA = "../agenda.json";            // overridden per page if needed

  var cfg = null;      // { grade, heading }
  var data = null;     // the whole agenda.json
  var editDate = null; // which day the editor is on

  /* ---------------------------------------------------------- */
  /* dates                                                       */
  /* ---------------------------------------------------------- */

  /* "2026-09-08" parsed with new Date() is UTC midnight — 8pm the day
     before in Miami — so every date would render a day early. Build it
     from its parts instead. Same rule as the assignments pages. */
  function parseLocalDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  function keyOf(d) {
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }
  function todayKey() { return keyOf(new Date()); }

  function longDate(key) {
    var d = parseLocalDate(key);
    if (!d) return key;
    return d.toLocaleDateString(undefined,
      { weekday: "long", month: "long", day: "numeric" });
  }
  function shortDate(key) {
    var d = parseLocalDate(key);
    if (!d) return key;
    return d.toLocaleDateString(undefined,
      { weekday: "short", month: "short", day: "numeric" });
  }

  /* ---------------------------------------------------------- */
  /* data helpers                                                */
  /* ---------------------------------------------------------- */
  function gradeData() {
    if (!data.grades) data.grades = {};
    if (!data.grades[cfg.grade]) {
      data.grades[cfg.grade] = { label: cfg.heading, days: {} };
    }
    if (!data.grades[cfg.grade].days) data.grades[cfg.grade].days = {};
    return data.grades[cfg.grade];
  }

  /* Days that actually have something in them, newest first. */
  function postedKeys() {
    var days = gradeData().days;
    return Object.keys(days).filter(function (k) {
      var e = days[k];
      return e && ((e.agenda && e.agenda.length) || (e.homework || "").trim());
    }).sort().reverse();
  }

  /* Today's entry, or the most recent one before today. */
  function entryToShow() {
    var days = gradeData().days;
    var t = todayKey();
    if (days[t] && ((days[t].agenda || []).length || (days[t].homework || "").trim())) {
      return { key: t, entry: days[t], stale: false };
    }
    var past = postedKeys().filter(function (k) { return k < t; });
    if (past.length) return { key: past[0], entry: days[past[0]], stale: true };
    return null;
  }

  /* ---------------------------------------------------------- */
  /* rendering                                                   */
  /* ---------------------------------------------------------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderDayInto(host, entry) {
    var steps = (entry.agenda || []).filter(function (s) { return String(s).trim(); });
    if (steps.length) {
      var b1 = el("div", "block");
      b1.appendChild(el("h2", null, "What we're doing"));
      var ol = el("ol", "steps");
      steps.forEach(function (s) { ol.appendChild(el("li", null, s)); });
      b1.appendChild(ol);
      host.appendChild(b1);
    }

    var hw = (entry.homework || "").trim();
    var b2 = el("div", "block");
    b2.appendChild(el("h2", null, "Homework"));
    if (hw) {
      b2.appendChild(el("div", "homework", hw));
    } else {
      b2.appendChild(el("div", "homework none", "No homework posted for this class."));
    }
    host.appendChild(b2);
  }

  function render() {
    var head = document.getElementById("when");
    var body = document.getElementById("body");
    body.innerHTML = "";

    var shown = entryToShow();

    if (!shown) {
      head.textContent = longDate(todayKey());
      body.appendChild(el("p", "empty", "No agenda posted yet — check back soon."));
      renderRecent(body, null);
      return;
    }

    head.textContent = longDate(shown.key);

    if (shown.stale) {
      body.appendChild(el("div", "stale",
        "Nothing posted for today yet. This is our last class, " + shortDate(shown.key) + "."));
    }

    renderDayInto(body, shown.entry);
    renderRecent(body, shown.key);
  }

  /* Previous classes, for anyone who was out. */
  function renderRecent(host, currentKey) {
    var days = gradeData().days;
    var keys = postedKeys().filter(function (k) { return k !== currentKey; }).slice(0, 5);
    if (!keys.length) return;

    var d = el("details", "recent");
    d.appendChild(el("summary", null, "Previous classes (" + keys.length + ")"));
    keys.forEach(function (k) {
      var wrap = el("div", "day");
      wrap.appendChild(el("h3", null, longDate(k)));
      renderDayInto(wrap, days[k]);
      d.appendChild(wrap);
    });
    host.appendChild(d);
  }

  /* ---------------------------------------------------------- */
  /* editing                                                     */
  /* ---------------------------------------------------------- */
  function mini(label, cls, fn) {
    var b = el("button", "minibtn" + (cls ? " " + cls : ""), label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  function currentEntry() {
    var days = gradeData().days;
    if (!days[editDate]) days[editDate] = { agenda: [], homework: "" };
    if (!Array.isArray(days[editDate].agenda)) days[editDate].agenda = [];
    return days[editDate];
  }

  function renderEditor() {
    var host = document.getElementById("editor");
    host.innerHTML = "";
    var panel = el("div", "editpanel");
    var entry = currentEntry();

    // which day
    var row = el("div", "row");
    row.appendChild(el("label", null, "Class date"));
    var dateInput = el("input");
    dateInput.type = "date";
    dateInput.value = editDate;
    dateInput.addEventListener("change", function () {
      if (!dateInput.value) return;
      editDate = dateInput.value;
      renderEditor();
      render();
    });
    row.appendChild(dateInput);
    row.appendChild(el("span", null, longDate(editDate)));
    panel.appendChild(row);

    // what we're doing
    panel.appendChild(el("label", null, "What we're doing"));
    var list = el("div");
    entry.agenda.forEach(function (step, i) {
      var r = el("div", "steprow");
      var inp = el("input");
      inp.type = "text";
      inp.value = step;
      inp.placeholder = "e.g. Opening prayer";
      inp.addEventListener("input", function () {
        entry.agenda[i] = inp.value;
        GHEdit.markDirty();
      });
      r.appendChild(inp);

      var up = mini("↑", "", function () {
        var t = entry.agenda[i - 1]; entry.agenda[i - 1] = entry.agenda[i]; entry.agenda[i] = t;
        GHEdit.markDirty(); renderEditor(); render();
      });
      up.disabled = i === 0;
      var down = mini("↓", "", function () {
        var t = entry.agenda[i + 1]; entry.agenda[i + 1] = entry.agenda[i]; entry.agenda[i] = t;
        GHEdit.markDirty(); renderEditor(); render();
      });
      down.disabled = i === entry.agenda.length - 1;
      r.appendChild(up);
      r.appendChild(down);
      r.appendChild(mini("✕", "del", function () {
        entry.agenda.splice(i, 1);
        GHEdit.markDirty(); renderEditor(); render();
      }));
      list.appendChild(r);
    });
    panel.appendChild(list);
    panel.appendChild(mini("+ Add a step", "", function () {
      entry.agenda.push("");
      GHEdit.markDirty(); renderEditor();
    }));

    // homework
    panel.appendChild(el("label", null, "Homework / what's due"));
    var ta = el("textarea");
    ta.value = entry.homework || "";
    ta.placeholder = "Leave blank if there's none. Line breaks are kept.";
    ta.addEventListener("input", function () {
      entry.homework = ta.value;
      GHEdit.markDirty();
    });
    panel.appendChild(ta);

    // clear this day
    var tools = el("div", "row");
    tools.style.marginTop = "10px";
    tools.appendChild(mini("Clear this day", "del", function () {
      if (!confirm("Remove the agenda for " + longDate(editDate) + "?")) return;
      delete gradeData().days[editDate];
      GHEdit.markDirty(); renderEditor(); render();
    }));
    panel.appendChild(tools);

    // jump to another posted day
    var posted = postedKeys().slice(0, 12);
    if (posted.length) {
      var p = el("div", "posted");
      p.appendChild(el("h4", null, "Posted days — click to edit"));
      var ul = el("ul");
      posted.forEach(function (k) {
        var li = el("li");
        var b = el("button", k === editDate ? "on" : "", shortDate(k));
        b.type = "button";
        b.addEventListener("click", function () {
          editDate = k;
          renderEditor(); render();
        });
        li.appendChild(b);
        ul.appendChild(li);
      });
      p.appendChild(ul);
      p.appendChild(el("h4", null, ""));
      d3Note(p);
      panel.appendChild(p);
    }

    host.appendChild(panel);
  }

  function d3Note(p) {
    var n = el("div", null,
      "Students see today's entry. If today has none, they see the most recent class instead.");
    n.style.color = "var(--bb-muted)";
    n.style.fontSize = "11px";
    p.appendChild(n);
  }

  function save() {
    // Drop empty steps and days so the file stays tidy.
    var days = gradeData().days;
    Object.keys(days).forEach(function (k) {
      var e = days[k];
      e.agenda = (e.agenda || []).filter(function (s) { return String(s).trim(); });
      e.homework = (e.homework || "").trim();
      if (!e.agenda.length && !e.homework) delete days[k];
    });
    data.updated_at = new Date().toISOString();
    return GHEdit.putJSON(REPO_PATH, data, "Update agenda for " + cfg.heading)
      .then(function () { renderEditor(); render(); });
  }

  /* ---------------------------------------------------------- */
  /* height reporting, matching the assignments pages            */
  /* ---------------------------------------------------------- */
  function reportHeight() {
    var wrap = document.querySelector(".wrap");
    if (!wrap) return;
    var last = 0;
    var report = function () {
      var h = Math.ceil(wrap.getBoundingClientRect().height);
      if (Math.abs(h - last) > 1) {
        last = h;
        window.parent.postMessage({ agendaHeight: h }, "*");
      }
    };
    if (window.ResizeObserver) new ResizeObserver(report).observe(wrap);
    window.addEventListener("load", report);
    window.addEventListener("resize", report);
    document.addEventListener("toggle", report, true);
  }

  /* ---------------------------------------------------------- */
  /* boot                                                        */
  /* ---------------------------------------------------------- */
  function mount(options) {
    cfg = options;
    if (options.data) DATA = options.data;
    editDate = todayKey();
    document.getElementById("heading").textContent = options.heading;

    fetch(DATA + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .catch(function () { return { grades: {} }; })
      .then(function (json) {
        data = json && typeof json === "object" ? json : { grades: {} };
        render();
        GHEdit.init({
          hint: "Pick a date, write the agenda, then Save.",
          onUnlock: renderEditor,
          onSave: save
        });
      });
  }

  global.Agenda = { mount: mount, reportHeight: reportHeight };
})(window);
