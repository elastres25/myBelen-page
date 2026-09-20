/* =============================================================
   board.js — the whole bulletin board in one page.

   Composes the three existing modules rather than re-implementing
   them, so there is still exactly one copy of the assignment logic,
   the agenda logic and the unit logic:

       Assignments  assignments/assignments.js   (per section)
       Agenda       agenda/agenda.js             (per grade)
       Current Unit units/units.js               (per grade)

   Each is mounted into its own container with its own element ids.
   One page, one iframe on the Blackbaud board, one edit bar that
   saves whichever parts you actually changed.
   ============================================================= */
(function (global) {
  "use strict";

  var cfg = null;

  function mount(options) {
    cfg = options;

    var base = options.base || "../../";
    var title = document.getElementById("board-title");
    if (title) title.textContent = options.title || "";

    /* ---- Assignments: filtered to this section ---- */
    Assignments.mount({
      dataUrl: base + "assignments/assignments.json",
      section: options.section,
      showCourse: false,
      limit: options.limit || 6,
      listId: "as-list",
      tabsId: "as-tabs",
      subtitleId: "as-subtitle",
      footerId: "as-footer"
    });

    /* ---- Agenda: shared by the grade ---- */
    Agenda.mount({
      grade: options.grade,
      heading: options.gradeLabel,
      data: base + "agenda/agenda.json",
      manageBar: false,
      ids: { when: "ag-when", body: "ag-body", editor: "ag-editor" }
    });

    /* ---- Current unit: shared by the grade ---- */
    Units.mount({
      grade: options.grade,
      heading: options.gradeLabel,
      view: "current",
      data: base + "units/units.json",
      topicsUrl: base + "units/" + options.grade + "/topics/",
      manageBar: false,
      ids: { dates: "un-dates", body: "un-body", editor: "un-editor" }
    });

    /* ---- One bar for the whole board ---- */
    GHEdit.init({
      hint: "Edit the agenda and the current unit here, then Save.",
      onUnlock: function () {
        document.body.classList.add("editing");
        Agenda.renderEditor();
        Units.renderEditor();
      },
      onSave: function () {
        // Only write the files that actually changed.
        var jobs = [];
        if (Agenda.isDirty()) jobs.push(Agenda.save());
        if (Units.isDirty()) jobs.push(Units.save());
        if (!jobs.length) return Promise.reject(new Error("Nothing has changed yet."));
        return Promise.all(jobs);
      }
    });
  }

  /* Height reporting, same protocol as the single-section pages. */
  function reportHeight() {
    var wrap = document.querySelector(".wrap");
    if (!wrap) return;
    var last = 0;
    var report = function () {
      var h = Math.ceil(wrap.getBoundingClientRect().height);
      if (Math.abs(h - last) > 1) {
        last = h;
        window.parent.postMessage({ boardHeight: h }, "*");
      }
    };
    if (window.ResizeObserver) new ResizeObserver(report).observe(wrap);
    window.addEventListener("load", report);
    window.addEventListener("resize", report);
    document.addEventListener("toggle", report, true);
  }

  global.Board = { mount: mount, reportHeight: reportHeight };
})(window);
