"use strict";
/* Plot: notes, checklists, cards and a blueprint board.
   Everything stays on this device: notes are kept in this browser's own storage (IndexedDB) and nothing is ever sent anywhere.
   One set of notes, three ways to look at them: Notes (folders, a list by date, the note beside it), Cards (colours, pinned first,
   ticked on the card) and Board (an endless blueprint: drag notes about, join them with arrows, group them inside red-line frames). */
const VERSION = "1.0.0";
const LARO_ORIGIN = "https://laro.rorymack.workers.dev";   /* the only place notes may be moved in from (a one-time move) */
const KEEP_DAYS = 30;
const COLORS = [["", "Paper"], ["yellow", "Yellow"], ["green", "Green"], ["blue", "Blue"], ["pink", "Pink"], ["sand", "Sand"], ["lilac", "Lilac"], ["clay", "Clay"]];
const VIEWS = [["notes", "Notes", "list"], ["cards", "Cards", "cards"], ["board", "Board", "board"]];
const SMART = [
  ["all", "All notes", "note", () => true],
  ["pinned", "Pinned", "pin", n => !!n.pinned],
  ["todo", "To do", "check", n => openItems(n).length > 0],
  ["daily", "Today pages", "calendar", n => !!n.daily],
];

/* ---- small helpers */
const $ = (s, r = document) => r.querySelector(s);
const now = () => new Date().toISOString();
const uid = p => (p || "n") + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const plural = (n, w, ws) => `${n} ${n === 1 ? w : ws || w + "s"}`;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } return null; };
const clone = o => JSON.parse(JSON.stringify(o));
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "value") el.value = v;
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  const add = c => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c.nodeType ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}
const SVGNS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); return e; };
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="2.6"/>',
  cards: '<rect x="3.5" y="3.5" width="7.5" height="10" rx="1.5"/><rect x="13" y="3.5" width="7.5" height="6" rx="1.5"/><rect x="3.5" y="15.5" width="7.5" height="5" rx="1.5"/><rect x="13" y="11.5" width="7.5" height="9" rx="1.5"/>',
  board: '<path d="M3 8h18M3 16h18M8 3v18M16 3v18"/>',
  note: '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M15 3.5V7h3.5M9 11h6M9 14.5h6M9 18h3.5"/>',
  sticky: '<path d="M4.5 4.5h15v9.5l-5.5 5.5H4.5z"/><path d="M14 19.5V14h5.5"/>',
  pin: '<path d="M9 3.5h6l-1 6 3 3H7l3-3z"/><path d="M12 12.5v8"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  more: '<path d="M5.5 12h.01M12 12h.01M18.5 12h.01" stroke-width="3"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13.5h9l1-13.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>', fwd: '<path d="M9 5l7 7-7 7"/>',
  folder: '<path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
  frame: '<path d="M7 3v18M17 3v18M3 7h18M3 17h18"/>', fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  open: '<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V7.5A1.5 1.5 0 0 1 5.5 6H10"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>', upload: '<path d="M12 15.5V4.5M7 9l5-5 5 5M5 20h14"/>',
  undo: '<path d="M9 14L4.5 9.5 9 5"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.7 0-1 .8-1.6 1.8-1.6h2a4 4 0 0 0 4-4c0-3.9-3.8-7-8.5-7z"/><path d="M7.8 11h.01M10 7.5h.01M14.3 7.5h.01" stroke-width="2.6"/>',
  hash: '<path d="M9.5 4L8 20M16 4l-1.5 16M4.5 9h15.5M4 15h15.5"/>',
  arrow: '<path d="M4 18c5 0 7-12 15-12"/><path d="M15 3.5l4 2.5-2.5 4"/>',
};
function icon(name) {
  const s = svgEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", class: "i i-" + name, fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round" });
  s.innerHTML = ICONS[name] || ""; return s;
}
function logo(size = 26) {
  const s = svgEl("svg", { viewBox: "0 0 32 32", width: size, height: size, class: "logo", "aria-hidden": "true" });
  s.innerHTML = '<rect width="32" height="32" rx="8" class="logo-bg"/><path d="M7 6.5h13.5L25 11v14.5H7z" class="logo-sheet"/><path d="M20.5 6.5V11H25z" class="logo-fold"/><path d="M10.5 13l6-2 4.5 3.5-1.5 6H12z" class="logo-line"/>';
  return s;
}

/* ---- storage: this browser's IndexedDB, nothing else */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      let r; try { r = indexedDB.open("plot", 1); } catch (e) { return rej(e); }
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains("notes")) d.createObjectStore("notes", { keyPath: "id" }); if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta"); };
      r.onsuccess = () => { this.db = r.result; this.db.onversionchange = () => { this.db.close(); location.reload(); }; res(); };
      r.onerror = () => rej(r.error || new Error("Storage isn't available"));
      r.onblocked = () => rej(new Error("Close Plot's other windows and open it again"));
    });
  },
  req(store, mode, fn) {
    return new Promise((res, rej) => { const t = this.db.transaction(store, mode), q = fn(t.objectStore(store)); t.oncomplete = () => res(q ? q.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("Couldn't save")); });
  },
  all() { return this.req("notes", "readonly", s => s.getAll()); },
  get(id) { return this.req("notes", "readonly", s => s.get(id)); },
  put(n) { return this.req("notes", "readwrite", s => s.put(n)); },
  del(id) { return this.req("notes", "readwrite", s => s.delete(id)); },
  meta(k) { return this.req("meta", "readonly", s => s.get(k)); },
  setMeta(k, v) { return this.req("meta", "readwrite", s => s.put(v, k)); },
};
/* other Plot windows on this device (the installed app and a browser tab) hear about each change */
const BC = "BroadcastChannel" in self ? new BroadcastChannel("plot") : null;

/* ---- state */
const P = {
  notes: new Map(), folders: [], set: { theme: "system" }, timers: new Map(), sc: {},
  view: ["notes", "cards", "board"].includes(ls("plot-view")) ? ls("plot-view") : "notes",
  f: "all", tag: null, q: "", sel: null, showEd: false, focus: null, cvSel: null, cam: null,
  lastColor: "yellow", doneOpen: false, keyOff: ls("plot-key") === "off", bip: null, ready: false,
};
function cleanNote(o) {
  o = o && typeof o === "object" ? o : {};
  const s = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
  const num = v => typeof v === "number" && isFinite(v) ? Math.round(v) : undefined;
  const n = {
    id: s(o.id, 60) || uid(), kind: o.kind === "frame" ? "frame" : "note", title: s(o.title, 300), body: s(o.body, 200000),
    items: Array.isArray(o.items) ? o.items.filter(i => i && typeof i === "object").slice(0, 1000).map(i => Object.assign({ id: s(i.id, 40) || uid("i"), t: s(i.t, 4000), done: !!i.done },
      i.from ? { from: s(i.from, 10) } : {}, i.moved ? { moved: s(i.moved, 10) } : {})) : [],
    color: COLORS.some(c => c[0] === o.color) ? o.color : "", pinned: !!o.pinned,
    links: Array.isArray(o.links) ? o.links.filter(x => typeof x === "string").slice(0, 60) : [],
    created: s(o.created, 40) || now(), updated: s(o.updated, 40) || now(),
  };
  for (const k of ["x", "y", "w", "h"]) { const v = num(o[k]); if (v !== undefined) n[k] = v; }
  if (typeof o.folder === "string") n.folder = o.folder.slice(0, 60);
  if (typeof o.daily === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.daily)) n.daily = o.daily;
  if (typeof o.deleted === "string") n.deleted = o.deleted.slice(0, 40);
  return n;
}
const isEmpty = n => !String(n.title || "").trim() && !String(n.body || "").trim() && !(n.items || []).some(i => String(i.t || "").trim());
const openItems = n => (n.items || []).filter(i => !i.done && String(i.t || "").trim());
const live = () => [...P.notes.values()].filter(n => !n.deleted);
const textOf = n => [n.title, n.body, ...(n.items || []).map(i => i.t)].filter(Boolean).join("\n");
const plainOf = n => [n.title, n.body, ...(n.items || []).filter(i => String(i.t || "").trim()).map(i => (i.done ? "✓ " : "• ") + i.t)].filter(x => String(x || "").trim()).join("\n");
const firstLine = s => (String(s || "").split("\n").map(x => x.trim()).find(Boolean) || "");
function titleOf(n) {
  if (n.kind === "frame") return "Frame: " + (n.title || "untitled");
  return String(n.title || "").trim() || firstLine(n.body) || ((n.items || []).find(i => String(i.t || "").trim()) || {}).t || "New note";
}
function snippetOf(n) {
  const lines = String(n.body || "").split("\n").map(x => x.trim()).filter(Boolean);
  const rest = String(n.title || "").trim() ? lines : lines.slice(1);
  if (rest.length) return rest[0];
  const open = openItems(n);
  if (open.length && (String(n.title || "").trim() || lines.length)) return "☐ " + open[0].t;
  if (open.length > 1) return "☐ " + open[1].t;
  return "No more text";
}
function tagsOf(n) {
  const out = [], re = /(?:^|[\s(])#([A-Za-z][\w-]{1,30})/g, t = textOf(n); let m;
  while ((m = re.exec(t))) { const g = m[1].toLowerCase(); if (!out.includes(g)) out.push(g); }
  return out;
}
const folderName = id => (P.folders.find(f => f.id === id) || {}).name || "";
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function when(iso) {
  if (!iso) return ""; const d = new Date(iso), nw = new Date(); if (isNaN(d)) return "";
  const days = Math.floor((new Date(nw.toDateString()) - new Date(d.toDateString())) / 864e5);
  if (days <= 0) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: d.getFullYear() === nw.getFullYear() ? undefined : "numeric" });
}
const whenLong = iso => { const d = new Date(iso); if (isNaN(d)) return ""; return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); };
function groupsOf(list) {
  const out = new Map(), nw = new Date(), today = new Date(nw.toDateString());
  const put = (g, n) => { if (!out.has(g)) out.set(g, []); out.get(g).push(n); };
  for (const n of list) {
    if (n.pinned && !n.deleted) { put("Pinned", n); continue; }
    const d = new Date(n.updated || n.created || 0), days = Math.floor((today - new Date(d.toDateString())) / 864e5);
    put(days <= 0 ? "Today" : days === 1 ? "Yesterday" : days < 7 ? "Previous 7 days" : days < 30 ? "Previous 30 days"
      : d.toLocaleDateString("en-GB", { month: "long", year: d.getFullYear() === nw.getFullYear() ? undefined : "numeric" }), n);
  }
  const order = ["Pinned", "Today", "Yesterday", "Previous 7 days", "Previous 30 days"];
  return [...out.entries()].sort((a, b) => { const x = order.indexOf(a[0]), y = order.indexOf(b[0]); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
}
function rich(t) {
  const out = [], re = /(^|[\s(])(#[A-Za-z][\w-]{1,30})/g; let last = 0, m; t = String(t || "");
  while ((m = re.exec(t))) { const at = m.index + m[1].length; if (at > last) out.push(t.slice(last, at)); out.push(h("span", { class: "hash" }, m[2])); last = at + m[2].length; }
  if (last < t.length) out.push(t.slice(last));
  return out;
}
function shown() {
  const q = P.q.trim().toLowerCase();
  let list = P.f === "deleted" ? [...P.notes.values()].filter(n => n.deleted) : live().filter(n => n.kind !== "frame");
  if (P.f.startsWith("fd:")) list = list.filter(n => n.folder === P.f.slice(3));
  else { const f = SMART.find(x => x[0] === P.f); if (f) list = list.filter(f[3]); }
  if (P.tag) list = list.filter(n => tagsOf(n).includes(P.tag));
  if (q) list = list.filter(n => (textOf(n) + " " + folderName(n.folder)).toLowerCase().includes(q));
  return list.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
}
const folderLabel = () => P.tag ? "#" + P.tag : P.f === "deleted" ? "Recently deleted" : P.f.startsWith("fd:") ? folderName(P.f.slice(3)) || "Folder" : (SMART.find(f => f[0] === P.f) || SMART[0])[1];

/* ---- saving: a moment after the typing stops; moving a note about doesn't count as an edit */
function later(n, ms = 450, moved) {
  if (!moved) n.updated = now();
  P.notes.set(n.id, n);
  clearTimeout(P.timers.get(n.id));
  P.timers.set(n.id, setTimeout(() => { P.timers.delete(n.id); if (isEmpty(n) && !n._saved && n.kind !== "frame") return; save(n).catch(e => toast(e.message)); }, ms));
}
async function save(n) {
  n.created = n.created || now(); n.updated = n.updated || now();
  const rec = Object.assign({}, n); delete rec._saved;
  rec.items = (n.items || []).filter(i => String(i.t || "").trim());
  await DB.put(rec); n._saved = true; P.notes.set(n.id, n);
  if (BC) BC.postMessage({ t: "put", id: n.id });
  persistOnce();
}
async function flush() {
  for (const id of [...P.timers.keys()]) {
    clearTimeout(P.timers.get(id)); P.timers.delete(id);
    const n = P.notes.get(id); if (n && !(isEmpty(n) && !n._saved && n.kind !== "frame")) await save(n).catch(() => { });
  }
}
/* a note left empty goes (as in Apple Notes) */
async function tidy(id) {
  const n = id && P.notes.get(id); if (!n || n.kind === "frame" || !isEmpty(n)) return false;
  await destroy(id); return true;
}
async function destroy(id) {
  clearTimeout(P.timers.get(id)); P.timers.delete(id);
  const n = P.notes.get(id); P.notes.delete(id);
  for (const o of P.notes.values()) if ((o.links || []).includes(id)) { o.links = o.links.filter(x => x !== id); later(o, 300, true); }
  if (n && n._saved) { await DB.del(id); if (BC) BC.postMessage({ t: "del", id }); }
  if (P.sel === id) P.sel = null;
}
let persistAsked = false;
function persistOnce() { if (persistAsked || !navigator.storage || !navigator.storage.persist) return; persistAsked = true; navigator.storage.persist().catch(() => { }); }
async function saveFolders() { await DB.setMeta("folders", P.folders); if (BC) BC.postMessage({ t: "meta" }); }
async function saveSettings() { await DB.setMeta("settings", P.set); if (BC) BC.postMessage({ t: "meta" }); }
function newNote(o) {
  return cleanNote(Object.assign({ id: uid(), created: now(), updated: now(), folder: P.f.startsWith("fd:") ? P.f.slice(3) : undefined }, o || {}));
}

/* ---- toasts, menus, dialogs */
function toast(msg, act, fn, ms = 4200) {
  const box = $("#toasts"); if (!box) return;
  const t = h("div", { class: "toast", role: "status" }, h("span", null, msg), act ? h("button", { type: "button", onclick: () => { t.remove(); fn(); } }, act) : null);
  box.append(t); setTimeout(() => t.classList.add("in"), 10);
  setTimeout(() => { t.classList.remove("in"); setTimeout(() => t.remove(), 300); }, ms);
}
let MENU = null;
function closeMenu() { if (MENU) { MENU.remove(); MENU = null; } }
function menu(btn, content) {
  closeMenu();
  const m = h("div", { class: "menu", role: "menu" }, content);
  document.body.append(m); MENU = m;
  const r = btn.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  let x = Math.min(innerWidth - mw - 8, Math.max(8, r.right - mw)), y = r.bottom + 6;
  if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 6);
  m.style.left = x + "px"; m.style.top = y + "px";
  const f = m.querySelector("button"); if (f) f.focus({ preventScroll: true });
  return m;
}
const mi = (ic, label, fn, cls) => h("button", { type: "button", class: "mi" + (cls ? " " + cls : ""), role: "menuitem", onclick: () => { closeMenu(); fn(); } }, icon(ic), label);
addEventListener("pointerdown", e => { if (MENU && !MENU.contains(e.target)) closeMenu(); }, true);
const LAYERS = [];
function layer(el, onClose, cls) {
  const scrim = h("div", { class: "scrim" + (cls ? " " + cls : "") });
  const L = { el, scrim, close() { const i = LAYERS.indexOf(L); if (i < 0) return; LAYERS.splice(i, 1); scrim.classList.remove("in"); el.classList.remove("in"); setTimeout(() => { scrim.remove(); el.remove(); }, 220); if (onClose) onClose(); } };
  scrim.addEventListener("pointerdown", () => L.close());
  document.body.append(scrim, el); LAYERS.push(L);
  requestAnimationFrame(() => { scrim.classList.add("in"); el.classList.add("in"); });
  return L;
}
const closeTop = () => { const L = LAYERS[LAYERS.length - 1]; if (L) { L.close(); return true; } return false; };
function confirmBox(title, text, ok, danger) {
  return new Promise(res => {
    let done = false; const fin = v => { if (done) return; done = true; L.close(); res(v); };
    const box = h("div", { class: "dialog small", role: "alertdialog", "aria-modal": "true", "aria-label": title },
      h("h2", null, title), text ? h("p", null, text) : null,
      h("div", { class: "dialog-f" }, h("button", { type: "button", class: "btn", onclick: () => fin(false) }, "Cancel"),
        h("button", { type: "button", class: "btn " + (danger ? "danger" : "primary"), onclick: () => fin(true) }, ok)));
    const L = layer(box, () => { if (!done) { done = true; res(false); } });
    setTimeout(() => box.querySelector(".dialog-f .btn:last-child").focus(), 30);
  });
}
function askText(title, value, ok) {
  return new Promise(res => {
    let done = false; const inp = h("input", { class: "field", value: value || "", maxlength: 60, "aria-label": title });
    const fin = v => { if (done) return; done = true; L.close(); res(v); };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); fin(inp.value.trim() || null); } });
    const box = h("div", { class: "dialog small", role: "dialog", "aria-modal": "true", "aria-label": title }, h("h2", null, title), inp,
      h("div", { class: "dialog-f" }, h("button", { type: "button", class: "btn", onclick: () => fin(null) }, "Cancel"), h("button", { type: "button", class: "btn primary", onclick: () => fin(inp.value.trim() || null) }, ok)));
    const L = layer(box, () => { if (!done) { done = true; res(null); } });
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  });
}

/* ---- the frame of the app */
function render() {
  const app = $("#app"); if (!app) return;
  app.textContent = "";
  app.className = "app v-" + P.view + (P.keyOff ? " key-off" : "");
  app.append(renderKey(), h("main", { class: "main" }, renderBar(), h("div", { class: "body", id: "body" })));
  fill();
}
function fill() {
  const b = $("#body"); if (!b) return;
  b.textContent = ""; P.cvAdd = null;
  b.append(P.view === "cards" ? viewCards() : P.view === "board" ? viewBoard() : viewNotes());
  for (const el of b.querySelectorAll("[data-keep]")) { const k = el.dataset.keep; el.scrollTop = P.sc[k] || 0; el.addEventListener("scroll", () => { P.sc[k] = el.scrollTop; }, { passive: true }); }
  const c = $(".bar-n"); if (c) c.textContent = plural(shown().length, "note");
  const t = $(".bar-h"); if (t) t.textContent = folderLabel();
  const k = $(".key"); if (k && !k.contains(document.activeElement)) k.replaceWith(renderKey());   /* counts, folders and tags up to date */
}
/* a redraw from outside (another Plot window): never while something's being typed or dragged */
function repaint() {
  const a = document.activeElement;
  if (document.querySelector(".hold, .pop") || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest("#app"))) { clearTimeout(P.rp); P.rp = setTimeout(repaint, 1200); return; }
  render();
}
function go(view) { P.view = view; ls("plot-view", view); flush(); P.showEd = false; render(); }
function pick(f, tag) { P.f = f; P.tag = tag || null; if (P.view === "board" && f === "deleted") { P.view = "notes"; ls("plot-view", "notes"); } P.showEd = false; if (innerWidth <= 820) P.keyOpen = false; render(); }
function toggleKey() { if (innerWidth <= 820) { P.keyOpen = !P.keyOpen; $("#app").classList.toggle("key-open", P.keyOpen); return; } P.keyOff = !P.keyOff; ls("plot-key", P.keyOff ? "off" : null); render(); }
function renderKey() {
  const notes = live().filter(n => n.kind !== "frame"), del = [...P.notes.values()].filter(n => n.deleted).length;
  const tags = new Map(); for (const n of notes) for (const t of tagsOf(n)) tags.set(t, (tags.get(t) || 0) + 1);
  const row = (id, label, ic, count, extra) => h("button", { type: "button", class: "k-row" + (P.f === id && !P.tag ? " on" : ""), onclick: () => pick(id) }, icon(ic), h("span", null, label), h("small", null, count || ""), extra);
  return h("aside", { class: "key" + (P.keyOpen ? " open" : ""), "aria-label": "Folders" },
    h("div", { class: "brand" }, logo(28), h("b", null, "Plot"), h("button", { type: "button", class: "ib k-hide", title: "Hide the sidebar", "aria-label": "Hide the sidebar", onclick: toggleKey }, icon("sidebar"))),
    h("nav", { class: "k-list" }, SMART.map(f => row(f[0], f[1], f[2], notes.filter(f[3]).length))),
    h("div", { class: "k-sec" }, h("h3", null, "Folders"), h("button", { type: "button", class: "ib sm", title: "New folder", "aria-label": "New folder", onclick: newFolder }, icon("plus"))),
    h("nav", { class: "k-list" }, P.folders.length ? P.folders.map(f => {
      const more = h("span", { class: "k-more", role: "button", tabindex: 0, title: "Rename or delete", "aria-label": "Folder options for " + f.name });
      more.append(icon("more"));
      const open = e => { e.stopPropagation(); menu(more, [mi("note", "Rename", () => renameFolder(f)), mi("trash", "Delete folder", () => deleteFolder(f), "danger")]); };
      more.addEventListener("click", open); more.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") open(e); });
      return row("fd:" + f.id, f.name, "folder", notes.filter(n => n.folder === f.id).length, more);
    }) : h("button", { type: "button", class: "k-row ghost", onclick: newFolder }, icon("plus"), h("span", null, "New folder"))),
    tags.size ? [h("div", { class: "k-sec" }, h("h3", null, "Tags")), h("div", { class: "k-tags" }, [...tags.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 40)
      .map(([t, c]) => h("button", { type: "button", class: "tag" + (P.tag === t ? " on" : ""), onclick: () => pick("all", P.tag === t ? null : t) }, "#" + t, h("small", null, c))))] : null,
    del ? h("nav", { class: "k-list k-bin" }, row("deleted", "Recently deleted", "trash", del)) : null,
    h("div", { class: "k-foot" },
      P.bip ? h("button", { type: "button", class: "k-row", onclick: install }, icon("download"), h("span", null, "Install Plot")) : null,
      h("button", { type: "button", class: "k-row", onclick: openSettings }, icon("settings"), h("span", null, "Settings")),
      h("p", null, "Notes are saved on this device only.")));
}
function renderBar() {
  const q = h("input", { class: "field q", type: "search", placeholder: "Search", value: P.q, "aria-label": "Search notes", autocomplete: "off" });
  q.addEventListener("input", debounce(() => { P.q = q.value; fill(); }, 140));
  q.addEventListener("keydown", e => { if (e.key === "Escape" && q.value) { e.stopPropagation(); q.value = ""; P.q = ""; fill(); } });
  const sw = h("div", { class: "switch", role: "tablist", "aria-label": "View" }, VIEWS.map(([k, l, ic]) => h("button", { type: "button", role: "tab", "aria-selected": String(P.view === k), class: P.view === k ? "on" : "", title: l, onclick: () => go(k) }, icon(ic), h("span", null, l))));
  return h("header", { class: "bar" },
    h("button", { type: "button", class: "ib bar-key", title: "Folders", "aria-label": "Show folders", onclick: toggleKey }, icon("sidebar")),
    h("div", { class: "bar-t" }, h("h1", { class: "bar-h" }, folderLabel()), h("span", { class: "bar-n" }, "")),
    h("div", { class: "bar-tools" }, h("label", { class: "q-wrap" }, icon("search"), q), sw,
      h("button", { type: "button", class: "btn today", title: "Today's page: a page for today, with the lines you didn't tick last time", onclick: today }, icon("calendar"), h("span", null, "Today")),
      h("button", { type: "button", class: "btn primary new", onclick: () => create() }, icon("plus"), h("span", null, "New note"))));
}
function emptyState() {
  if (P.f === "deleted") return h("div", { class: "empty" }, h("b", null, "Nothing deleted"), h("p", null, `Deleted notes wait here for ${KEEP_DAYS} days.`));
  if (P.q || P.tag || P.f !== "all") return h("div", { class: "empty" }, h("b", null, "No notes here"), h("p", null, P.q ? `Nothing matches "${P.q}".` : "Nothing in this folder yet."),
    P.f.startsWith("fd:") ? h("button", { type: "button", class: "btn primary", onclick: () => create() }, icon("plus"), "New note") : null);
  return h("div", { class: "empty first" }, logo(54), h("b", null, "Your notes, on this device"),
    h("p", null, "Write things down, tick them off, pin what matters. Lay them out on the board when you need to see how they connect."),
    h("button", { type: "button", class: "btn primary", onclick: () => create() }, icon("plus"), "New note"));
}

/* ---- folders */
async function newFolder() {
  const name = await askText("New folder", "", "Create"); if (!name) return;
  const f = { id: uid("f"), name }; P.folders.push(f); await saveFolders(); pick("fd:" + f.id);
}
async function renameFolder(f) { const name = await askText("Rename folder", f.name, "Rename"); if (!name) return; f.name = name; await saveFolders(); render(); }
async function deleteFolder(f) {
  const n = live().filter(x => x.folder === f.id).length;
  if (!await confirmBox(`Delete the folder "${f.name}"?`, n ? `Its ${plural(n, "note")} stay in All notes.` : "It's empty.", "Delete folder", true)) return;
  P.folders = P.folders.filter(x => x.id !== f.id);
  for (const x of P.notes.values()) if (x.folder === f.id) { delete x.folder; await save(x); }
  await saveFolders(); if (P.f === "fd:" + f.id) P.f = "all"; render();
}

/* ---- Notes: the list and the note beside it */
function viewNotes() {
  const list = shown(), narrow = innerWidth <= 820;
  if (P.sel && !P.notes.has(P.sel)) P.sel = null;
  if (!P.sel && list.length && !narrow) P.sel = list[0].id;
  const lst = h("div", { class: "list", "data-keep": "list" },
    P.f === "deleted" && list.length ? binBar() : null,
    list.length ? groupsOf(list).map(([g, ns]) => h("section", { class: "grp" }, h("h4", null, g), ns.map(rowOf))) : emptyState());
  const n = P.sel && P.notes.get(P.sel);
  return h("div", { class: "split" + (P.showEd && n ? " show-ed" : "") }, lst,
    h("div", { class: "edwrap", "data-keep": "ed" }, n ? editor(n, { split: true }) : h("div", { class: "empty soft" }, h("p", null, "Pick a note, or start a new one."))));
}
function binBar() { return h("div", { class: "binbar" }, h("span", null, `Notes here go for good ${KEEP_DAYS} days after they were deleted.`), h("button", { type: "button", class: "btn sm", onclick: emptyBin }, "Empty now")); }
function rowOf(n) {
  const its = (n.items || []).filter(i => String(i.t || "").trim()), done = its.filter(i => i.done).length, fd = folderName(n.folder);
  return h("button", { type: "button", class: "row" + (P.sel === n.id ? " on" : ""), "data-id": n.id, onclick: () => select(n.id) },
    h("span", { class: "row-t" }, h("b", null, titleOf(n)), n.color ? h("i", { class: "sw c-" + n.color, title: n.color }) : null),
    h("span", { class: "row-s" }, h("time", null, when(n.updated)), snippetOf(n)),
    (n.pinned || its.length || fd || n.daily) ? h("span", { class: "row-m" }, n.pinned ? h("span", null, icon("pin"), "Pinned") : null, n.daily ? h("span", null, icon("calendar"), "Today page") : null,
      its.length ? h("span", null, icon("check"), `${done} of ${its.length}`) : null, fd && P.f !== "fd:" + n.folder ? h("span", null, icon("folder"), fd) : null) : null);
}
function rowUpdate(n) { const r = document.querySelector(`.list .row[data-id="${CSS.escape(n.id)}"]`); if (r) r.replaceWith(rowOf(n)); }
async function select(id) { const prev = P.sel; P.sel = id; P.showEd = true; if (prev && prev !== id) await tidy(prev); fill(); }

/* ---- one note, open */
function editor(n, opt = {}) {
  const ro = !!n.deleted;
  const ed = h("article", { class: "ed" + (n.color ? " c-" + n.color : "") + (ro ? " ro" : ""), "data-id": n.id });
  const changed = () => { later(n); paintBlock(); paintTags(); if (opt.split) rowUpdate(n); };
  const back = opt.split ? h("button", { type: "button", class: "btn sm ed-back", onclick: async () => { P.showEd = false; await flush(); await tidy(n.id); fill(); } }, icon("back"), h("span", null, "Notes")) : null;
  const pinB = h("button", { type: "button", class: "ib" + (n.pinned ? " on" : ""), title: "Pin it to the top", "aria-label": "Pin", "aria-pressed": String(!!n.pinned), onclick: () => {
    n.pinned = !n.pinned; pinB.classList.toggle("on", n.pinned); pinB.setAttribute("aria-pressed", String(n.pinned)); later(n, 150, true); if (opt.split) rowUpdate(n); } }, icon("pin"));
  const colB = h("button", { type: "button", class: "ib", title: "Colour", "aria-label": "Colour", onclick: () => colourMenu(colB, n, c => {
    for (const x of [...ed.classList]) if (x.startsWith("c-")) ed.classList.remove(x); if (c) ed.classList.add("c-" + c); if (opt.split) rowUpdate(n); }) }, icon("palette"));
  const moreB = h("button", { type: "button", class: "ib", title: "More", "aria-label": "More", "aria-haspopup": "menu", onclick: () => moreMenu(moreB, n) }, icon("more"));
  const title = h("input", { class: "ed-t", placeholder: n.daily ? "Today" : "Title", value: n.title || "", "aria-label": "Title", maxlength: 300, readonly: ro, autocomplete: "off" });
  const body = h("textarea", { class: "ed-b", rows: 3, placeholder: "Write anything. #words become tags.", "aria-label": "Note", readonly: ro });
  body.value = n.body || "";
  const grow = () => { body.style.height = "auto"; body.style.height = Math.max(body.scrollHeight, 72) + "px"; };
  title.addEventListener("input", () => { n.title = title.value; changed(); });
  title.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); body.focus(); body.setSelectionRange(0, 0); } });
  body.addEventListener("input", () => { n.body = body.value; grow(); changed(); });
  requestAnimationFrame(grow); setTimeout(grow, 80);
  const cl = checklist(n, changed, ro);
  const tags = h("div", { class: "ed-tags" });
  const paintTags = debounce(() => { tags.textContent = ""; tags.append(...tagsOf(n).map(t => h("button", { type: "button", class: "tag", onclick: () => { closeTop(); pick("all", t); } }, "#" + t))); }, 300);
  /* the title block: like the one in the corner of a drawing sheet, it says what this note is */
  const block = h("table", { class: "tblock" });
  const paintBlock = () => {
    const its = (n.items || []).filter(i => String(i.t || "").trim()), words = textOf(n).split(/\s+/).filter(Boolean).length;
    const fsel = h("select", { class: "tb-sel", "aria-label": "Folder", disabled: ro, onchange: async e => { const v = e.target.value; if (v === "__new") { e.target.value = n.folder || ""; const name = await askText("New folder", "", "Create"); if (!name) return; const f = { id: uid("f"), name }; P.folders.push(f); await saveFolders(); n.folder = f.id; } else if (v) n.folder = v; else delete n.folder; later(n, 100, true); if (opt.split) { render(); } else paintBlock(); } },
      h("option", { value: "" }, "No folder"), P.folders.map(f => h("option", { value: f.id }, f.name)), h("option", { value: "__new" }, "New folder…"));
    fsel.value = n.folder && P.folders.some(f => f.id === n.folder) ? n.folder : "";
    block.textContent = "";
    block.append(h("tbody", null,
      h("tr", null, h("th", null, "Folder"), h("td", null, fsel)),
      h("tr", null, h("th", null, n.deleted ? "Deleted" : "Edited"), h("td", null, whenLong(n.deleted || n.updated))),
      its.length ? h("tr", null, h("th", null, "Ticked"), h("td", null, `${its.filter(i => i.done).length} of ${its.length}`)) : null,
      h("tr", null, h("th", null, "Words"), h("td", null, String(words)))));
  };
  paintBlock(); paintTags();
  ed.append(h("div", { class: "ed-h" }, back, h("span", { class: "grow" }), ro ? null : [pinB, colB], moreB), title, body, cl, tags,
    h("footer", { class: "ed-f" }, ro ? h("div", { class: "ed-acts" },
      h("button", { type: "button", class: "btn primary", onclick: () => restore(n) }, icon("undo"), "Put back"),
      h("button", { type: "button", class: "btn", onclick: () => destroyAsk(n) }, icon("trash"), "Delete for good")) : opt.pop ? h("div", { class: "ed-acts" }, h("button", { type: "button", class: "btn primary", onclick: () => closeTop() }, "Done")) : h("span"), block));
  ed.focusStart = () => { if (!String(n.title || "").trim() && !String(n.body || "").trim()) title.focus(); else { body.focus(); const l = body.value.length; body.setSelectionRange(l, l); } };
  return ed;
}
function checklist(n, changed, ro) {
  n.items = n.items || [];
  const box = h("div", { class: "items" });
  const focus = (id, at) => { const i = box.querySelector(`.li[data-i="${CSS.escape(id)}"] .li-t`); if (i) { i.focus(); const c = at == null ? i.value.length : at; i.setSelectionRange(c, c); } };
  const inputs = () => [...box.querySelectorAll(".li-t")];
  const drop = it => n.items.splice(n.items.indexOf(it), 1);
  const row = it => {
    const inp = h("input", { class: "li-t", value: it.t || "", placeholder: "List item", "aria-label": "List item", readonly: ro, autocomplete: "off" });
    const cb = h("button", { type: "button", class: "cbx" + (it.done ? " on" : ""), role: "checkbox", "aria-checked": String(!!it.done), "aria-label": it.done ? "Untick" : "Tick", disabled: ro,
      onclick: () => { it.done = !it.done; changed(); paint(); } }, icon("check"));
    inp.addEventListener("input", () => { it.t = inp.value; changed(); });
    inp.addEventListener("keydown", e => {
      const all = inputs(), ix = all.indexOf(inp);
      if (e.key === "Enter") {
        e.preventDefault(); const a = inp.selectionStart, t = it.t || "";
        const nx = { id: uid("i"), t: t.slice(a), done: false }; it.t = t.slice(0, a);
        n.items.splice(n.items.indexOf(it) + 1, 0, nx); changed(); paint(); focus(nx.id, 0);
      } else if (e.key === "Backspace" && inp.selectionStart === 0 && inp.selectionEnd === 0) {
        const pi = all[ix - 1], pid = pi && pi.closest(".li").dataset.i, prev = pid && n.items.find(x => x.id === pid);
        if (prev && !!prev.done === !!it.done) { e.preventDefault(); const at = (prev.t || "").length; prev.t = (prev.t || "") + (it.t || ""); drop(it); changed(); paint(); focus(prev.id, at); }
        else if (!it.t) { e.preventDefault(); drop(it); changed(); paint(); if (pid) focus(pid); }
      } else if (e.key === "ArrowUp" && ix > 0) { e.preventDefault(); all[ix - 1].focus(); }
      else if (e.key === "ArrowDown" && ix < all.length - 1) { e.preventDefault(); all[ix + 1].focus(); }
    });
    return h("div", { class: "li" + (it.done ? " done" : ""), "data-i": it.id }, cb, inp,
      it.from && !it.done ? h("span", { class: "li-note", title: "Not ticked on an earlier Today page, so it came along" }, "carried over") : null,
      it.moved && !it.done ? h("span", { class: "li-note", title: "Not ticked, so it went on to the next Today page" }, "moved on") : null,
      ro ? null : h("button", { type: "button", class: "ib xs li-x", title: "Remove this line", "aria-label": "Remove this line", onclick: () => { drop(it); changed(); paint(); } }, icon("x")));
  };
  const paint = () => {
    box.textContent = "";
    const open = n.items.filter(i => !i.done), done = n.items.filter(i => i.done);
    box.append(...open.map(row));
    if (!ro) box.append(h("button", { type: "button", class: "add-li", onclick: () => box.add() }, icon("plus"), n.items.length ? "List item" : "Add a checklist"));
    if (done.length) { const d = h("details", { class: "done-items", open: P.doneOpen }, h("summary", null, plural(done.length, "ticked item")), done.map(row)); d.addEventListener("toggle", () => { P.doneOpen = d.open; }); box.append(d); }
  };
  box.add = () => {
    const open = n.items.filter(i => !i.done), at = open.length ? n.items.indexOf(open[open.length - 1]) + 1 : 0;
    const nx = { id: uid("i"), t: "", done: false }; n.items.splice(at, 0, nx); paint(); focus(nx.id);
  };
  paint();
  return box;
}
function colourMenu(btn, n, after) {
  menu(btn, h("div", { class: "swatches", role: "group", "aria-label": "Colour" }, COLORS.map(([c, l]) => h("button", { type: "button", class: "dot" + (c ? " c-" + c : "") + ((n.color || "") === c ? " on" : ""), title: l, "aria-label": l,
    onclick: () => { closeMenu(); n.color = c; if (c && n.kind !== "frame") P.lastColor = c; later(n, 150, true); after && after(c); } }))));
}
function moreMenu(btn, n) {
  menu(btn, n.deleted ? [mi("undo", "Put back", () => restore(n)), mi("trash", "Delete for good", () => destroyAsk(n), "danger")] : [
    n.kind !== "frame" ? mi("check", "Turn the lines into a checklist", () => linesToList(n)) : null,
    mi("copy", "Copy the text", () => copyText(n)),
    n.kind !== "frame" ? mi("copy", "Duplicate", () => duplicate(n)) : null,
    P.view !== "board" && n.kind !== "frame" ? mi("board", "Find it on the board", () => { closeTop(); P.focus = n.id; go("board"); }) : null,
    h("div", { class: "sep" }),
    mi("trash", "Delete", () => trash(n), "danger")]);
}
/* the pop-up editor (Cards and the board) */
function pop(n, focusIt) {
  const ed = editor(n, { pop: true });
  const box = h("div", { class: "pop", role: "dialog", "aria-modal": "true", "aria-label": titleOf(n) }, ed);
  layer(box, () => { flush().then(() => tidy(n.id)).then(() => fill()); }, "pop-scrim");
  if (focusIt) setTimeout(() => ed.focusStart(), 40);
  return box;
}
function copyText(n) { (navigator.clipboard ? navigator.clipboard.writeText(plainOf(n)) : Promise.reject()).then(() => toast("Copied"), () => toast("This browser didn't allow copying")); }
function linesToList(n) {
  const lines = String(n.body || "").split("\n").map(x => x.replace(/^\s*(?:[-*•·]|\[\s?\]|\d+[.)])\s*/, "").trim()).filter(Boolean);
  if (!lines.length) return toast("Write some lines first, one to a line");
  n.items = [...(n.items || []), ...lines.map(t => ({ id: uid("i"), t, done: false }))]; n.body = "";
  later(n, 50); setTimeout(() => { closeTop(); render(); }, 80);
}
async function duplicate(n) {
  const c = cleanNote(Object.assign(clone(n), { id: uid(), title: n.title ? n.title + " (copy)" : "", pinned: false, links: [], created: now(), updated: now() }));
  delete c.daily; delete c._saved; c.items = c.items.map(i => Object.assign({}, i, { id: uid("i") }));
  if (Number.isFinite(n.x)) { c.x = n.x + 30; c.y = n.y + 30; }
  await save(c); P.sel = c.id; P.showEd = true; closeTop(); render(); toast("Duplicated");
}
async function trash(n) {
  closeTop();
  if (isEmpty(n) && !n._saved && n.kind !== "frame") { await destroy(n.id); render(); return; }
  clearTimeout(P.timers.get(n.id)); P.timers.delete(n.id);
  n.deleted = now(); await save(n);
  if (P.sel === n.id) { P.sel = null; P.showEd = false; }
  render();
  toast(n.kind === "frame" ? "Frame deleted (its notes stay)" : "Note deleted", "Undo", async () => { delete n.deleted; await save(n); if (n.kind !== "frame") P.sel = n.id; render(); }, 8000);
}
async function restore(n) { delete n.deleted; await save(n); P.sel = n.id; closeTop(); toast("Put back"); render(); }
async function destroyAsk(n) {
  if (!await confirmBox("Delete this note for good?", "It can't be put back after this.", "Delete", true)) return;
  await destroy(n.id); closeTop(); render(); toast("Deleted for good");
}
async function emptyBin() {
  const del = [...P.notes.values()].filter(n => n.deleted); if (!del.length) return;
  if (!await confirmBox(`Delete ${plural(del.length, "note")} for good?`, "They can't be put back after this.", "Delete", true)) return;
  for (const n of del) await destroy(n.id);
  P.f = "all"; render(); toast("Recently deleted is empty");
}

/* ---- new notes and today's page */
async function create(o) {
  if (P.f === "deleted" || P.tag || P.q || (!P.f.startsWith("fd:") && P.f !== "all")) { P.f = P.f.startsWith("fd:") ? P.f : "all"; P.tag = null; P.q = ""; render(); }
  if (P.view === "board" && P.cvAdd && !o) return P.cvAdd();
  const n = newNote(o); P.notes.set(n.id, n);
  if (!isEmpty(n)) await save(n);
  if (P.view === "cards") { pop(n, true); return; }
  if (P.view === "board") { P.focus = n.id; fill(); pop(n, true); return; }
  const prev = P.sel; P.sel = n.id; P.showEd = true;
  if (prev && prev !== n.id) await tidy(prev);
  render();
  setTimeout(() => { const ed = $(".split .ed"); if (ed && ed.focusStart) ed.focusStart(); }, 30);
}
async function today() {
  const d = new Date(), key = dayKey(d);
  let n = [...P.notes.values()].find(x => x.daily === key && !x.deleted);
  if (!n) {
    const items = [];
    const prev = [...P.notes.values()].filter(x => x.daily && x.daily < key && !x.deleted).sort((a, b) => b.daily.localeCompare(a.daily))[0];
    if (prev) {
      const left = (prev.items || []).filter(i => !i.done && !i.moved && String(i.t || "").trim());
      for (const i of left) { items.push({ id: uid("i"), t: i.t, done: false, from: prev.daily }); i.moved = key; }
      if (left.length) await save(prev);
    }
    n = newNote({ title: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }), daily: key, items, color: "yellow", folder: undefined });
    await save(n);
  }
  P.f = "all"; P.tag = null; P.q = ""; P.sel = n.id; P.showEd = true;
  if (P.view === "cards") { render(); pop(n); return; }
  if (P.view === "board") P.focus = n.id;
  render();
}

/* ---- Cards */
function viewCards() {
  const list = shown();
  const wrap = h("div", { class: "cw" });
  if (P.f !== "deleted") wrap.append(capture()); else if (list.length) wrap.append(binBar());
  const pinned = list.filter(n => n.pinned && !n.deleted), rest = list.filter(n => !(n.pinned && !n.deleted));
  if (pinned.length) wrap.append(h("h4", { class: "sec" }, "Pinned"), masonry(pinned), rest.length ? h("h4", { class: "sec" }, "Others") : null);
  if (rest.length) wrap.append(masonry(rest));
  if (!list.length) wrap.append(emptyState());
  requestAnimationFrame(() => requestAnimationFrame(() => { wrap.scrollTop = P.sc.cards || 0; }));
  wrap.addEventListener("scroll", () => { P.sc.cards = wrap.scrollTop; }, { passive: true });
  return wrap;
}
/* columns filled shortest first, so the newest run across the top */
function masonry(notes) {
  const g = h("div", { class: "cards" }), order = notes.map(n => n.id);
  let first = notes.map(cardOf);
  const lay = () => {
    const w = g.clientWidth; if (!w) return;
    const cols = Math.max(1, Math.min(6, Math.floor((w + 14) / 244)));
    if (g.dataset.n === String(cols) && !first) return;
    const els = first || [...g.querySelectorAll(".card")].sort((a, b) => order.indexOf(a.dataset.id) - order.indexOf(b.dataset.id)); first = null;
    g.dataset.n = cols; g.textContent = "";
    const cs = Array.from({ length: cols }, () => h("div", { class: "col" })); g.append(...cs);
    const hs = new Array(cols).fill(0);
    for (const el of els) { const i = hs.indexOf(Math.min(...hs)); cs[i].append(el); hs[i] = cs[i].offsetHeight; }
  };
  new ResizeObserver(lay).observe(g);
  return g;
}
function cardOf(n) {
  const el = h("article", { class: "card" + (n.color ? " c-" + n.color : "") + (n.deleted ? " gone" : ""), tabindex: 0, "data-id": n.id, "aria-label": titleOf(n),
    onclick: e => { if (e.target.closest("input, button, a, label")) return; pop(n); }, onkeydown: e => { if (e.key === "Enter" && e.target === el) pop(n); } },
    inner(n, () => el.replaceWith(cardOf(n)), 10),
    h("div", { class: "card-a" }, n.deleted ? [
      h("button", { type: "button", class: "ib sm", title: "Put back", "aria-label": "Put back", onclick: () => restore(n) }, icon("undo")),
      h("button", { type: "button", class: "ib sm", title: "Delete for good", "aria-label": "Delete for good", onclick: () => destroyAsk(n) }, icon("trash"))] : [
      h("button", { type: "button", class: "ib sm" + (n.pinned ? " on" : ""), title: n.pinned ? "Unpin" : "Pin", "aria-label": n.pinned ? "Unpin" : "Pin", onclick: async () => { n.pinned = !n.pinned; await save(n); fill(); } }, icon("pin")),
      (() => { const b = h("button", { type: "button", class: "ib sm", title: "Colour", "aria-label": "Colour", onclick: () => colourMenu(b, n, () => el.replaceWith(cardOf(n))) }, icon("palette")); return b; })(),
      (() => { const b = h("button", { type: "button", class: "ib sm", title: "More", "aria-label": "More", "aria-haspopup": "menu", onclick: () => moreMenu(b, n) }, icon("more")); return b; })(),
      h("span", { class: "grow" }), h("time", null, when(n.updated))]));
  return el;
}
/* what a card or a board note shows */
function inner(n, repaint, max = 10) {
  const its = (n.items || []).filter(i => String(i.t || "").trim()), open = its.filter(i => !i.done), done = its.length - open.length;
  const tick = i => { i.done = true; later(n, 400); repaint(); };
  return [
    n.daily ? h("span", { class: "daily" }, icon("calendar"), "Today page") : null,
    String(n.title || "").trim() ? h("b", { class: "c-title" }, n.title) : null,
    String(n.body || "").trim() ? h("div", { class: "c-text" }, rich(n.body)) : null,
    open.length ? h("ul", { class: "c-list" }, open.slice(0, max).map(i => h("li", null,
      h("input", { type: "checkbox", "aria-label": "Tick: " + i.t, disabled: !!n.deleted, onchange: () => tick(i) }), h("span", null, rich(i.t))))) : null,
    open.length > max || done ? h("small", { class: "c-more" }, [open.length > max ? `${open.length - max} more` : "", done ? plural(done, "ticked item") : ""].filter(Boolean).join(", ")) : null,
  ];
}
/* "Take a note…" */
function capture() {
  const t = h("input", { class: "cap-t", placeholder: "Title", "aria-label": "Title", autocomplete: "off" });
  const b = h("textarea", { class: "cap-b", rows: 1, placeholder: "Take a note…", "aria-label": "Take a note" });
  const box = h("div", { class: "cap" }, t, b, h("div", { class: "cap-f" },
    h("button", { type: "button", class: "btn sm", onclick: () => list() }, icon("check"), "Make it a list"), h("span", { class: "grow" }),
    h("button", { type: "button", class: "btn sm primary", onclick: () => done() }, "Save")));
  const grow = () => { b.style.height = "auto"; b.style.height = b.scrollHeight + "px"; };
  const outside = e => { if (!box.contains(e.target)) done(); };
  const open = () => { if (box.classList.contains("open")) return; box.classList.add("open"); document.addEventListener("pointerdown", outside, true); };
  const shut = () => { box.classList.remove("open"); document.removeEventListener("pointerdown", outside, true); t.value = ""; b.value = ""; grow(); };
  const done = async () => {
    const title = t.value.trim(), body = b.value.trim(); shut();
    if (title || body) { const n = newNote({ title, body }); await save(n); fill(); toast("Saved"); }
  };
  const list = async () => {
    const title = t.value.trim(), lines = b.value.split("\n").map(x => x.trim()).filter(Boolean); shut();
    const n = newNote({ title, items: lines.map(x => ({ id: uid("i"), t: x, done: false })) }); P.notes.set(n.id, n);
    if (!isEmpty(n)) await save(n);
    fill(); const p = pop(n); setTimeout(() => { const a = p.querySelector(".add-li"); if (a) a.click(); }, 60);
  };
  b.addEventListener("focus", open); t.addEventListener("focus", open); b.addEventListener("input", grow);
  for (const el of [t, b]) el.addEventListener("keydown", e => { if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); e.stopPropagation(); done(); } });
  t.addEventListener("keydown", e => { if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); b.focus(); } });
  return box;
}

/* ---- Board: an endless blueprint. Notes are dragged about, joined with arrows and grouped inside red-line frames */
function wirePath(a, b) {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 }, dx = bc.x - ac.x, dy = bc.y - ac.y;
  let s, t, c1, c2;
  if (Math.abs(dx) >= Math.abs(dy)) {
    s = { x: dx >= 0 ? a.x + a.w : a.x, y: ac.y }; t = { x: dx >= 0 ? b.x - 4 : b.x + b.w + 4, y: bc.y };
    const k = Math.max(40, Math.abs(t.x - s.x) / 2) * (dx >= 0 ? 1 : -1); c1 = { x: s.x + k, y: s.y }; c2 = { x: t.x - k, y: t.y };
  } else {
    s = { x: ac.x, y: dy >= 0 ? a.y + a.h : a.y }; t = { x: bc.x, y: dy >= 0 ? b.y - 4 : b.y + b.h + 4 };
    const k = Math.max(40, Math.abs(t.y - s.y) / 2) * (dy >= 0 ? 1 : -1); c1 = { x: s.x, y: s.y + k }; c2 = { x: t.x, y: t.y - k };
  }
  return `M${s.x},${s.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${t.x},${t.y}`;
}
function viewBoard() {
  if (!P.cam) { try { const c = JSON.parse(ls("plot-cam") || "null"); if (c && [c.x, c.y, c.z].every(Number.isFinite)) P.cam = c; } catch (e) { } }
  const cam = P.cam || (P.cam = { x: 0, y: 0, z: 1, fresh: true });
  const cv = h("div", { class: "board", tabindex: 0, role: "application", "aria-label": "Board: your notes on an endless sheet. Double-click to add a note." });
  const world = h("div", { class: "world" }), ui = h("div", { class: "b-ui" });
  const svg = svgEl("svg", { class: "wires", "aria-hidden": "true" });
  const zl = h("button", { type: "button", class: "zl", title: "Back to 100%", onclick: () => { const r = cv.getBoundingClientRect(); zoomAt(1, r.left + r.width / 2, r.top + r.height / 2); } }, "100%");
  cv.append(world, ui,
    h("div", { class: "b-tools" },
      h("button", { type: "button", class: "tb", title: "Add a note (or double-click the board)", onclick: () => { const c = centre(); addSticky(c.x - 115, c.y - 60); } }, icon("sticky"), h("span", null, "Note")),
      h("button", { type: "button", class: "tb", title: "Draw a frame round a group of notes", onclick: () => addFrame() }, icon("frame"), h("span", null, "Frame")),
      h("button", { type: "button", class: "tb", title: "See everything", onclick: () => fit() }, icon("fit"), h("span", null, "Fit"))),
    h("div", { class: "b-zoom" },
      h("button", { type: "button", title: "Zoom out", "aria-label": "Zoom out", onclick: () => { const r = cv.getBoundingClientRect(); zoomAt(cam.z / 1.25, r.left + r.width / 2, r.top + r.height / 2); } }, icon("minus")),
      zl,
      h("button", { type: "button", title: "Zoom in", "aria-label": "Zoom in", onclick: () => { const r = cv.getBoundingClientRect(); zoomAt(cam.z * 1.25, r.left + r.width / 2, r.top + r.height / 2); } }, icon("plus"))),
    h("div", { class: "b-hint" }, "Double-click to add a note. Drag a note's dot onto another to join them. Scroll to move; Ctrl and scroll to zoom."));
  const q = P.q.trim(), filtered = !!(q || P.tag || P.f !== "all");
  const vis = new Set(shown().map(n => n.id));
  const all = live(), frames = all.filter(n => n.kind === "frame"), notes = all.filter(n => n.kind !== "frame");
  const els = new Map(); let sel = P.focus && P.notes.has(P.focus) ? P.focus : P.cvSel && P.notes.has(P.cvSel) ? P.cvSel : null, selWire = null, temp = null, mode = null;
  const pointers = new Map();
  /* notes never placed on the board wait in a tray below everything else */
  const placed = n => Number.isFinite(n.x) && Number.isFinite(n.y);
  const auto = new Map(), loose = notes.filter(n => !placed(n)).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || "").localeCompare(a.updated || ""));
  const fixed = [...notes.filter(placed), ...frames];
  const trayY = fixed.length ? Math.max(...fixed.map(n => n.y + (n.kind === "frame" ? n.h || 400 : 300))) + 140 : 60;
  const trayX = fixed.length ? Math.min(...fixed.map(n => n.x)) : 0;
  const PER = 5;
  loose.forEach((n, i) => auto.set(n.id, { x: trayX + 30 + (i % PER) * 260, y: trayY + 54 + Math.floor(i / PER) * 290 }));
  const pos = n => placed(n) ? { x: n.x, y: n.y } : auto.get(n.id) || { x: 0, y: 0 };
  const saveCam = debounce(() => ls("plot-cam", JSON.stringify({ x: Math.round(cam.x), y: Math.round(cam.y), z: Math.round(cam.z * 1000) / 1000 })), 400);
  const paintCam = () => {
    world.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})`;
    const g = 24 * cam.z; cv.style.setProperty("--g", g + "px"); cv.style.setProperty("--G", g * 5 + "px");
    cv.style.backgroundPosition = `${cam.x}px ${cam.y}px`;
    zl.textContent = Math.round(cam.z * 100) + "%";
  };
  const applyCam = () => { paintCam(); delete cam.fresh; saveCam(); placeUi(); };
  const toWorld = (cx, cy) => { const r = cv.getBoundingClientRect(); return { x: (cx - r.left - cam.x) / cam.z, y: (cy - r.top - cam.y) / cam.z }; };
  const centre = () => { const r = cv.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.top + r.height / 2); };
  const zoomAt = (z, cx, cy) => {
    z = Math.max(0.2, Math.min(2.5, z)); const r = cv.getBoundingClientRect(), px = cx - r.left, py = cy - r.top;
    const wx = (px - cam.x) / cam.z, wy = (py - cam.y) / cam.z; cam.z = z; cam.x = px - wx * z; cam.y = py - wy * z; applyCam();
  };
  const box = id => { const el = els.get(id); return el && el.isConnected ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null; };
  const bounds = () => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of els.keys()) { const b = box(id); if (!b) continue; const t = P.notes.get(id), lift = t && t.kind === "frame" ? 34 : 0; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y - lift); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
    return isFinite(x0) ? { x0, y0, x1, y1 } : null;
  };
  const fit = () => {
    const r = cv.getBoundingClientRect(), b = bounds(); if (!r.width) return;
    if (!b) { cam.z = 1; cam.x = r.width / 2 - 115; cam.y = r.height / 3; applyCam(); return; }
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0, z = Math.max(0.2, Math.min(1, (r.width - 120) / bw, (r.height - 120) / bh));
    cam.z = z; cam.x = r.width / 2 - (b.x0 + bw / 2) * z; cam.y = r.height / 2 - (b.y0 + bh / 2) * z; applyCam();
  };
  const centreOn = id => { const r = cv.getBoundingClientRect(), b = box(id); if (!b || !r.width) return; cam.z = Math.max(cam.z, 0.8); cam.x = r.width / 2 - (b.x + b.w / 2) * cam.z; cam.y = r.height / 2.4 - (b.y + b.h / 2) * cam.z; applyCam(); };
  const sticky = n => {
    const p = pos(n);
    return h("div", { class: "st c-" + (n.color || "paper") + (sel === n.id ? " sel" : "") + (filtered && !vis.has(n.id) ? " dim" : "") + (n.pinned ? " pinned" : ""), "data-id": n.id, style: { left: p.x + "px", top: p.y + "px", width: (n.w || 230) + "px" } },
      h("div", { class: "st-in" }, inner(n, () => repaintOne(n), 6)), h("span", { class: "knob", title: "Drag onto another note to join them" }));
  };
  const frameEl = f => h("div", { class: "fr" + (sel === f.id ? " sel" : ""), "data-id": f.id, style: { left: f.x + "px", top: f.y + "px", width: (f.w || 600) + "px", height: (f.h || 400) + "px" } },
    h("div", { class: "fr-t", title: "Drag to move the frame and what's in it; double-click to rename" }, f.title || "Frame"), h("span", { class: "fr-rz", title: "Drag to resize" }));
  const repaintOne = n => { const old = els.get(n.id); if (!old) return; const el = n.kind === "frame" ? frameEl(n) : sticky(n); old.replaceWith(el); els.set(n.id, el); drawWires(); placeUi(); };
  for (const f of frames) { const el = frameEl(f); world.append(el); els.set(f.id, el); }
  world.append(svg);
  if (loose.length) {
    const rows = Math.ceil(loose.length / PER);
    world.append(h("div", { class: "tray", style: { left: trayX + "px", top: trayY + "px", width: (Math.min(loose.length, PER) * 260 + 30) + "px", height: (rows * 290 + 64) + "px" } },
      h("span", null, "Not placed yet: drag them out to arrange them")));
  }
  for (const n of notes) { const el = sticky(n); world.append(el); els.set(n.id, el); }
  const drawWires = () => {
    const b = bounds() || { x0: 0, y0: 0, x1: 1, y1: 1 }, pad = 400, x = b.x0 - pad, y = b.y0 - pad, w = b.x1 - b.x0 + pad * 2, hh = b.y1 - b.y0 + pad * 2;
    svg.setAttribute("viewBox", `${x} ${y} ${w} ${hh}`); svg.style.left = x + "px"; svg.style.top = y + "px"; svg.style.width = w + "px"; svg.style.height = hh + "px";
    svg.textContent = "";
    const defs = svgEl("defs"), mk = svgEl("marker", { id: "arrowhead", viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" });
    mk.append(svgEl("path", { d: "M0,1 L9,5 L0,9 z", fill: "currentColor" })); defs.append(mk); svg.append(defs);
    for (const n of notes) for (const to of n.links || []) {
      const a = box(n.id), c = box(to); if (!a || !c) continue;
      const d = wirePath(a, c), on = selWire && selWire[0] === n.id && selWire[1] === to;
      const g = svgEl("g", { class: "wire" + (on ? " on" : ""), "data-from": n.id, "data-to": to });
      g.append(svgEl("path", { d, class: "hit" }), svgEl("path", { d, class: "ln", "marker-end": "url(#arrowhead)" }));
      svg.append(g);
    }
    if (temp) svg.append(svgEl("path", { d: temp, class: "tmp" }));
    placeUi();
  };
  const bar = h("div", { class: "selbar", hidden: true }), wx = h("button", { type: "button", class: "wx", hidden: true, title: "Remove this arrow", "aria-label": "Remove this arrow", onclick: () => unwire() }, icon("x"));
  ui.append(bar, wx);
  const barFor = n => {
    const dots = COLORS.map(([c, l]) => h("button", { type: "button", class: "dot" + (c ? " c-" + c : "") + ((n.color || "") === c ? " on" : ""), title: l, "aria-label": l,
      onclick: () => { n.color = c; if (c && n.kind !== "frame") P.lastColor = c; later(n, 150, true); bar.dataset.id = ""; repaintOne(n); } }));
    return n.kind === "frame" ? [
      h("button", { type: "button", class: "btn sm", onclick: () => renameFrame(n) }, "Rename"),
      h("span", { class: "bsep" }),
      h("button", { type: "button", class: "ib sm", title: "Delete the frame (its notes stay)", "aria-label": "Delete the frame", onclick: () => trash(n) }, icon("trash"))] : [
      dots, h("span", { class: "bsep" }),
      h("button", { type: "button", class: "btn sm", onclick: () => pop(n) }, icon("open"), "Open"),
      h("button", { type: "button", class: "ib sm", title: "Delete", "aria-label": "Delete", onclick: () => trash(n) }, icon("trash"))];
  };
  function placeUi() {
    const el = sel && els.get(sel), n = sel && P.notes.get(sel);
    if (!el || !n || mode || el.classList.contains("editing")) bar.hidden = true;
    else {
      if (bar.dataset.id !== sel) { bar.dataset.id = sel; bar.textContent = ""; bar.append(...[].concat(...barFor(n).map(x => [].concat(x)))); }
      bar.hidden = false;
      const lift = n.kind === "frame" ? 36 : 0, r = cv.getBoundingClientRect();
      let x = cam.x + (el.offsetLeft + el.offsetWidth / 2) * cam.z, y = cam.y + el.offsetTop * cam.z - lift;
      const bw = bar.offsetWidth; x = Math.max(bw / 2 + 8, Math.min(r.width - bw / 2 - 8, x));
      bar.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(bar.offsetHeight + 20, y))}px) translate(-50%, calc(-100% - 12px))`;
    }
    const g = selWire && svg.querySelector(".wire.on .ln");
    if (!g || mode) wx.hidden = true;
    else { const L = g.getTotalLength(), m = g.getPointAtLength(L / 2); wx.hidden = false; wx.style.transform = `translate(${cam.x + m.x * cam.z}px, ${cam.y + m.y * cam.z}px)`; }
  }
  const select = id => {
    sel = id; P.focus = null; P.cvSel = id; if (id) P.sel = id;
    for (const [k, el] of els) el.classList.toggle("sel", k === id);
    if (selWire) { selWire = null; drawWires(); } else placeUi();
  };
  const unwire = () => {
    if (!selWire) return; const [f, t] = selWire, n = P.notes.get(f);
    if (n) { n.links = (n.links || []).filter(x => x !== t); later(n, 150, true); }
    selWire = null; drawWires(); toast("Arrow removed");
  };
  const place = (n, x, y) => { n.x = Math.round(x); n.y = Math.round(y); const el = els.get(n.id); if (el) { el.style.left = n.x + "px"; el.style.top = n.y + "px"; } };
  const count = () => { const c = $(".bar-n"); if (c) c.textContent = plural(shown().length, "note"); };
  const addSticky = (x, y, from) => {
    const n = newNote({ x: Math.round(x), y: Math.round(y), color: P.lastColor || "yellow" });
    P.notes.set(n.id, n); notes.push(n);
    if (from) { from.links = [...(from.links || []), n.id]; later(from, 300, true); }
    const el = sticky(n); world.append(el); els.set(n.id, el); select(n.id); drawWires();
    inline(n); count();
  };
  P.cvAdd = () => { const c = centre(); addSticky(c.x - 115, c.y - 60); };
  const addFrame = () => {
    const c = centre(), f = newNote({ kind: "frame", title: "Frame " + (frames.length + 1), x: Math.round(c.x - 330), y: Math.round(c.y - 210), w: 660, h: 420, color: "" });
    frames.push(f); P.notes.set(f.id, f); save(f).catch(e => toast(e.message));
    const el = frameEl(f); world.insertBefore(el, svg); els.set(f.id, el); select(f.id); renameFrame(f);
  };
  const renameFrame = f => {
    const el = els.get(f.id), t = el && el.querySelector(".fr-t"); if (!t) return;
    const inp = h("input", { class: "fr-in", value: f.title || "", maxlength: 80, "aria-label": "Frame name" }); let fin = false;
    const done = keep => { if (fin) return; fin = true; if (keep !== false) { const v = inp.value.trim(); if (v && v !== f.title) { f.title = v; later(f, 50); } } repaintOne(f); };
    inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") done(); if (e.key === "Escape") done(false); });
    inp.addEventListener("blur", () => done()); inp.addEventListener("pointerdown", e => e.stopPropagation());
    t.replaceWith(inp); inp.focus(); inp.select(); bar.hidden = true;
  };
  /* typing straight onto a note */
  const inline = n => {
    const el = els.get(n.id); if (!el || el.classList.contains("editing")) return;
    select(n.id); el.classList.add("editing"); bar.hidden = true;
    const inn = el.querySelector(".st-in");
    const ta = h("textarea", { class: "st-ta", placeholder: "Write…", "aria-label": "Note" }); ta.value = n.body || "";
    const cx = inn.querySelector(".c-text");
    if (cx) cx.replaceWith(ta); else { const t = inn.querySelector(".c-title, .daily"); if (t) t.after(ta); else inn.prepend(ta); }
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.max(54, ta.scrollHeight) + "px"; drawWires(); };
    ta.addEventListener("input", () => { n.body = ta.value; later(n); grow(); });
    ta.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); ta.blur(); } });
    ta.addEventListener("pointerdown", e => e.stopPropagation());
    ta.addEventListener("blur", async () => {
      el.classList.remove("editing");
      if (await tidy(n.id)) { el.remove(); els.delete(n.id); const i = notes.indexOf(n); if (i >= 0) notes.splice(i, 1); if (sel === n.id) sel = null; drawWires(); count(); return; }
      repaintOne(n);
    });
    ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length);
    requestAnimationFrame(grow);
  };
  const endWire = (e, m) => {
    temp = null;
    const hit = document.elementFromPoint(e.clientX, e.clientY), st = hit && hit.closest(".st"), from = P.notes.get(m.from);
    if (from && st && st.dataset.id !== m.from) {
      const to = st.dataset.id, back = P.notes.get(to);
      if (!(from.links || []).includes(to) && !(back && (back.links || []).includes(m.from))) { from.links = [...(from.links || []), to]; later(from, 150, true); }
      drawWires(); return;
    }
    if (from && !st && m.moved) { const w = toWorld(e.clientX, e.clientY); addSticky(w.x - 10, w.y - 55, from); return; }
    drawWires();
  };
  const move = e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const m = mode; if (!m) return;
    if (m.kind === "pinch") {
      const [a, b] = [...pointers.values()]; if (!b) return;
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, r = cv.getBoundingClientRect();
      const z = Math.max(0.2, Math.min(2.5, m.z0 * d / m.d0)), wx0 = (m.mx - r.left - m.x0) / m.z0, wy0 = (m.my - r.top - m.y0) / m.z0;
      cam.z = z; cam.x = mx - r.left - wx0 * z; cam.y = my - r.top - wy0 * z; applyCam(); return;
    }
    const w = toWorld(e.clientX, e.clientY);
    if (m.kind === "pan") {
      const dx = e.clientX - m.cx, dy = e.clientY - m.cy; if (!m.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      m.moved = true; cv.classList.add("panning"); cam.x = m.x0 + dx; cam.y = m.y0 + dy; applyCam();
    } else if (m.kind === "drag") {
      const dx = w.x - m.wx, dy = w.y - m.wy; if (!m.moved && Math.abs(dx) + Math.abs(dy) < 4 / cam.z) return;
      if (!m.moved) { m.moved = true; els.get(m.n.id).classList.add("lifted"); bar.hidden = true; }
      place(m.n, m.x0 + dx, m.y0 + dy); for (const k of m.kids) place(k.n, k.x0 + dx, k.y0 + dy); drawWires();
    } else if (m.kind === "resize") {
      m.f.w = Math.max(260, Math.round(m.w0 + w.x - m.wx)); m.f.h = Math.max(180, Math.round(m.h0 + w.y - m.wy));
      const el = els.get(m.f.id); el.style.width = m.f.w + "px"; el.style.height = m.f.h + "px"; m.moved = true; drawWires();
    } else if (m.kind === "wire") {
      const a = box(m.from); if (!a) return; m.moved = true;
      const s = { x: a.x + a.w, y: a.y + a.h / 2 }, k = Math.max(40, Math.abs(w.x - s.x) / 2);
      temp = `M${s.x},${s.y} C${s.x + k},${s.y} ${w.x - k},${w.y} ${w.x},${w.y}`; drawWires();
    }
  };
  const up = e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    const m = mode;
    if (pointers.size) { if (m && m.kind === "pinch") mode = { kind: "idle" }; return; }
    mode = null; removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
    cv.classList.remove("hold", "panning");
    if (!m) return;
    if (m.kind === "pan" && !m.moved) { if (sel || selWire) { selWire = null; select(null); drawWires(); } }
    if (m.kind === "drag") {
      const el = els.get(m.n.id); if (el) el.classList.remove("lifted");
      if (m.moved) { later(m.n, 250, true); for (const k of m.kids) later(k.n, 250, true); }
      select(m.n.id);
    }
    if (m.kind === "resize" && m.moved) later(m.f, 250, true);
    if (m.kind === "wire") endWire(e, m);
    placeUi();
  };
  cv.addEventListener("pointerdown", e => {
    if (e.target.closest(".b-tools, .b-zoom, .selbar, .wx, input, textarea, button, a, label")) return;
    if (e.button > 1) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      if (mode && mode.kind === "drag" && mode.moved) later(mode.n, 250, true);
      const [a, b] = [...pointers.values()];
      mode = { kind: "pinch", d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: cam.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, x0: cam.x, y0: cam.y }; temp = null; return;
    }
    if (pointers.size > 2) return;
    const fa = document.activeElement;
    if (fa && fa !== cv && /TEXTAREA|INPUT|SELECT/.test(fa.tagName)) fa.blur();
    cv.focus({ preventScroll: true });
    const w = toWorld(e.clientX, e.clientY);
    const knob = e.target.closest(".knob"), rz = e.target.closest(".fr-rz"), st = e.target.closest(".st"), ft = e.target.closest(".fr-t"), wire = e.target.closest(".wire");
    if (e.button === 1) mode = { kind: "pan", cx: e.clientX, cy: e.clientY, x0: cam.x, y0: cam.y, moved: false };
    else if (knob) mode = { kind: "wire", from: knob.closest(".st").dataset.id, moved: false };
    else if (rz) { const f = P.notes.get(rz.closest(".fr").dataset.id); mode = { kind: "resize", f, w0: f.w || 600, h0: f.h || 400, wx: w.x, wy: w.y, moved: false }; }
    else if (st || ft) {
      const n = P.notes.get((st || ft.closest(".fr")).dataset.id); if (!n) { pointers.delete(e.pointerId); return; }
      const p = pos(n), kids = [];
      if (n.kind === "frame") for (const o of notes) { const b = box(o.id); if (!b) continue; const cx = b.x + b.w / 2, cy = b.y + b.h / 2; if (cx > n.x && cx < n.x + (n.w || 600) && cy > n.y && cy < n.y + (n.h || 400)) { const q2 = pos(o); kids.push({ n: o, x0: q2.x, y0: q2.y }); } }
      mode = { kind: "drag", n, wx: w.x, wy: w.y, x0: p.x, y0: p.y, kids, moved: false };
    }
    else if (wire) { selWire = [wire.dataset.from, wire.dataset.to]; sel = null; for (const el of els.values()) el.classList.remove("sel"); drawWires(); pointers.delete(e.pointerId); return; }
    else mode = { kind: "pan", cx: e.clientX, cy: e.clientY, x0: cam.x, y0: cam.y, moved: false };
    cv.classList.add("hold"); e.preventDefault();
    addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
  });
  cv.addEventListener("dblclick", e => {
    if (e.target.closest(".b-tools, .b-zoom, .selbar, .wx, input, textarea, button, a, label, .knob")) return;
    const st = e.target.closest(".st"), ft = e.target.closest(".fr-t");
    if (st) { const n = P.notes.get(st.dataset.id); if (n) inline(n); return; }
    if (ft) { const f = P.notes.get(ft.closest(".fr").dataset.id); if (f) renameFrame(f); return; }
    const w = toWorld(e.clientX, e.clientY); addSticky(w.x - 115, w.y - 50);
  });
  cv.addEventListener("wheel", e => {
    e.preventDefault();
    const k = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? 300 : 1;
    if (e.ctrlKey || e.metaKey) zoomAt(cam.z * Math.exp(-e.deltaY * k * 0.0022), e.clientX, e.clientY);
    else { cam.x -= (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k; cam.y -= (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * k; applyCam(); }
  }, { passive: false });
  cv.addEventListener("keydown", e => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === "Delete" || e.key === "Backspace") { if (selWire) { e.preventDefault(); unwire(); } else if (sel) { e.preventDefault(); const n = P.notes.get(sel); if (n) trash(n); } }
    else if (e.key === "Escape") { if (sel || selWire) { e.stopPropagation(); selWire = null; select(null); drawWires(); } }
    else if (e.key === "Enter" && sel) { e.preventDefault(); const n = P.notes.get(sel); if (n && n.kind !== "frame") inline(n); }
    else if ((e.key === "+" || e.key === "=") && !e.ctrlKey && !e.metaKey) { const r = cv.getBoundingClientRect(); zoomAt(cam.z * 1.25, r.left + r.width / 2, r.top + r.height / 2); }
    else if (e.key === "-" && !e.ctrlKey && !e.metaKey) { const r = cv.getBoundingClientRect(); zoomAt(cam.z / 1.25, r.left + r.width / 2, r.top + r.height / 2); }
  });
  requestAnimationFrame(() => {
    if (!cv.isConnected) return;
    drawWires();
    const f = P.focus && els.has(P.focus) ? P.focus : null;
    if (f) { centreOn(f); select(f); }
    else if (cam.fresh) fit(); else applyCam();
  });
  paintCam();
  return cv;
}

/* ---- settings: how it looks, installing, backing up */
function applyTheme() {
  const t = P.set.theme || "system", dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const m = $('meta[name="theme-color"]'); if (m) m.setAttribute("content", dark ? "#0E1828" : "#F3F6FA");
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
function openSettings() {
  const seg = h("div", { class: "switch wide", role: "radiogroup", "aria-label": "Appearance" }, [["system", "Match this device"], ["light", "Light"], ["dark", "Dark"]].map(([k, l]) =>
    h("button", { type: "button", role: "radio", "aria-checked": String((P.set.theme || "system") === k), class: (P.set.theme || "system") === k ? "on" : "", onclick: async () => { P.set.theme = k; applyTheme(); await saveSettings(); L.close(); openSettings(); } }, h("span", null, l))));
  const file = h("input", { type: "file", accept: ".json,application/json", hidden: true, onchange: e => { const f = e.target.files[0]; if (f) restoreFrom(f).then(() => L.close()); } });
  const count = live().filter(n => n.kind !== "frame").length;
  const standalone = matchMedia("(display-mode: standalone)").matches;
  const box = h("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-label": "Settings" },
    h("div", { class: "dialog-h" }, h("h2", null, "Settings"), h("button", { type: "button", class: "ib", "aria-label": "Close", onclick: () => L.close() }, icon("x"))),
    h("section", null, h("h3", null, "Appearance"), seg),
    h("section", null, h("h3", null, "Where your notes are"),
      h("p", null, `${plural(count, "note")}, saved in this browser on this device. Plot never sends them anywhere, so they don't appear on your other devices, and clearing this browser's data would remove them. Keep a back-up now and then.`),
      h("div", { class: "row-btns" },
        h("button", { type: "button", class: "btn", onclick: backup }, icon("download"), "Back up notes"),
        h("button", { type: "button", class: "btn", onclick: () => file.click() }, icon("upload"), "Restore a back-up"), file)),
    standalone ? null : h("section", null, h("h3", null, "Install"),
      P.bip ? h("div", { class: "row-btns" }, h("button", { type: "button", class: "btn primary", onclick: () => { L.close(); install(); } }, icon("download"), "Install Plot"))
        : h("p", null, "Use your browser's install button in the address bar, or its menu: Apps, then Install Plot. On an iPhone: Share, then Add to Home Screen.")),
    h("p", { class: "fine" }, `Plot ${VERSION}. Works offline once opened.`));
  const L = layer(box);
}
function backup() {
  const data = { app: "Plot", version: 1, at: now(), folders: P.folders, notes: [...P.notes.values()].map(n => { const o = Object.assign({}, n); delete o._saved; return o; }) };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `Plot notes ${dayKey(new Date())}.json` }); document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  ls("plot-backup", now()); toast("Back-up downloaded");
}
async function restoreFrom(file) {
  let data; try { data = JSON.parse(await file.text()); } catch (e) { return toast("That file isn't a Plot back-up"); }
  if (!data || data.app !== "Plot" || !Array.isArray(data.notes)) return toast("That file isn't a Plot back-up");
  let added = 0, updated = 0;
  for (const f of Array.isArray(data.folders) ? data.folders : []) if (f && typeof f.id === "string" && typeof f.name === "string" && !P.folders.some(x => x.id === f.id)) P.folders.push({ id: f.id.slice(0, 60), name: f.name.slice(0, 60) });
  for (const raw of data.notes) {
    const n = cleanNote(raw), mine = P.notes.get(n.id);
    if (mine && (mine.updated || "") >= (n.updated || "")) continue;
    if (mine) updated++; else added++;
    await save(n);
  }
  await saveFolders(); render();
  toast(added || updated ? `Restored: ${plural(added, "note")} added${updated ? `, ${updated} brought up to date` : ""}` : "Nothing new in that back-up");
}
async function install() { const e = P.bip; if (!e) return; P.bip = null; e.prompt(); try { await e.userChoice; } catch (x) { } render(); }
addEventListener("beforeinstallprompt", e => { e.preventDefault(); P.bip = e; if (P.ready) render(); });
addEventListener("appinstalled", () => { P.bip = null; toast("Plot is installed. Find it on your taskbar or home screen."); if (P.ready) render(); });

/* ---- a one-time move from Laro: Laro opens Plot with #from-laro and hands the notes over, origin to origin */
function fromLaro() {
  if (location.hash !== "#from-laro" || !window.opener) return;
  history.replaceState(null, "", location.pathname + location.search);
  addEventListener("message", async e => {
    if (e.origin !== LARO_ORIGIN || !e.data || e.data.type !== "plot-notes" || !Array.isArray(e.data.notes)) return;
    let added = 0;
    for (const raw of e.data.notes.slice(0, 5000)) { const n = cleanNote(raw); if (P.notes.has(n.id)) continue; await save(n); added++; }
    render();
    try { e.source.postMessage({ type: "plot-done", n: added, ids: e.data.notes.map(x => x && x.id).filter(Boolean) }, LARO_ORIGIN); } catch (x) { }
    toast(added ? `Moved ${plural(added, "note")} over from Laro` : "Your Laro notes were already here");
  });
  try { window.opener.postMessage({ type: "plot-ready" }, LARO_ORIGIN); } catch (e) { }
}

/* ---- keys */
addEventListener("keydown", e => {
  if (e.key === "Escape") { if (MENU) { closeMenu(); e.preventDefault(); return; } if (closeTop()) { e.preventDefault(); return; } if (P.keyOpen) { toggleKey(); return; } }
  const t = e.target, typing = t && (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable);
  if (typing || e.ctrlKey || e.metaKey || e.altKey || LAYERS.length) return;
  if (e.key === "/") { const q = $(".q"); if (q) { e.preventDefault(); q.focus(); } }
  else if (e.key === "n" && !(P.view === "board" && document.activeElement && document.activeElement.closest(".board"))) { e.preventDefault(); create(); }
});
addEventListener("pagehide", () => { if (P.timers.size) flush(); });
addEventListener("resize", debounce(() => { if (P.view === "notes" && P.ready) { const narrow = innerWidth <= 820; if (narrow !== P.wasNarrow) { P.wasNarrow = narrow; repaint(); } } }, 150));
if (BC) BC.onmessage = async e => {
  const m = e.data || {};
  if (m.t === "put") { const r = await DB.get(m.id); if (r && !P.timers.has(m.id)) { const n = cleanNote(r); n._saved = true; P.notes.set(n.id, n); repaint(); } }
  else if (m.t === "del") { if (!P.timers.has(m.id)) { P.notes.delete(m.id); repaint(); } }
  else if (m.t === "meta") { P.folders = (await DB.meta("folders")) || []; P.set = Object.assign({ theme: "system" }, (await DB.meta("settings")) || {}); applyTheme(); repaint(); }
};

/* ---- start */
async function start() {
  applyTheme();
  try { await DB.open(); } catch (e) {
    $("#app").append(h("div", { class: "empty fatal" }, logo(54), h("b", null, "Plot can't save in this window"), h("p", null, (e && e.message ? e.message + ". " : "") + "Private or incognito windows don't keep notes; open Plot in a normal window.")));
    return;
  }
  P.set = Object.assign({ theme: "system" }, (await DB.meta("settings")) || {}); applyTheme();
  P.folders = ((await DB.meta("folders")) || []).filter(f => f && f.id && f.name);
  for (const r of await DB.all()) { const n = cleanNote(r); n._saved = true; P.notes.set(n.id, n); }
  const cut = Date.now() - KEEP_DAYS * 864e5;
  for (const n of [...P.notes.values()]) if (n.deleted && Date.parse(n.deleted) < cut) await destroy(n.id);
  P.ready = true; P.wasNarrow = innerWidth <= 820;
  render();
  fromLaro();
  if ("serviceWorker" in navigator && (location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
    navigator.serviceWorker.register("sw.js").then(reg => {
      reg.addEventListener("updatefound", () => { const w = reg.installing; if (w) w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) toast("A new version of Plot is ready", "Update", () => { flush().then(() => w.postMessage("skip")); }, 20000); }); });
      let swapped = false; navigator.serviceWorker.addEventListener("controllerchange", () => { if (swapped) return; swapped = true; location.reload(); });
    }).catch(() => { });
  }
}
start();
