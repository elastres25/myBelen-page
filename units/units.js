/* =============================================================
   units.js — the Current Unit card and the Topics page.

   Both views read units.json. Each page's index.html only says which
   grade it is and which view to render.

   The workflow it exists for: teach a unit, and when it's done press
   "Finish this unit" — it moves to Topics and a blank one takes its
   place, ready for the next unit.
   ============================================================= */
(function (global) {
  "use strict";

  var REPO_PATH = "units/units.json";
  var DATA = "../units.json";

  var cfg = null;   // { grade, heading, view: "current" | "topics", data, topicsUrl, backUrl }
  var data = null;

  /* ---------------------------------------------------------- */
  /* dates — same local-parts rule as the assignments pages      */
  /* ---------------------------------------------------------- */
  function parseLocalDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }
  function medium(key) {
    var d = parseLocalDate(key);
    if (!d) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  function range(unit) {
    var a = medium(unit.start), b = medium(unit.end);
    if (a && b) return a + " – " + b;
    if (a) return "Started " + a;
    if (b) return "Ended " + b;
    return "";
  }

  /* ---------------------------------------------------------- */
  /* data                                                        */
  /* ---------------------------------------------------------- */
  function blankUnit() {
    return { title: "", subtitle: "", start: todayKey(), end: "",
             summary: "", objectives: [], resources: [] };
  }

  function gradeData() {
    if (!data.grades) data.grades = {};
    var g = data.grades[cfg.grade];
    if (!g) g = data.grades[cfg.grade] = { label: cfg.heading, current: blankUnit(), past: [] };
    if (!g.current) g.current = blankUnit();
    if (!Array.isArray(g.past)) g.past = [];
    if (!Array.isArray(g.current.objectives)) g.current.objectives = [];
    if (!Array.isArray(g.current.resources)) g.current.resources = [];
    return g;
  }

  function hasContent(u) {
    return !!(u && ((u.title || "").trim() || (u.summary || "").trim() ||
      (u.objectives || []).length || (u.resources || []).length));
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

  /* Blackbaud refuses to be framed, so its links replace the window;
     our own pages stay in the frame; everything else opens a new tab. */
  function linkTarget(a, url) {
    var u = String(url || "").trim();
    if (!u) return;
    try {
      var parsed = new URL(u, location.href);
      if (parsed.origin === location.origin) return;
      if (/(^|\.)(myschoolapp|blackbaud)\.com$/i.test(parsed.hostname)) { a.target = "_top"; return; }
    } catch (e) { /* fall through */ }
    a.target = "_blank";
    a.rel = "noopener";
  }

  function unitBody(host, unit) {
    if ((unit.summary || "").trim()) {
      host.appendChild(el("p", "unit-summary", unit.summary));
    }
    var objectives = (unit.objectives || []).filter(function (o) { return String(o).trim(); });
    if (objectives.length) {
      var b = el("div", "block");
      b.appendChild(el("h2", null, "What we're learning"));
      var ul = el("ul", "objectives");
      objectives.forEach(function (o) { ul.appendChild(el("li", null, o)); });
      b.appendChild(ul);
      host.appendChild(b);
    }
    var resources = (unit.resources || []).filter(function (r) { return (r.url || "").trim(); });
    if (resources.length) {
      var rb = el("div", "block");
      rb.appendChild(el("h2", null, "Materials"));
      var rul = el("ul", "resources");
      resources.forEach(function (r) {
        var li = el("li");
        var a = el("a");
        a.href = r.url;
        linkTarget(a, r.url);
        a.appendChild(el("span", null, r.label || r.url));
        a.appendChild(el("span", "go", "↗"));
        li.appendChild(a);
        rul.appendChild(li);
      });
      rb.appendChild(rul);
      host.appendChild(rb);
    }
  }

  function renderCurrent() {
    var g = gradeData();
    var body = document.getElementById("body");
    var dates = document.getElementById("dates");
    body.innerHTML = "";

    if (!hasContent(g.current)) {
      dates.textContent = "";
      body.appendChild(el("p", "empty", "No unit posted yet — check back soon."));
    } else {
      dates.textContent = range(g.current);
      body.appendChild(el("h2", "unit-title", g.current.title || "Untitled unit"));
      if ((g.current.subtitle || "").trim()) {
        body.appendChild(el("p", "unit-sub", g.current.subtitle));
      }
      unitBody(body, g.current);
    }

    if (g.past.length && cfg.topicsUrl) {
      var more = el("div", "more");
      var a = el("a", null, "See all our units (" + g.past.length + ") ›");
      a.href = cfg.topicsUrl;
      more.appendChild(a);
      body.appendChild(more);
    }
  }

  function renderTopics() {
    var g = gradeData();
    var body = document.getElementById("body");
    var dates = document.getElementById("dates");
    body.innerHTML = "";
    dates.textContent = "";

    var any = false;

    if (hasContent(g.current)) {
      any = true;
      body.appendChild(topicNode(g.current, true, true));
    }
    g.past.forEach(function (u, i) {
      if (!hasContent(u)) return;
      any = true;
      body.appendChild(topicNode(u, false, false, i));
    });

    if (!any) body.appendChild(el("p", "empty", "No units posted yet."));

    if (cfg.backUrl) {
      var more = el("div", "more");
      var a = el("a", null, "‹ Back to the current unit");
      a.href = cfg.backUrl;
      more.appendChild(a);
      body.appendChild(more);
    }
  }

  function topicNode(unit, isCurrent, openByDefault, pastIndex) {
    var d = el("details", "topic");
    if (openByDefault) d.open = true;
    var s = el("summary");
    s.appendChild(el("span", "t", unit.title || "Untitled unit"));
    if (isCurrent) s.appendChild(el("span", "pill now", "Current"));
    var r = range(unit);
    if (r) s.appendChild(el("span", "d", r));
    d.appendChild(s);

    var inner = el("div", "inner");
    if ((unit.subtitle || "").trim()) inner.appendChild(el("p", "unit-sub", unit.subtitle));
    unitBody(inner, unit);
    if (GHEdit.editing && !isCurrent) {
      inner.appendChild(unitEditor(unit, {
        onDelete: function () {
          if (!confirm("Delete “" + (unit.title || "this unit") + "” from Topics?")) return;
          gradeData().past.splice(pastIndex, 1);
          GHEdit.markDirty();
          renderTopics();
        }
      }));
    }
    d.appendChild(inner);
    return d;
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

  function textField(label, value, placeholder, onInput, type) {
    var wrap = document.createDocumentFragment();
    wrap.appendChild(el("label", null, label));
    var i = el("input");
    i.type = type || "text";
    i.value = value || "";
    if (placeholder) i.placeholder = placeholder;
    i.addEventListener("input", function () { onInput(i.value); GHEdit.markDirty(); });
    wrap.appendChild(i);
    return wrap;
  }

  /* A panel for editing one unit — used for the current unit and, on the
     Topics page, for any archived one. */
  function unitEditor(unit, opts) {
    opts = opts || {};
    var panel = el("div", "editpanel");
    var rerender = opts.rerender || function () {
      if (cfg.view === "topics") renderTopics(); else renderCurrent();
    };

    panel.appendChild(textField("Unit title", unit.title,
      "e.g. Unit 2 — The Covenant", function (v) { unit.title = v; }));
    panel.appendChild(textField("Subtitle (optional)", unit.subtitle,
      "One line under the title", function (v) { unit.subtitle = v; }));

    var row = el("div", "row");
    var d1 = el("div");
    d1.appendChild(textField("Starts", unit.start, "", function (v) { unit.start = v; }, "date"));
    var d2 = el("div");
    d2.appendChild(textField("Ends", unit.end, "", function (v) { unit.end = v; }, "date"));
    row.appendChild(d1); row.appendChild(d2);
    panel.appendChild(row);

    panel.appendChild(el("label", null, "Summary"));
    var ta = el("textarea");
    ta.value = unit.summary || "";
    ta.placeholder = "What this unit is about, in a few sentences.";
    ta.addEventListener("input", function () { unit.summary = ta.value; GHEdit.markDirty(); });
    panel.appendChild(ta);

    // objectives
    panel.appendChild(el("label", null, "What we're learning"));
    (unit.objectives || []).forEach(function (o, i) {
      var r = el("div", "itemrow");
      var inp = el("input");
      inp.type = "text";
      inp.value = o;
      inp.placeholder = "e.g. Explain what a covenant is";
      inp.addEventListener("input", function () { unit.objectives[i] = inp.value; GHEdit.markDirty(); });
      r.appendChild(inp);
      var up = mini("↑", "", function () {
        var t = unit.objectives[i - 1]; unit.objectives[i - 1] = unit.objectives[i]; unit.objectives[i] = t;
        GHEdit.markDirty(); rerender();
      });
      up.disabled = i === 0;
      var dn = mini("↓", "", function () {
        var t = unit.objectives[i + 1]; unit.objectives[i + 1] = unit.objectives[i]; unit.objectives[i] = t;
        GHEdit.markDirty(); rerender();
      });
      dn.disabled = i === unit.objectives.length - 1;
      r.appendChild(up); r.appendChild(dn);
      r.appendChild(mini("✕", "del", function () {
        unit.objectives.splice(i, 1); GHEdit.markDirty(); rerender();
      }));
      panel.appendChild(r);
    });
    panel.appendChild(mini("+ Add a learning goal", "", function () {
      unit.objectives.push(""); GHEdit.markDirty(); rerender();
    }));

    // resources
    panel.appendChild(el("label", null, "Materials (links)"));
    (unit.resources || []).forEach(function (res, i) {
      var r = el("div", "itemrow");
      var l = el("input");
      l.type = "text"; l.value = res.label || ""; l.placeholder = "What it's called";
      l.addEventListener("input", function () { res.label = l.value; GHEdit.markDirty(); });
      var u = el("input");
      u.type = "text"; u.value = res.url || ""; u.placeholder = "https://…";
      u.addEventListener("input", function () { res.url = u.value; GHEdit.markDirty(); });
      r.appendChild(l); r.appendChild(u);
      r.appendChild(mini("✕", "del", function () {
        unit.resources.splice(i, 1); GHEdit.markDirty(); rerender();
      }));
      panel.appendChild(r);
    });
    panel.appendChild(mini("+ Add a link", "", function () {
      unit.resources.push({ label: "", url: "" }); GHEdit.markDirty(); rerender();
    }));

    if (opts.onDelete) {
      var box = el("div", "archivebox");
      box.appendChild(mini("Delete this unit", "del", opts.onDelete));
      panel.appendChild(box);
    }
    if (opts.archive) {
      var ab = el("div", "archivebox");
      ab.appendChild(el("p", null,
        "Finishing moves this unit to the Topics page and leaves a blank one here " +
        "for the next unit. Nothing is lost — students can still read it under Topics."));
      var btn = el("button", "archivebtn", "Finish this unit & start a new one");
      btn.type = "button";
      btn.disabled = !hasContent(unit);
      btn.addEventListener("click", opts.archive);
      ab.appendChild(btn);
      panel.appendChild(ab);
    }
    return panel;
  }

  function renderEditor() {
    var host = document.getElementById("editor");
    if (!host) return;
    host.innerHTML = "";

    if (cfg.view === "topics") {
      var note = el("div", "editpanel");
      note.appendChild(el("p", null,
        "Open any unit below to edit or delete it. The current unit is edited on its own page."));
      note.querySelector("p").style.margin = "0";
      note.querySelector("p").style.fontSize = "13px";
      host.appendChild(note);
      renderTopics();
      return;
    }

    var g = gradeData();
    host.appendChild(unitEditor(g.current, {
      rerender: function () { renderEditor(); renderCurrent(); },
      archive: function () {
        var g2 = gradeData();
        if (!hasContent(g2.current)) return;
        if (!confirm("Move “" + (g2.current.title || "this unit") +
                     "” to Topics and start a new unit?")) return;
        if (!(g2.current.end || "").trim()) g2.current.end = todayKey();
        g2.past.unshift(g2.current);
        g2.current = blankUnit();
        GHEdit.markDirty();
        GHEdit.setMsg("Unit moved to Topics. Fill in the new one, then Save.", "");
        renderEditor();
        renderCurrent();
      }
    }));
    renderCurrent();
  }

  function tidy(u) {
    u.title = (u.title || "").trim();
    u.subtitle = (u.subtitle || "").trim();
    u.summary = (u.summary || "").trim();
    u.objectives = (u.objectives || []).filter(function (o) { return String(o).trim(); });
    u.resources = (u.resources || []).filter(function (r) { return (r.url || "").trim(); });
    return u;
  }

  function save() {
    var g = gradeData();
    tidy(g.current);
    g.past = g.past.map(tidy).filter(hasContent);
    data.updated_at = new Date().toISOString();
    return GHEdit.putJSON(REPO_PATH, data, "Update units for " + cfg.heading)
      .then(function () { renderEditor(); });
  }

  /* ---------------------------------------------------------- */
  /* height reporting, matching the other embedded pages         */
  /* ---------------------------------------------------------- */
  function reportHeight() {
    var wrap = document.querySelector(".wrap");
    if (!wrap) return;
    var last = 0;
    var report = function () {
      var h = Math.ceil(wrap.getBoundingClientRect().height);
      if (Math.abs(h - last) > 1) {
        last = h;
        window.parent.postMessage({ unitsHeight: h }, "*");
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
    cfg.view = options.view || "current";
    if (options.data) DATA = options.data;
    document.getElementById("heading").textContent = options.heading;

    fetch(DATA + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .catch(function () { return { grades: {} }; })
      .then(function (json) {
        data = json && typeof json === "object" ? json : { grades: {} };
        if (cfg.view === "topics") renderTopics(); else renderCurrent();
        GHEdit.init({
          hint: cfg.view === "topics"
            ? "Open a unit to edit it, then Save."
            : "Edit the current unit, then Save.",
          onUnlock: renderEditor,
          onSave: save
        });
      });
  }

  global.Units = { mount: mount, reportHeight: reportHeight };
})(window);
