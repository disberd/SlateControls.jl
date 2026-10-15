// The controls panel component. It shows copies of controls that other cells declare. A copy posts
// its edits to the cell that declares the control. Slate then shows the new value in the copy and
// in the original control, because it updates all the controls on the page.
//
// The file has three parts:
// - Copies: draw and wire one copy of a control.
// - List: select the controls to show, put them in groups, and draw them in the panel body.
// - Frame: the panel window, its reader state, and the rule of one panel for each page.
import { html } from "@slate/widget";
import { useEffect, useRef, useState } from "preact/hooks";
import { controlMarkup, wireControl, transBinduses, notebookState, notebookCells, teardownControls,
  typesetControls }
  from "slatecontrols/adapter";

// ── Copies ───────────────────────────────────────────────────────────────────────────────────────

// The copy of the control `b` that the cell `cellId` declares. The copy is not wired: call
// `wireCopies` after it is in the page.
//
// The element is a `form` for two reasons. Radio inputs with one name make one group only inside one
// form owner, so the radios of a copy do not share a selection with the radios of the original, and
// they keep that after Slate builds the options again under the name of the original. The `form`
// also stops a submit (Enter in a text field, a button of a custom widget) from reloading the page.
function copyElement(cellId, b) {
  const el = document.createElement("form");
  el.className = "widget";                // the class gives the `.wval` value mirror and the style
  el.addEventListener("submit", e => e.preventDefault());
  el.innerHTML = controlMarkup(cellId, b);
  // A kind that Slate does not draw is a custom widget. Its front end fills the empty container
  // when it registers. The hint shows only while the container is empty (see panel.css).
  if (el.querySelector(".customwidget")) {
    const hint = document.createElement("span");
    hint.className = "sc-nokind";
    hint.textContent = `No front end is registered for the widget kind "${b.widget}".`;
    el.append(hint);
  }
  return el;
}

// The panel draws a copy again when this key changes. The key has no value: Slate changes the
// values of the copies in place, so a copy keeps its element while the reader moves it.
const copyKey = (cellId, b) => JSON.stringify([cellId, b.name, b.widget, b.params]);

// Wire the copies under `root`. Call it after `root` is in the page. A copy is wired one time:
// Slate wires every `[data-bind]` element of the panel cell again when that cell gets a bind or a
// control strip, and a second wiring adds a second listener (a `multiselect` row then toggles
// twice for one click). After the first wiring, the element ignores new listeners. A custom widget
// is not changed: Slate wires it one time and the widget can add listeners later.
function wireCopies(root) {
  root.querySelectorAll("[data-bind]").forEach(el => {
    if (el._scWired) return;
    el._scWired = true;
    wireControl(el);
    if (!el.classList.contains("customwidget")) el.addEventListener = () => {};
  });
  root.querySelectorAll(".radiogroup, .checkgroup, .mslist").forEach(typesetControls);  // `$math$` in labels
}

// Release the copies under `root`, before the panel removes them.
function teardownCopies(root) {
  teardownControls(root);
}

// ── List ─────────────────────────────────────────────────────────────────────────────────────────

const MODES = [["pinned", "Pinned"], ["in_view", "In view"], ["both", "Both"], ["all", "All"]];

// The result parts of a cell. The editor and the header are not in the list.
const RESULT_PARTS = "#nb .cell > :is(.binds, .controls, .output, .tables, .echarts, .anim, .md)";

// The ids of the cells that are in view: a result part of the cell is at least 1 px inside the
// window, minus a band of 10% at the top and at the bottom. The value is null until the first
// check. The ids change 175 ms after the last scroll or notebook update, and never while the
// pointer is over the panel or a panel control has focus. Call it from a component. `cells` is the
// notebook state: a new value makes the hook look for new result parts.
function useInView(frame, cells) {
  const [inView, setInView] = useState(null);
  const watch = useRef(null);                   // { rescan }: the observer of the mounted component
  useEffect(() => {
    const root = frame.current;
    const parts = new Map();                    // result part -> { cell, on }: `on` is true in view
    let timer = 0, first = true;
    const frozen = () => root.matches(":hover") || root.contains(document.activeElement);
    const settle = () => {
      if (frozen()) return;                     // the leave of the pointer or the focus starts it again
      const own = (root.closest(".cell") || {}).dataset;
      const ids = new Set();
      for (const p of parts.values()) if (p.on && !(own && p.cell === own.cid)) ids.add(p.cell);
      setInView(old => old && old.size === ids.size && [...ids].every(i => old.has(i)) ? old : ids);
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(settle, 175); };
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const p = parts.get(e.target);
        if (p) p.on = e.isIntersecting && e.intersectionRect.height >= 1;
      }
      if (first) { first = false; settle(); } else schedule();
    }, { rootMargin: "-10% 0px -10% 0px" });
    watch.current = { rescan() {
      const live = new Set(document.querySelectorAll(RESULT_PARTS));
      for (const el of [...parts.keys()]) if (!live.has(el)) { io.unobserve(el); parts.delete(el); }
      for (const el of live) if (!parts.has(el)) {
        parts.set(el, { cell: el.parentElement.dataset.cid, on: false });
        io.observe(el);
      }
      schedule();
    } };
    root.addEventListener("pointerleave", schedule);
    root.addEventListener("focusout", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      clearTimeout(timer);
      io.disconnect();
      root.removeEventListener("pointerleave", schedule);
      root.removeEventListener("focusout", schedule);
      window.removeEventListener("scroll", schedule);
    };
  }, []);
  useEffect(() => { watch.current.rescan(); }, [cells]);
  return inView;
}

// The controls that the panel shows, as items `{ cellId, bind, pinned }`: the declaring cell, the
// bind spec, and true for a pinned control. The order is the notebook order of the declaring cell,
// then the declaration order in the cell. Without groups, the pinned controls of the modes
// "pinned" and "both" come first, in the order of `pinned`.
function panelItems(cells, pinned, mode, grouping, inView) {
  const all = [], seen = new Set(), near = new Set();
  for (const c of cells) {
    for (const b of c.binds || []) if (!seen.has(b.name)) {
      seen.add(b.name);
      all.push({ cellId: c.id, bind: b, pinned: pinned.includes(b.name) });
    }
    if (inView.has(c.id)) {
      for (const b of c.binds || []) near.add(b.name);
      for (const n of transBinduses(c)) near.add(n);
    }
  }
  const keep = { pinned: i => i.pinned, in_view: i => near.has(i.bind.name),
                 both: i => i.pinned || near.has(i.bind.name), all: () => true }[mode];
  const items = all.filter(keep);
  if (grouping || (mode !== "pinned" && mode !== "both")) return items;
  const rank = i => i.pinned ? pinned.indexOf(i.bind.name) : pinned.length;
  return items.sort((a, b) => rank(a) - rank(b));          // a stable sort keeps the other order
}

// One control. The copy is in the page as long as the row lives. A row has the key of its copy, so
// the panel draws a copy again only when the control changes its cell, kind or `params`. A change of
// the pin mark or of the group does not touch the copy.
function Row({ item, showPin }) {
  const slot = useRef(null);
  useEffect(() => {
    const el = slot.current;
    el.append(copyElement(item.cellId, item.bind));
    wireCopies(el);
    return () => teardownCopies(el);
  }, []);
  return html`<div class="sc-row" data-name=${item.bind.name}>
    ${showPin && html`<span class=${"sc-pin" + (item.pinned ? " sc-lit" : "")}
      title=${item.pinned ? "Pinned" : "Not pinned"}>📌</span>`}
    <div class="sc-slot" ref=${slot}></div>
  </div>`;
}

const jumpTo = id => {
  const el = document.getElementById("cell-" + id);
  if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
};

const EMPTY = {
  pinned: "No pinned name has a control.",
  in_view: "No controls affect the cells in view",
  both: "No pinned control, and no control affects the cells in view",
  all: "The notebook has no controls.",
};

// The body of the panel: the mode switch, the grouping switch and the controls.
function ControlsList({ pinned, ui, setUi, frame }) {
  const cells = notebookCells();
  const inView = useInView(frame, cells);
  const mode = MODES.some(m => m[0] === ui.mode) ? ui.mode : "pinned";
  const items = panelItems(cells, pinned, mode, ui.grouping, inView || new Set());
  const row = i => html`<${Row} key=${copyKey(i.cellId, i.bind)} item=${i} showPin=${mode !== "pinned"} />`;

  let body;
  if (ui.grouping) {
    const groups = new Map();
    for (const i of items) groups.set(i.cellId, [...(groups.get(i.cellId) || []), i]);
    const fold = id => setUi({ folded: ui.folded.includes(id) ? ui.folded.filter(f => f !== id) : [...ui.folded, id] });
    body = [...groups].map(([id, rows]) => {
      const folded = ui.folded.includes(id);
      return html`<div class=${"sc-group" + (folded ? " sc-folded" : "")} key=${id}>
        <div class="sc-ghead">
          <button class="sc-fold" aria-expanded=${!folded} title=${folded ? "Unfold" : "Fold"}
            onClick=${() => fold(id)}>${folded ? "▸" : "▾"}</button>
          <button class="sc-gname" title="Go to the cell" onClick=${() => jumpTo(id)}>${id}</button>
          ${inView && inView.has(id) && html`<span class="sc-seen" title="The cell is in view">●</span>`}
        </div>
        <div class="sc-gbody">${rows.map(row)}</div>
      </div>`;
    });
  } else body = items.map(row);

  return html`
    <div class="sc-bar">
      <div class="sc-seg" role="group" aria-label="Mode">
        ${MODES.map(([m, label]) => html`<button key=${m} class=${m === mode ? "sc-on" : ""}
          aria-pressed=${m === mode} onClick=${() => setUi({ mode: m })}>${label}</button>`)}
      </div>
      <button class=${"sc-switch" + (ui.grouping ? " sc-on" : "")} aria-pressed=${ui.grouping}
        title="Group the controls by cell" onClick=${() => setUi({ grouping: !ui.grouping })}>Groups</button>
    </div>
    ${items.length === 0 && (mode !== "in_view" || inView !== null) && html`<div class="sc-empty">${EMPTY[mode]}</div>`}
    <div class="sc-body">${body}</div>`;
}

// ── Frame ────────────────────────────────────────────────────────────────────────────────────────

// The ref to the frame of the panel that owns the page. A page shows only one panel. The other
// panels show an error. The owner is live until its element leaves the page.
let owner = null;
const isLive = ref => ref !== null && (ref.current === null || ref.current.isConnected);

// The reader state of the panel. `setUi(patch)` merges `patch` into it.
const initialUi = params => ({
  mode: (params && params.mode) || "pinned",   // "pinned", "in_view", "both" or "all"
  grouping: true,                              // groups by declaring cell
  folded: [],                                  // the ids of the folded group cells
  collapsed: false,
  layout: "side",                              // "side" or "float"
  side: "right",                               // "right" or "left"
  width: 320,                                  // the width of the side panel, in px
  float: null,                                 // { x, y, w, h } of the floating window, in px
});

// Sizes in px. The side panel keeps `MIN_SIDE` and a margin of `SIDE_GAP` at the other edge of the
// window. A window that the reader drops within `EDGE` of the left or right edge docks there.
const MIN_SIDE = 200, SIDE_GAP = 48, MIN_W = 220, MIN_H = 120, EDGE = 32;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

// The height of the Slate top bar: the panel stays below it. It is 0 where Slate hides the bar.
const topInset = () => {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h"));
  return Number.isNaN(v) ? 49 : v;
};
const viewport = () => {
  const d = document.documentElement;
  return { w: d.clientWidth, h: d.clientHeight, top: topInset() };
};

// The window before the reader moves it: at the top right, below the top bar.
const defaultFloat = () => {
  const v = viewport();
  return { x: Math.max(0, v.w - 344), y: v.top + 24, w: 320, h: 360 };
};

// The CSS of the side panel and of the floating window. The panel keeps its size and position in
// the window when the window gets smaller, so the reader cannot lose it off screen.
const T = "var(--topbar-h, 49px)";
const sideStyle = ui => `width: clamp(${MIN_SIDE}px, ${ui.width}px, calc(100% - ${SIDE_GAP}px))`;
const floatStyle = f =>
  `width: min(${f.w}px, 100%); height: min(${f.h}px, calc(100% - ${T})); ` +
  `left: max(0px, min(${f.x}px, calc(100% - min(${f.w}px, 100%)))); ` +
  `top: max(${T}, min(${f.y}px, calc(100% - min(${f.h}px, 100% - ${T}))))`;

// Start a pointer drag on the current target. `move` runs for each pointer move. `done` runs one
// time at the end, with the `pointerup` or `pointercancel` event.
function track(e, move, done) {
  if (e.button !== 0) return;
  e.preventDefault();
  const el = e.currentTarget;
  el.setPointerCapture(e.pointerId);
  const end = ev => {
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", end);
    el.removeEventListener("pointercancel", end);
    if (done) done(ev);
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

export default function ControlsPanel({ params }) {
  if (notebookState() === null) return null;           // a static page
  const frame = useRef(null);
  if (!isLive(owner)) owner = frame;
  const mine = owner === frame;
  useEffect(() => () => { if (owner === frame) owner = null; }, []);
  const [ui, setUiState] = useState(() => initialUi(params));
  const setUi = patch => setUiState(u => ({ ...u, ...patch }));
  const [dock, setDock] = useState(null);                // the edge that a drop would dock at

  if (!mine) {
    const cell = owner.current && owner.current.closest(".cell");
    const where = cell ? ` in cell ${cell.dataset.cid}` : "";
    return html`<div class="slatecontrols-panel-error" style="color: var(--red)">
      This page has a ControlsPanel${where}. A page shows only one ControlsPanel. Remove this one.
    </div>`;
  }

  const side = ui.layout === "side";

  // Drag the floating window by its header. A drop at the left or right edge docks it there.
  const startMove = e => {
    if (side || e.target.closest("button")) return;
    const r = frame.current.getBoundingClientRect(), v = viewport();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const edge = ev => (ev.clientX <= EDGE ? "left" : ev.clientX >= v.w - EDGE ? "right" : null);
    track(e, ev => {
      setUi({ float: {
        x: clamp(ev.clientX - dx, 0, v.w - r.width),
        y: clamp(ev.clientY - dy, v.top, v.h - r.height),
        w: r.width, h: r.height,
      } });
      setDock(edge(ev));
    }, ev => {
      setDock(null);
      const to = ev.type === "pointerup" ? edge(ev) : null;
      if (to) setUi({ layout: "side", side: to, collapsed: false });
    });
  };

  // Resize the side panel from its inner edge. The edge keeps its distance from the pointer.
  const startSideResize = e => {
    const v = viewport(), x0 = e.clientX, w0 = frame.current.getBoundingClientRect().width;
    const dir = ui.side === "right" ? -1 : 1;
    track(e, ev => setUi({
      width: Math.round(clamp(w0 + dir * (ev.clientX - x0), MIN_SIDE, v.w - SIDE_GAP)),
    }));
  };

  // Resize the floating window from its bottom right corner. The corner keeps its distance from
  // the pointer.
  const startFloatResize = e => {
    const r = frame.current.getBoundingClientRect(), v = viewport();
    track(e, ev => setUi({ float: {
      x: r.left, y: r.top,
      w: Math.round(clamp(r.width + ev.clientX - e.clientX, MIN_W, v.w - r.left)),
      h: Math.round(clamp(r.height + ev.clientY - e.clientY, MIN_H, v.h - r.top)),
    } }));
  };

  const cls = `slatecontrols-panel sc-${ui.layout} sc-${ui.side}${ui.collapsed ? " sc-collapsed" : ""}`;
  const style = ui.collapsed ? "" : side ? sideStyle(ui) : floatStyle(ui.float || defaultFloat());
  const collapseMark = side ? (ui.side === "right" ? "»" : "«") : "–";
  return html`<div class=${cls} style=${style} ref=${frame}>
    <div class="sc-header" onPointerDown=${startMove}>
      <span class="sc-title">Controls</span>
      ${side && html`<button title="Move to the other side" aria-label="Move to the other side"
        onClick=${() => setUi({ side: ui.side === "right" ? "left" : "right" })}>⇄</button>`}
      <button title=${side ? "Show as a floating window" : "Dock as a side panel"}
        aria-label=${side ? "Show as a floating window" : "Dock as a side panel"}
        onClick=${() => setUi({ layout: side ? "float" : "side" })}>${side ? "◱" : "▐"}</button>
      <button title="Collapse" aria-label="Collapse" onClick=${() => setUi({ collapsed: true })}>${collapseMark}</button>
    </div>
    <div class="sc-content">
      <${ControlsList} pinned=${(params && params.pinned) || []} ui=${ui} setUi=${setUi} frame=${frame} />
    </div>
    <div class="sc-grip" onPointerDown=${side ? startSideResize : startFloatResize}></div>
    <button class="sc-tab" title="Show the controls" onClick=${() => setUi({ collapsed: false })}>⚙ Controls</button>
    ${dock && html`<div class=${`sc-dockhint sc-dock-${dock}`}></div>`}
  </div>`;
}
