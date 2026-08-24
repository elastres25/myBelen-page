/* =============================================================
   Theology 6 Home Base — page renderer + in-browser editor.

   Content lives in JSON files, not in the HTML:
       content.json        the home page
       pages/<slug>.json   one file per sub-page
       uploads/            documents and images

   Editing is unlocked only by a GitHub fine-grained token that
   grants write access to this repository. GitHub verifies that
   token on its own servers, so the lock is real: without it,
   nothing can be saved and a refresh discards any local tinkering.
   ============================================================= */
(function(){
"use strict";

var OWNER  = "elastres25";
var REPO   = "myBelen-page";
var BRANCH = "main";                 // the branch GitHub Pages publishes
var TOKEN_KEY = "t6_gh_token";
var MAX_UPLOAD_MB = 20;

/* Links that point back into your school's Blackbaud site — an assignment,
   the gradebook — have to replace the whole browser window. Blackbaud refuses
   to be displayed inside another page, so loading one in the embed gives a
   blank box, and a new tab is wrong too because the destination IS Blackbaud.
   Add your school's domain below if it isn't one of these. */
var BLACKBAUD_HOSTS = [
  /(^|\.)myschoolapp\.com$/i,
  /(^|\.)blackbaud\.com$/i,
  /(^|\.)oncampus\.[a-z.]+$/i
];
function isBlackbaudUrl(url){
  try {
    var h = new URL(url, location.href).hostname;
    return BLACKBAUD_HOSTS.some(function(re){ return re.test(h); });
  } catch(e){ return false; }
}
/* _top replaces the whole window; _blank opens a new tab beside Blackbaud. */
function outboundTarget(url){
  return isBlackbaudUrl(url) ? "_top" : "_blank";
}

var state = {
  mode: document.body.getAttribute("data-page"),  // "home" | "sub"
  slug: null,
  file: null,
  data: null,
  editing: false,
  dirty: false,
  token: null
};

/* ---------------------------------------------------------- */
/* small helpers                                              */
/* ---------------------------------------------------------- */
function $(id){ return document.getElementById(id); }
function el(tag, cls){ var n = document.createElement(tag); if(cls) n.className = cls; return n; }
function txt(tag, cls, s){ var n = el(tag, cls); n.textContent = s; return n; }

function getPath(obj, path){
  return path.split(".").reduce(function(o,k){
    if(o == null) return undefined;
    return o[/^\d+$/.test(k) ? Number(k) : k];
  }, obj);
}
function setPath(obj, path, val){
  var keys = path.split(".");
  var last = keys.pop();
  var target = keys.reduce(function(o,k){ return o[/^\d+$/.test(k) ? Number(k) : k]; }, obj);
  target[/^\d+$/.test(last) ? Number(last) : last] = val;
}

function slugify(s){
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 40) || "page";
}
function safeName(s){
  return String(s || "file").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+/, "").slice(0, 80);
}

/* Strip internal bookkeeping keys (_new etc.) before committing. */
function clean(v){
  if(Array.isArray(v)) return v.map(clean);
  if(v && typeof v === "object"){
    var out = {};
    Object.keys(v).forEach(function(k){ if(k.charAt(0) !== "_") out[k] = clean(v[k]); });
    return out;
  }
  return v;
}

function markDirty(){
  state.dirty = true;
  var s = $("saveBtn");
  if(s){ s.disabled = false; s.textContent = "Save to site"; }
  setMsg("Unsaved changes.", "");
}

/* ---------------------------------------------------------- */
/* editable text binding                                       */
/* ---------------------------------------------------------- */
function bind(node, path, multiline){
  node.setAttribute("data-bind", path);
  node.setAttribute("data-edit", "");
  node.textContent = getPath(state.data, path) || "";
  if(state.editing) makeEditable(node, multiline);
  return node;
}

function makeEditable(node, multiline){
  node.contentEditable = "plaintext-only";
  if(node.contentEditable !== "plaintext-only") node.contentEditable = "true";

  node.addEventListener("input", function(){
    setPath(state.data, node.getAttribute("data-bind"), node.textContent);
    markDirty();
  });

  // Paste as plain text, so pasted Word/Google Docs markup can't wreck the layout.
  node.addEventListener("paste", function(e){
    e.preventDefault();
    var t = ((e.clipboardData || window.clipboardData).getData("text/plain") || "");
    if(!multiline) t = t.replace(/\s*\n\s*/g, " ");
    document.execCommand("insertText", false, t);
  });

  if(!multiline){
    node.addEventListener("keydown", function(e){
      if(e.key === "Enter"){ e.preventDefault(); node.blur(); }
    });
  }
}

/* ---------------------------------------------------------- */
/* GitHub API                                                  */
/* ---------------------------------------------------------- */
function api(path, options){
  options = options || {};
  options.headers = Object.assign({
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Authorization": "Bearer " + state.token
  }, options.headers || {});
  return fetch("https://api.github.com/" + path, options);
}

function verifyToken(t){
  var prev = state.token;
  state.token = t;
  return api("repos/" + OWNER + "/" + REPO).then(function(r){
    if(r.status === 401) throw new Error("Token rejected — it may be expired or mistyped.");
    if(r.status === 404) throw new Error("That token can't see this repository. Make sure it grants access to " + OWNER + "/" + REPO + ".");
    if(!r.ok) throw new Error("GitHub returned " + r.status + ".");
    return r.json();
  }).then(function(repo){
    if(!repo.permissions || !repo.permissions.push){
      throw new Error("That token is read-only. It needs Contents: Read and write.");
    }
    return true;
  }).catch(function(e){
    state.token = prev;
    throw e;
  });
}

/* Commit a text file, always re-reading the current sha first so a
   change made elsewhere is never silently clobbered. */
function putText(path, body, message){
  return api("repos/"+OWNER+"/"+REPO+"/contents/"+encodeURI(path)+"?ref="+BRANCH)
    .then(function(r){
      if(r.status === 404) return null;
      if(!r.ok) throw new Error("Couldn't read " + path + " (HTTP " + r.status + ").");
      return r.json();
    })
    .then(function(meta){
      var payload = { message: message, content: b64(body), branch: BRANCH };
      if(meta && meta.sha) payload.sha = meta.sha;
      return api("repos/"+OWNER+"/"+REPO+"/contents/"+encodeURI(path), {
        method: "PUT", body: JSON.stringify(payload)
      });
    })
    .then(checkOk);
}

function checkOk(r){
  if(r.ok) return r.json();
  return r.json().catch(function(){ return {}; }).then(function(e){
    throw new Error(e.message || ("GitHub returned " + r.status + "."));
  });
}

function b64(str){
  var bytes = new TextEncoder().encode(str);
  return bytesToB64(bytes);
}
function bytesToB64(bytes){
  var bin = "", CH = 0x8000;
  for(var i = 0; i < bytes.length; i += CH){
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

/* Upload a document or image into uploads/ and return its path. */
function uploadFile(file){
  var mb = file.size / (1024*1024);
  if(mb > MAX_UPLOAD_MB){
    return Promise.reject(new Error(
      "That file is " + mb.toFixed(1) + " MB. Keep uploads under " + MAX_UPLOAD_MB + " MB — " +
      "for anything bigger, put it in Google Drive and paste the link instead."));
  }
  return new Promise(function(resolve, reject){
    var reader = new FileReader();
    reader.onerror = function(){ reject(new Error("Couldn't read that file.")); };
    reader.onload = function(){
      var stamp = new Date().toISOString().slice(0,10);
      var path  = "uploads/" + stamp + "-" + safeName(file.name);
      var data  = bytesToB64(new Uint8Array(reader.result));
      api("repos/"+OWNER+"/"+REPO+"/contents/"+encodeURI(path), {
        method: "PUT",
        body: JSON.stringify({ message: "Upload " + file.name, content: data, branch: BRANCH })
      }).then(checkOk).then(function(){ resolve(path); }).catch(reject);
    };
    reader.readAsArrayBuffer(file);
  });
}

/* Hidden file picker, reused for every upload button. */
function pickFile(accept, onPath){
  var input = el("input");
  input.type = "file";
  if(accept) input.accept = accept;
  input.style.display = "none";
  document.body.appendChild(input);
  input.addEventListener("change", function(){
    var f = input.files && input.files[0];
    document.body.removeChild(input);
    if(!f) return;
    setMsg("Uploading " + f.name + "…", "");
    uploadFile(f).then(function(path){
      setMsg("Uploaded " + f.name + ". Remember to Save.", "ok");
      onPath(path, f);
    }).catch(function(err){ setMsg(err.message, "err"); });
  });
  input.click();
}

/* ---------------------------------------------------------- */
/* shared edit controls                                        */
/* ---------------------------------------------------------- */
function btn(label, title, fn, cls){
  var b = el("button", cls);
  b.type = "button"; b.textContent = label; if(title) b.title = title;
  b.addEventListener("click", function(e){ e.preventDefault(); e.stopPropagation(); fn(); });
  return b;
}

function addBtn(label, fn){
  var b = btn(label, "", fn);
  b.className = "addbtn";
  return b;
}

/* Up / Down / Delete for an item in an array. */
function tools(arr, i, rerender, center, extra){
  var wrap = el("div", "tools" + (center ? " center" : ""));
  var up = btn("↑", "Move up", function(){
    var t = arr[i-1]; arr[i-1] = arr[i]; arr[i] = t; markDirty(); rerender();
  });
  if(i === 0) up.disabled = true;
  var down = btn("↓", "Move down", function(){
    var t = arr[i+1]; arr[i+1] = arr[i]; arr[i] = t; markDirty(); rerender();
  });
  if(i >= arr.length - 1) down.disabled = true;

  wrap.appendChild(up);
  wrap.appendChild(down);
  (extra || []).forEach(function(b){ wrap.appendChild(b); });
  wrap.appendChild(btn("Delete", "Remove this", function(){
    if(!confirm("Delete this item?")) return;
    arr.splice(i, 1); markDirty(); rerender();
  }, "del"));
  return wrap;
}

/* A labelled text input wired to a path in the data. */
function field(label, value, placeholder, onInput){
  var row = el("div", "urlrow");
  row.appendChild(txt("label", "", label));
  var inp = el("input");
  inp.type = "text";
  inp.value = value || "";
  inp.placeholder = placeholder || "";
  inp.addEventListener("input", function(){ onInput(inp.value); markDirty(); });
  inp.addEventListener("click", function(e){ e.stopPropagation(); });
  row.appendChild(inp);
  return row;
}

/* An icon slot that accepts either a typed glyph/emoji or an uploaded image. */
function iconSlot(node, textPath, imageUrl){
  if(imageUrl){
    var img = el("img");
    img.src = imageUrl;
    img.alt = "";
    node.appendChild(img);
  } else {
    bind(node, textPath);
  }
  return node;
}

/* ---------------------------------------------------------- */
/* HOME PAGE                                                   */
/* ---------------------------------------------------------- */
function renderHome(){
  var d = state.data;

  // hero
  var hero = $("hero");
  if(d.hero.image){
    hero.classList.add("has-photo");
    hero.style.backgroundImage = "url('" + d.hero.image + "')";
  } else {
    hero.classList.remove("has-photo");
    hero.style.backgroundImage = "";
  }
  var mark = $("heroMark");
  mark.innerHTML = "";
  iconSlot(mark, "hero.mark", d.hero.markImage);

  bindStatic();
  renderQuickLinks();
  renderAnnouncements();
  renderWeek();
  renderVision();

  if(state.editing) renderHeroTools();
  document.body.classList.toggle("editing", state.editing);
}

function bindStatic(){
  Array.prototype.forEach.call(document.querySelectorAll("[data-bind]"), function(n){
    if(n.closest("#quicklinks,#announcements,#weeklist,#vision,#blocks")) return;
    n.textContent = getPath(state.data, n.getAttribute("data-bind")) || "";
    if(state.editing) makeEditable(n, n.hasAttribute("data-multiline"));
  });
}

function renderHeroTools(){
  var host = $("heroTools");
  if(!host) return;
  host.innerHTML = "";
  var row = el("div", "addrow");
  row.style.justifyContent = "center";
  row.appendChild(addBtn(state.data.hero.image ? "Change banner photo" : "Upload banner photo", function(){
    pickFile("image/*", function(path){
      state.data.hero.image = path; markDirty(); renderHome();
    });
  }));
  if(state.data.hero.image){
    row.appendChild(addBtn("Remove photo", function(){
      state.data.hero.image = ""; markDirty(); renderHome();
    }));
  }
  row.appendChild(addBtn(state.data.hero.markImage ? "Change logo" : "Upload logo", function(){
    pickFile("image/*", function(path){
      state.data.hero.markImage = path; markDirty(); renderHome();
    });
  }));
  if(state.data.hero.markImage){
    row.appendChild(addBtn("Remove logo", function(){
      state.data.hero.markImage = ""; markDirty(); renderHome();
    }));
  }
  host.appendChild(row);
}

function renderQuickLinks(){
  var wrap = $("quicklinks");
  wrap.innerHTML = "";
  var list = state.data.quicklinks || [];

  list.forEach(function(item, i){
    var a = el("a", "quick");

    if(item.kind === "url"){
      // Outside links open beside Blackbaud; Blackbaud's own pages take over.
      a.href = item.url || "#";
      a.target = outboundTarget(item.url);
      if(a.target === "_blank") a.rel = "noopener";
    } else {
      // Internal sub-page: same frame, so it stays inside the embed.
      a.href = "page.html?p=" + encodeURIComponent(item.page || "");
    }
    if(state.editing) a.addEventListener("click", function(e){ e.preventDefault(); });

    var icon = el("span", "icon");
    iconSlot(icon, "quicklinks." + i + ".icon", item.iconImage);

    var mid = el("span");
    mid.appendChild(bind(el("strong"), "quicklinks." + i + ".title"));
    mid.appendChild(bind(el("small"), "quicklinks." + i + ".blurb"));

    a.appendChild(icon);
    a.appendChild(mid);
    a.appendChild(txt("span", "arrow", "›"));

    if(state.editing){
      var box = el("div", "urlrow");
      box.style.flexDirection = "column";
      box.style.alignItems = "stretch";

      var kindRow = el("div", "urlrow");
      kindRow.appendChild(txt("label", "", "OPENS"));
      var sel = el("select");
      [["page","A page on this site"],["url","An outside link / email"]].forEach(function(o){
        var opt = el("option"); opt.value = o[0]; opt.textContent = o[1];
        if((item.kind || "page") === o[0]) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", function(){
        item.kind = sel.value;
        if(item.kind === "page" && !item.page){
          item.page = slugify(item.title) + "-" + Math.random().toString(36).slice(2,6);
          item._new = true;
        }
        markDirty(); renderQuickLinks();
      });
      sel.addEventListener("click", function(e){ e.stopPropagation(); });
      kindRow.appendChild(sel);
      box.appendChild(kindRow);

      if(item.kind === "url"){
        box.appendChild(field("LINK", item.url, "https://…  or  mailto:you@school.org", function(v){ item.url = v; }));
      } else {
        var note = el("div", "urlrow");
        note.appendChild(txt("label", "", "PAGE"));
        var open = addBtn("Open “" + (item.title || "this page") + "” to edit it", function(){
          if(state.dirty && !confirm("You have unsaved changes on this page. Leave anyway?")) return;
          state.dirty = false;
          location.href = "page.html?p=" + encodeURIComponent(item.page) + "&edit=1";
        });
        if(item._new) open.textContent = "Save first, then this page opens";
        if(item._new) open.disabled = true;
        note.appendChild(open);
        box.appendChild(note);
      }

      box.appendChild(tools(state.data.quicklinks, i, renderQuickLinks, false, [
        btn("Upload icon", "Use a picture instead of a symbol", function(){
          pickFile("image/*", function(path){ item.iconImage = path; markDirty(); renderQuickLinks(); });
        }),
        item.iconImage ? btn("Clear icon", "Back to a typed symbol", function(){
          item.iconImage = ""; markDirty(); renderQuickLinks();
        }) : null
      ].filter(Boolean)));

      a.appendChild(box);
    }
    wrap.appendChild(a);
  });

  if(state.editing){
    var add = el("div");
    add.style.gridColumn = "1 / -1";
    add.appendChild(addBtn("+ Add a box", function(){
      var title = "New Section";
      state.data.quicklinks.push({
        icon: "✦", iconImage: "", title: title,
        blurb: "Describe what students will find here.",
        kind: "page",
        page: slugify(title) + "-" + Math.random().toString(36).slice(2,6),
        url: "", _new: true
      });
      markDirty(); renderQuickLinks();
    }));
    wrap.appendChild(add);
  }
}

function renderAnnouncements(){
  var wrap = $("announcements");
  wrap.innerHTML = "";
  var list = state.data.main.items || [];
  list.forEach(function(item, i){
    var row = el("div", "announcement");
    row.appendChild(bind(el("div", "bubble"), "main.items." + i + ".icon"));
    var body = el("div");
    body.appendChild(bind(el("b"), "main.items." + i + ".label"));
    body.appendChild(bind(el("p"), "main.items." + i + ".text", true));
    if(state.editing) body.appendChild(tools(list, i, renderAnnouncements));
    row.appendChild(body);
    wrap.appendChild(row);
  });
  if(state.editing){
    wrap.appendChild(addBtn("+ Add announcement", function(){
      list.push({ icon: "📌", label: "New item", text: "Details here." });
      markDirty(); renderAnnouncements();
    }));
  }
}

function renderWeek(){
  var ul = $("weeklist");
  ul.innerHTML = "";
  var list = state.data.week.items || [];
  list.forEach(function(_, i){
    var li = el("li");
    li.appendChild(bind(el("span"), "week.items." + i));
    if(state.editing) li.appendChild(tools(list, i, renderWeek));
    ul.appendChild(li);
  });
  if(state.editing){
    var li = el("li");
    li.style.listStyle = "none";
    li.style.marginLeft = "-20px";
    li.appendChild(addBtn("+ Add line", function(){
      list.push("New item"); markDirty(); renderWeek();
    }));
    ul.appendChild(li);
  }
}

function renderVision(){
  var wrap = $("vision");
  wrap.innerHTML = "";
  var list = state.data.vision.items || [];
  list.forEach(function(_, i){
    var d = el("div");
    d.appendChild(bind(el("div", "vicon"), "vision.items." + i + ".icon"));
    d.appendChild(bind(el("strong"), "vision.items." + i + ".label"));
    if(state.editing) d.appendChild(tools(list, i, renderVision, true));
    wrap.appendChild(d);
  });
  if(state.editing && list.length < 4){
    var add = el("div");
    add.appendChild(addBtn("+ Add", function(){
      list.push({ icon: "✦", label: "New value" }); markDirty(); renderVision();
    }));
    wrap.appendChild(add);
  }
}

/* ---------------------------------------------------------- */
/* SUB-PAGE                                                    */
/* ---------------------------------------------------------- */
function fileKind(url){
  var u = String(url || "").toLowerCase();
  if(/^https?:\/\//.test(u) && !/\.(pdf|docx?|pptx?|xlsx?|png|jpe?g|gif|webp)$/.test(u)) return "LINK";
  if(/^mailto:/.test(u)) return "MAIL";
  var m = u.match(/\.([a-z0-9]+)$/);
  if(!m) return "FILE";
  var e = m[1];
  if(e === "pdf") return "PDF";
  if(e === "doc" || e === "docx") return "DOC";
  if(e === "ppt" || e === "pptx") return "PPT";
  if(e === "xls" || e === "xlsx") return "XLS";
  if(["png","jpg","jpeg","gif","webp","heic"].indexOf(e) >= 0) return "IMG";
  return e.toUpperCase().slice(0, 4);
}

function renderSub(){
  bindStatic();
  var wrap = $("blocks");
  wrap.innerHTML = "";
  var blocks = state.data.blocks || [];

  if(!blocks.length && !state.editing){
    wrap.appendChild(txt("p", "emptynote", "Nothing posted here yet — check back soon."));
  }

  blocks.forEach(function(block, i){
    var card = el("section", "card block");

    if(block.heading !== undefined){
      card.appendChild(bind(el("h3"), "blocks." + i + ".heading"));
      card.appendChild(el("div", "titleline"));
    }

    if(block.type === "text"){
      card.appendChild(bind(txt("p", "body", ""), "blocks." + i + ".body", true));
    }

    else if(block.type === "files"){
      var ul = el("ul", "filelist");
      (block.items || []).forEach(function(item, j){
        var li = el("li");
        var a = el("a", "filerow");
        a.href = item.url || "#";
        a.target = outboundTarget(item.url);
        if(a.target === "_blank") a.rel = "noopener";
        if(state.editing) a.addEventListener("click", function(e){ e.preventDefault(); });

        a.appendChild(txt("span", "fileicon", fileKind(item.url)));
        var mid = el("span");
        mid.appendChild(bind(el("span", "fname"), "blocks." + i + ".items." + j + ".label"));
        mid.appendChild(bind(el("small", "fmeta"), "blocks." + i + ".items." + j + ".note"));
        a.appendChild(mid);
        a.appendChild(txt("span", "go", "↗"));
        li.appendChild(a);

        if(state.editing){
          li.appendChild(field("LINK", item.url, "uploads/… or https://…", function(v){ item.url = v; }));
          li.appendChild(tools(block.items, j, renderSub, false, [
            btn("Upload file", "Replace with an uploaded document", function(){
              pickFile("", function(path, f){
                item.url = path;
                if(!item.label || item.label === "New file") item.label = f.name.replace(/\.[^.]+$/, "");
                markDirty(); renderSub();
              });
            })
          ]));
        }
        ul.appendChild(li);
      });
      card.appendChild(ul);

      if(state.editing){
        var row = el("div", "addrow");
        row.appendChild(addBtn("⬆ Upload a document", function(){
          pickFile("", function(path, f){
            block.items.push({ label: f.name.replace(/\.[^.]+$/, ""), note: "", url: path });
            markDirty(); renderSub();
          });
        }));
        row.appendChild(addBtn("+ Add a web link", function(){
          block.items.push({ label: "New link", note: "", url: "https://" });
          markDirty(); renderSub();
        }));
        card.appendChild(row);
      }
    }

    else if(block.type === "assignments"){
      var aul = el("ul", "filelist");
      (block.items || []).forEach(function(item, j){
        var base = "blocks." + i + ".items." + j;
        var li = el("li");
        var a = el("a", "filerow assignment");
        a.href = item.url || "#";
        // A Blackbaud assignment link replaces the whole window, landing the
        // student on the real assignment page rather than in a dead frame.
        a.target = outboundTarget(item.url);
        if(a.target === "_blank") a.rel = "noopener";
        if(state.editing) a.addEventListener("click", function(e){ e.preventDefault(); });

        a.appendChild(txt("span", "fileicon assign", "\u2713"));
        var amid = el("span");
        amid.appendChild(bind(el("span", "fname"), base + ".title"));
        amid.appendChild(bind(el("small", "fmeta"), base + ".note"));
        a.appendChild(amid);

        var right = el("span", "right");
        right.appendChild(bind(el("span", "duebadge"), base + ".due"));
        right.appendChild(txt("span", "go", "\u2197"));
        a.appendChild(right);
        li.appendChild(a);

        if(state.editing){
          li.appendChild(field("BLACKBAUD LINK", item.url,
            "Paste the assignment's web address from Blackbaud",
            function(v){ item.url = v; }));
          li.appendChild(tools(block.items, j, renderSub));
        }
        aul.appendChild(li);
      });
      card.appendChild(aul);

      if(!block.items.length && !state.editing){
        card.appendChild(txt("p", "emptynote", "No assignments posted right now."));
      }
      if(state.editing){
        var arow = el("div", "addrow");
        arow.appendChild(addBtn("+ Add an assignment", function(){
          block.items.push({ title:"New assignment", due:"", note:"", url:"" });
          markDirty(); renderSub();
        }));
        card.appendChild(arow);
      }
    }

    else if(block.type === "image"){
      if(block.url){
        var img = el("img", "blockimg");
        img.src = block.url; img.alt = block.caption || "";
        card.appendChild(img);
      } else if(state.editing){
        card.appendChild(txt("p", "emptynote", "No picture chosen yet."));
      }
      card.appendChild(bind(txt("p", "caption", ""), "blocks." + i + ".caption"));
      if(state.editing){
        var r = el("div", "addrow");
        r.appendChild(addBtn(block.url ? "Change picture" : "⬆ Upload picture", function(){
          pickFile("image/*", function(path){ block.url = path; markDirty(); renderSub(); });
        }));
        card.appendChild(r);
      }
    }

    if(state.editing) card.appendChild(tools(blocks, i, renderSub));
    wrap.appendChild(card);
  });

  if(state.editing){
    var add = el("div", "addrow");
    add.appendChild(addBtn("+ Text section", function(){
      blocks.push({ type:"text", heading:"New section", body:"Write here." });
      markDirty(); renderSub();
    }));
    add.appendChild(addBtn("+ Files & links section", function(){
      blocks.push({ type:"files", heading:"Documents", items:[] });
      markDirty(); renderSub();
    }));
    add.appendChild(addBtn("+ Assignments section", function(){
      blocks.push({ type:"assignments", heading:"Assignments", items:[] });
      markDirty(); renderSub();
    }));
    add.appendChild(addBtn("+ Picture", function(){
      blocks.push({ type:"image", url:"", caption:"" });
      markDirty(); renderSub();
    }));
    wrap.appendChild(add);
  }

  document.body.classList.toggle("editing", state.editing);
}

function render(){
  if(state.mode === "home") renderHome(); else renderSub();
}

/* ---------------------------------------------------------- */
/* SAVE                                                        */
/* ---------------------------------------------------------- */
var STARTER = {
  title: "New Page",
  subtitle: "",
  blocks: [{ type:"files", heading:"Documents", items:[] }]
};

function save(){
  var b = $("saveBtn");
  b.disabled = true;
  setMsg("Saving…", "");

  // Any brand-new sub-pages get their file created first, so a link
  // on the home page never points at something that isn't there yet.
  var pending = [];
  if(state.mode === "home"){
    (state.data.quicklinks || []).forEach(function(q){
      if(q.kind === "page" && q._new){
        var starter = Object.assign({}, STARTER, { title: q.title, subtitle: q.blurb });
        pending.push(
          putText("pages/" + q.page + ".json",
                  JSON.stringify(starter, null, 2) + "\n",
                  "Create page: " + q.title)
            .then(function(){ delete q._new; })
        );
      }
    });
  }

  Promise.all(pending)
    .then(function(){
      return putText(state.file,
                     JSON.stringify(clean(state.data), null, 2) + "\n",
                     "Update " + state.file);
    })
    .then(function(){
      state.dirty = false;
      b.textContent = "Saved";
      setMsg("Saved. Students see it in about a minute.", "ok");
      if(state.mode === "home") renderQuickLinks();   // new pages are now openable
    })
    .catch(function(err){
      b.disabled = false;
      setMsg(err.message, "err");
    });
}

/* ---------------------------------------------------------- */
/* EDIT BAR                                                    */
/* ---------------------------------------------------------- */
function setMsg(text, kind){
  var m = $("editmsg");
  if(!m) return;
  m.textContent = text;
  m.className = "msg grow " + (kind || "");
}

function lockedBar(bar, note, allowEntry){
  bar.innerHTML = "";
  bar.appendChild(txt("span", "tag", "LOCKED"));
  var msg = txt("span", "msg grow", note || "Enter your access token to edit this page.");
  msg.id = "editmsg";
  bar.appendChild(msg);
  if(allowEntry === false) return;

  var input = el("input");
  input.type = "password";
  input.placeholder = "GitHub token (github_pat_…)";
  input.autocomplete = "off";
  var go = btn("Unlock", "", attempt);

  function attempt(){
    var t = input.value.trim();
    if(!t){ setMsg("Paste your token first.", "err"); return; }
    go.disabled = true;
    setMsg("Checking…", "");
    verifyToken(t).then(function(){
      try { localStorage.setItem(TOKEN_KEY, t); } catch(e){}
      unlock();
    }).catch(function(err){
      go.disabled = false;
      setMsg(err.message, "err");
    });
  }
  input.addEventListener("keydown", function(e){ if(e.key === "Enter") attempt(); });

  bar.appendChild(input);
  bar.appendChild(go);
  setTimeout(function(){ input.focus(); }, 60);
}

function unlockedBar(bar){
  bar.innerHTML = "";
  bar.appendChild(txt("span", "tag", "EDITING"));
  var msg = txt("span", "msg grow", "Click any text to change it.");
  msg.id = "editmsg";
  bar.appendChild(msg);

  var s = btn("Save to site", "", save);
  s.id = "saveBtn";
  s.disabled = true;
  bar.appendChild(s);

  bar.appendChild(btn("Discard", "Reload without saving", function(){
    if(state.dirty && !confirm("Throw away your unsaved changes?")) return;
    state.dirty = false;
    location.reload();
  }, "ghost"));

  bar.appendChild(btn("Sign out", "Forget the token on this device", function(){
    if(state.dirty && !confirm("You have unsaved changes. Sign out anyway?")) return;
    try { localStorage.removeItem(TOKEN_KEY); } catch(e){}
    state.dirty = false;
    location.href = location.pathname;
  }, "ghost"));
}

function unlock(){
  state.editing = true;
  unlockedBar($("editbar"));
  render();
  setMsg("Click any text to change it.", "");
}

/* ---------------------------------------------------------- */
/* LOAD + BOOT                                                 */
/* ---------------------------------------------------------- */
var FALLBACK_HOME = {
  hero:{mark:"✦",markImage:"",image:"",title:"Theology 6",subtitle:"Home Base · Finding God in All Things"},
  quicklinks:[], main:{heading:"Today in Theology",items:[]},
  week:{heading:"This Week",items:[]}, vision:{heading:"Our Class Vision",items:[]},
  quote:"“Find God in all things.” — St. Ignatius of Loyola"
};

function load(){
  if(state.mode === "home"){
    state.file = "content.json";
  } else {
    var raw = new URLSearchParams(location.search).get("p") || "";
    state.slug = raw.replace(/[^a-z0-9-]/gi, "").toLowerCase();
    if(!state.slug){
      showError("No page was specified.");
      return Promise.resolve();
    }
    state.file = "pages/" + state.slug + ".json";
  }

  return fetch(state.file + "?t=" + Date.now(), { cache: "no-store" })
    .then(function(r){
      if(!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function(json){
      state.data = json;
      if(state.mode === "sub" && !Array.isArray(state.data.blocks)) state.data.blocks = [];
      if(state.mode === "sub") document.title = (state.data.title || "Page") + " · Theology 6";
    })
    .catch(function(err){
      if(state.mode === "home"){
        state.data = FALLBACK_HOME;
        showError("Couldn't load content.json (" + err.message + "). The file may still be publishing.");
      } else {
        state.data = { title: "Page not found", subtitle: "", blocks: [] };
        showError("This page's content file (" + state.file + ") isn't there yet. " +
                  "If you just created this box on the home page, give it a minute and refresh.");
      }
    })
    .then(render);
}

function showError(m){
  var box = $("loaderr");
  if(!box) return;
  box.style.display = "block";
  box.textContent = m;
}

function wantsEdit(){
  return new URLSearchParams(location.search).has("edit");
}

load().then(function(){
  if(!wantsEdit()) return;

  var bar = el("div");
  bar.id = "editbar";
  document.body.appendChild(bar);

  // Browsers partition localStorage inside an iframe, so a saved token
  // usually can't survive there. Editing belongs on the direct URL.
  if(window.top !== window.self){
    lockedBar(bar, "Open this page in its own browser tab to edit — editing is turned off inside an embed.", false);
    return;
  }

  var saved = null;
  try { saved = localStorage.getItem(TOKEN_KEY); } catch(e){}

  if(saved){
    lockedBar(bar, "Checking your saved token…");
    verifyToken(saved).then(unlock).catch(function(err){
      try { localStorage.removeItem(TOKEN_KEY); } catch(e){}
      lockedBar(bar, err.message + " Please paste it again.");
    });
  } else {
    lockedBar(bar);
  }
});

window.addEventListener("beforeunload", function(e){
  if(state.dirty){ e.preventDefault(); e.returnValue = ""; }
});

})();
