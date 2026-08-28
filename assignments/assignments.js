/* Shared assignment list used by the all-classes page and every per-section
   page. One copy of the date handling, because getting due dates right is the
   whole job here and it was previously duplicated (and wrong) in five files. */
(function (global) {
  'use strict';

  var DAY = 86400000;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Blackbaud sends all-day assignments as a bare "YYYY-MM-DD". `new Date()`
     reads that as UTC midnight, which in Miami is 8pm the PREVIOUS day — which
     is why every due date used to display one day early. Build the date from
     its parts so it stays a local calendar day. */
  function parseLocalDate(value) {
    if (!value) return null;
    var s = String(value).trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function today() {
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function daysFromToday(date) {
    return Math.round((date - today()) / DAY);
  }

  /* Teachers write the real due date into the title:
       "Theology 7 - 5: 8/28: HW Journal Entry for Class on Thursday"
     Blackbaud's own date on that event is 8/25 — the day the work was ASSIGNED.
     So when the title names a later date within the term, that's the due date.
     This only ever moves a due date LATER, never earlier, so nothing can drop
     off the upcoming list before it should. */
  function titleDueDate(title, feedDate) {
    if (!feedDate) return null;
    var m = /(?:^|:)\s*(\d{1,2})\/(\d{1,2})\s*:/.exec(String(title || ''));
    if (!m) return null;
    var month = +m[1], day = +m[2];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    var candidate = new Date(feedDate.getFullYear(), month - 1, day);
    if (candidate.getMonth() !== month - 1) return null;   // e.g. 2/30

    // A title date far behind the feed date means the school year rolled over
    // (assigned in December, due in January).
    if ((feedDate - candidate) / DAY > 180) {
      candidate = new Date(feedDate.getFullYear() + 1, month - 1, day);
    }

    var offset = (candidate - feedDate) / DAY;
    return (offset >= 0 && offset <= 60) ? candidate : null;
  }

  /* The date an assignment is actually due. Prefers `due_date`, which the
     updater now resolves server-side; falls back to working it out here so the
     page is correct immediately, without waiting for the next feed refresh. */
  function dueDateOf(item) {
    var base = parseLocalDate(item.due_date || item.due);
    if (!base) return null;
    if (item.due_date) return base;
    return titleDueDate(item.title, base) || base;
  }

  function fmt(date, opts) {
    return new Intl.DateTimeFormat('en-US', opts).format(date);
  }

  function dueLabel(date) {
    var diff = daysFromToday(date);
    if (diff === 0) return 'Due today';
    if (diff === 1) return 'Due tomorrow';
    if (diff > 0) return 'Due ' + fmt(date, { month: 'short', day: 'numeric' });
    if (diff === -1) return 'Was due yesterday';
    return 'Was due ' + fmt(date, { month: 'short', day: 'numeric' });
  }

  /* The point value Blackbaud appends: "…Bring Materials (0.25)", and sometimes
     with a shouted suffix after it: "…Survey (0.25) CLICK HERE". Only treat a
     number in parentheses as points when nothing but an ALL-CAPS aside follows,
     so an ordinary "(see chapter 3) and answer" is left alone. */
  var POINTS_RE = /\s*\((\d+(?:\.\d+)?)\)(?=\s*(?:[A-Z][A-Z\s!.,'-]*)?$)/;

  function cleanTitle(title) {
    var t = String(title || 'Assignment');
    t = t.replace(/^\s*Theology\s*[67]\s*-\s*\d+\s*:\s*/i, '');   // section prefix
    t = t.replace(/^\s*\d{1,2}\/\d{1,2}\s*:\s*/, '');             // date prefix
    t = t.replace(POINTS_RE, '');                                 // point value
    return t.trim();
  }

  function pointsOf(title) {
    var m = String(title || '').match(POINTS_RE);
    return m ? m[1] + ' pts' : '';
  }

  function matchesSection(item, section) {
    if (!section) return true;
    var want = section.toLowerCase();
    if (String(item.course || '').toLowerCase() === want) return true;
    return String(item.title || '').toLowerCase().indexOf(want + ':') === 0;
  }

  function itemHTML(item, opts) {
    var due = item._due;
    var past = daysFromToday(due) < 0;
    var label = dueLabel(due);
    var urgent = (!past && daysFromToday(due) <= 1) ? ' urgent' : (past ? ' past' : '');
    var points = pointsOf(item.title);
    var course = item.course || '';
    var desc = item.description || 'No additional assignment details were included in the calendar feed.';

    // When the title's due date differs from the date Blackbaud posted the
    // event, say so rather than silently picking one.
    var assigned = parseLocalDate(item.assigned || item.due);
    var assignedNote = (assigned && assigned.getTime() !== due.getTime())
      ? '<div class="label">Assigned</div><div class="value">' + esc(fmt(assigned, { weekday: 'short', month: 'short', day: 'numeric' })) + '</div>'
      : '';

    var link = item.url
      ? '<div class="actions"><a href="' + esc(item.url) + '" target="_blank" rel="noopener">Open assignment in Blackbaud &rarr;</a></div>'
      : '';

    return '' +
      '<details class="assignment' + (past ? ' is-past' : '') + '">' +
        '<summary>' +
          '<div class="main">' +
            '<div class="title">' + esc(cleanTitle(item.title)) + '</div>' +
            '<div class="meta">' +
              ((opts.showCourse && course) ? '<span class="course">' + esc(course) + '</span>' : '') +
              '<span class="due' + urgent + '">' + esc(label) + '</span>' +
              (points ? '<span class="points">' + esc(points) + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="chev">&rsaquo;</div>' +
        '</summary>' +
        '<div class="details">' +
          '<div class="detail-grid">' +
            '<div class="label">Due</div>' +
            '<div class="value">' + esc(fmt(due, { weekday: 'long', month: 'short', day: 'numeric' })) + '</div>' +
            assignedNote +
            ((opts.showCourse && course) ? '<div class="label">Class</div><div class="value">' + esc(course) + '</div>' : '') +
            (points ? '<div class="label">Points</div><div class="value">' + esc(points) + '</div>' : '') +
          '</div>' +
          '<div class="description">' +
            '<h3>Assignment Details</h3>' +
            '<p>' + esc(desc) + '</p>' +
          '</div>' +
          link +
        '</div>' +
      '</details>';
  }

  var TABS = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past',     label: 'Past due' },
    { key: 'all',      label: 'All' }
  ];

  function mount(config) {
    var opts = config || {};
    var listEl = document.getElementById(opts.listId || 'list');
    var tabsEl = document.getElementById(opts.tabsId || 'tabs');
    var subtitleEl = document.getElementById(opts.subtitleId || 'subtitle');
    var footerEl = document.getElementById(opts.footerId || 'footer');
    if (!listEl) return;

    var dataUrl = opts.dataUrl || 'assignments.json';
    var section = opts.section || '';
    var showCourse = opts.showCourse !== false;
    var limit = opts.limit || 0;          // 0 = no cap
    var expanded = false;
    var buckets = { upcoming: [], past: [], all: [] };
    var active = 'upcoming';

    function renderTabs() {
      if (!tabsEl) return;
      tabsEl.innerHTML = TABS.map(function (t) {
        var n = buckets[t.key].length;
        return '<button class="tab" type="button" role="tab" data-tab="' + t.key + '"' +
               ' aria-selected="' + (t.key === active) + '">' +
               esc(t.label) + '<span class="count">' + n + '</span></button>';
      }).join('');
    }

    function renderList() {
      var items = buckets[active];

      if (!items.length) {
        listEl.innerHTML = '<div class="empty">' + esc({
          upcoming: 'Nothing due right now — you’re all caught up.',
          past: 'No past-due assignments.',
          all: 'No assignments found.'
        }[active]) + '</div>';
        return;
      }

      // The cap exists so an embedded panel stays short; it applies to the
      // upcoming list only, and never hides work behind a silent truncation.
      var capped = (active === 'upcoming' && limit && !expanded && items.length > limit)
        ? items.slice(0, limit)
        : items;

      var html = capped.map(function (x) { return itemHTML(x, { showCourse: showCourse }); }).join('');

      if (capped.length < items.length) {
        html += '<div class="more"><button type="button" id="show-all">' +
                'Show all ' + items.length + ' upcoming &darr;</button></div>';
      }
      listEl.innerHTML = html;

      var more = document.getElementById('show-all');
      if (more) more.addEventListener('click', function () { expanded = true; renderList(); });
    }

    function renderSubtitle() {
      if (!subtitleEl) return;
      var up = buckets.upcoming.length;
      var overdue = buckets.past.length;
      if (!buckets.all.length) { subtitleEl.textContent = 'No assignments in the feed yet.'; return; }
      subtitleEl.textContent = up
        ? up + ' assignment' + (up === 1 ? '' : 's') + ' still to come' +
          (overdue ? ' · ' + overdue + ' past due' : '') + '.'
        : 'Nothing due right now' + (overdue ? ' · ' + overdue + ' past due' : '') + '.';
    }

    function show(tab) {
      active = tab;
      expanded = false;
      renderTabs();
      renderList();
    }

    if (tabsEl) {
      tabsEl.addEventListener('click', function (ev) {
        var btn = ev.target.closest('button[data-tab]');
        if (btn) show(btn.getAttribute('data-tab'));
      });
    }

    fetch(dataUrl + (dataUrl.indexOf('?') < 0 ? '?' : '&') + 'ts=' + Date.now(), { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('Could not load assignments.');
        return r.json();
      })
      .then(function (data) {
        var items = (Array.isArray(data.assignments) ? data.assignments : [])
          .filter(function (x) { return matchesSection(x, section); })
          .map(function (x) { x._due = dueDateOf(x); return x; })
          .filter(function (x) { return x._due; });

        buckets.all = items.slice().sort(function (a, b) { return a._due - b._due; });
        buckets.upcoming = buckets.all.filter(function (x) { return daysFromToday(x._due) >= 0; });
        // Most recently missed first — that's the one a student still cares about.
        buckets.past = buckets.all
          .filter(function (x) { return daysFromToday(x._due) < 0; })
          .reverse();

        renderSubtitle();
        show('upcoming');

        if (footerEl) {
          footerEl.textContent = data.updated_at
            ? 'Assignment feed updated ' +
              fmt(new Date(data.updated_at), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + '.'
            : '';
        }
      })
      .catch(function (err) {
        if (subtitleEl) subtitleEl.textContent = '';
        if (tabsEl) tabsEl.innerHTML = '';
        listEl.innerHTML = '<div class="error">' + esc(err.message) + '</div>';
      });
  }

  global.Assignments = {
    mount: mount,
    // exported for the test page
    _internals: { parseLocalDate: parseLocalDate, titleDueDate: titleDueDate, dueDateOf: dueDateOf, dueLabel: dueLabel, cleanTitle: cleanTitle }
  };
})(window);
