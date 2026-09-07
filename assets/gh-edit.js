/* =============================================================
   gh-edit.js — shared unlock-and-save bar for the editable pages.

   Editing is gated by a GitHub fine-grained token with write access
   to this repository. GitHub verifies it on its own servers, so the
   lock is real: with no token nothing becomes editable and nothing
   can be saved. A student who finds ?edit=1 gets a LOCKED bar.

   Used by agenda/ and units/. The flex/ page and assets/app.js still
   carry their own older copies of this logic; they read the same
   browser storage, so unlocking any one of them unlocks the rest.
   ============================================================= */
(function (global) {
  "use strict";

  var OWNER = "elastres25";
  var REPO = "myBelen-page";
  var BRANCH = "main";

  /* Preferred key first; the rest are what the older pages wrote, so a
     browser already unlocked over there doesn't have to paste again. */
  var KEYS = ["mybelen-gh-key", "t6_gh_token", "flex71-gh-key"];

  var token = null;
  var dirty = false;
  var editing = false;
  var handlers = {};

  function readStoredToken() {
    for (var i = 0; i < KEYS.length; i++) {
      try {
        var v = localStorage.getItem(KEYS[i]);
        if (v) return v;
      } catch (e) { /* storage blocked */ }
    }
    return null;
  }
  function storeToken(v) {
    try { localStorage.setItem(KEYS[0], v); } catch (e) {}
  }
  function clearToken() {
    KEYS.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
  }

  /* ---------------------------------------------------------- */
  /* GitHub                                                      */
  /* ---------------------------------------------------------- */
  function api(path, options) {
    options = options || {};
    options.headers = Object.assign({
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Authorization": "Bearer " + token
    }, options.headers || {});
    return fetch("https://api.github.com/" + path, options);
  }

  function verify(t) {
    var prev = token;
    token = t;
    return api("repos/" + OWNER + "/" + REPO).then(function (r) {
      if (r.status === 401) throw new Error("Token rejected — it may be expired or mistyped.");
      if (r.status === 404) throw new Error("That token can't see this repository. It must grant access to " + OWNER + "/" + REPO + ".");
      if (!r.ok) throw new Error("GitHub returned " + r.status + ".");
      return r.json();
    }).then(function (repo) {
      // No permissions object means we can't tell; let the save report the
      // real error rather than refusing a token that would have worked.
      if (repo.permissions && !repo.permissions.push) {
        throw new Error("That token is read-only. It needs Contents: Read and write.");
      }
      return true;
    }).catch(function (e) {
      token = prev;
      throw e;
    });
  }

  function b64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "", CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return btoa(bin);
  }

  /* Commit a JSON file, re-reading its sha first so a change made
     elsewhere (or by the hourly Action) is never silently clobbered. */
  function putJSON(path, obj, message) {
    var body = JSON.stringify(obj, null, 2) + "\n";
    return api("repos/" + OWNER + "/" + REPO + "/contents/" + encodeURI(path) + "?ref=" + BRANCH)
      .then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error("Couldn't read " + path + " (HTTP " + r.status + ").");
        return r.json();
      })
      .then(function (meta) {
        var payload = { message: message, content: b64(body), branch: BRANCH };
        if (meta && meta.sha) payload.sha = meta.sha;
        return api("repos/" + OWNER + "/" + REPO + "/contents/" + encodeURI(path), {
          method: "PUT", body: JSON.stringify(payload)
        });
      })
      .then(function (r) {
        if (r.ok) return r.json();
        return r.json().catch(function () { return {}; }).then(function (e) {
          throw new Error(e.message || ("GitHub returned " + r.status + "."));
        });
      });
  }

  /* ---------------------------------------------------------- */
  /* the bar                                                     */
  /* ---------------------------------------------------------- */
  var CSS = [
    '#ghbar{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#0d2748;color:#fff;',
    'font:13px/1.4 Arial,Helvetica,sans-serif;padding:10px 14px;display:flex;align-items:center;',
    'gap:10px;flex-wrap:wrap;box-shadow:0 -3px 14px rgba(0,0,0,.28)}',
    '#ghbar .tag{background:#c9912b;color:#131313;font-weight:700;border-radius:4px;padding:3px 8px;',
    'letter-spacing:.4px;font-size:11px}',
    '#ghbar .msg{flex:1 1 auto;min-width:120px}',
    '#ghbar .msg.err{color:#ffc4c4}#ghbar .msg.ok{color:#b9e8bd}',
    '#ghbar button{font:600 13px Arial,Helvetica,sans-serif;border:0;border-radius:6px;padding:8px 14px;',
    'cursor:pointer;background:#c9912b;color:#131313}',
    '#ghbar button.ghost{background:rgba(255,255,255,.14);color:#fff}',
    '#ghbar button:disabled{opacity:.5;cursor:not-allowed}',
    '#ghbar input[type=password]{font:13px Arial,Helvetica,sans-serif;padding:8px 10px;border-radius:6px;',
    'border:1px solid #35507a;background:#08203c;color:#fff;min-width:240px;flex:1 1 240px}',
    'body.gh-editing{padding-bottom:84px}'
  ].join("");

  function injectCSS() {
    if (document.getElementById("ghbar-css")) return;
    var s = document.createElement("style");
    s.id = "ghbar-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(label, cls, fn) {
    var b = el("button", cls, label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }
  function bar() { return document.getElementById("ghbar"); }

  function setMsg(text, kind) {
    var m = bar() && bar().querySelector(".msg");
    if (!m) return;
    m.textContent = text;
    m.className = "msg " + (kind || "");
  }

  function markDirty() {
    dirty = true;
    var s = bar() && bar().querySelector(".savebtn");
    if (s) { s.disabled = false; s.textContent = "Save to site"; }
    setMsg("Unsaved changes.", "");
  }

  function lockedBar(note, allowEntry) {
    var b = bar();
    b.innerHTML = "";
    b.appendChild(el("span", "tag", "LOCKED"));
    b.appendChild(el("span", "msg", note || "Enter your access token to edit this page."));
    if (allowEntry === false) return;

    var input = el("input");
    input.type = "password";
    input.placeholder = "GitHub token (github_pat_…)";
    input.autocomplete = "off";

    var go = btn("Unlock", "", attempt);
    function attempt() {
      var t = input.value.trim();
      if (!t) { setMsg("Paste your token first.", "err"); return; }
      go.disabled = true;
      setMsg("Checking…", "");
      verify(t).then(function () {
        storeToken(t);
        unlock();
      }).catch(function (err) {
        go.disabled = false;
        setMsg(err.message, "err");
      });
    }
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") attempt(); });

    b.appendChild(input);
    b.appendChild(go);
    setTimeout(function () { input.focus(); }, 60);
  }

  function unlockedBar() {
    var b = bar();
    b.innerHTML = "";
    b.appendChild(el("span", "tag", "EDITING"));
    b.appendChild(el("span", "msg", handlers.hint || "Make your changes, then Save."));

    var s = btn("Save to site", "savebtn", function () {
      s.disabled = true;
      setMsg("Saving…", "");
      Promise.resolve(handlers.onSave && handlers.onSave()).then(function () {
        dirty = false;
        s.textContent = "Saved";
        setMsg("Saved. Students see it in about a minute.", "ok");
      }).catch(function (err) {
        s.disabled = false;
        setMsg(err.message || String(err), "err");
      });
    });
    s.disabled = true;
    b.appendChild(s);

    b.appendChild(btn("Discard", "ghost", function () {
      if (dirty && !confirm("Throw away your unsaved changes?")) return;
      dirty = false;
      location.reload();
    }));

    b.appendChild(btn("Sign out", "ghost", function () {
      if (dirty && !confirm("You have unsaved changes. Sign out anyway?")) return;
      clearToken();
      dirty = false;
      location.href = location.pathname;
    }));
  }

  function unlock() {
    editing = true;
    document.body.classList.add("gh-editing");
    unlockedBar();
    if (handlers.onUnlock) handlers.onUnlock();
  }

  function wantsEdit() {
    return new URLSearchParams(location.search).has("edit");
  }

  /* opts: { onUnlock, onSave, hint } */
  function init(opts) {
    handlers = opts || {};
    if (!wantsEdit()) return;

    injectCSS();
    var b = el("div");
    b.id = "ghbar";
    document.body.appendChild(b);

    // Browsers partition localStorage inside an iframe, so a saved token
    // usually can't survive there. Editing belongs on the direct URL.
    if (window.top !== window.self) {
      lockedBar("Open this page in its own browser tab to edit — editing is off inside an embed.", false);
      return;
    }

    var saved = readStoredToken();
    if (saved) {
      lockedBar("Checking your saved token…");
      verify(saved).then(unlock).catch(function (err) {
        clearToken();
        lockedBar(err.message + " Please paste it again.");
      });
    } else {
      lockedBar();
    }
  }

  window.addEventListener("beforeunload", function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  global.GHEdit = {
    init: init,
    wantsEdit: wantsEdit,
    putJSON: putJSON,
    setMsg: setMsg,
    markDirty: markDirty,
    get editing() { return editing; }
  };
})(window);
