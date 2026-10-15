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
import { controlMarkup, wireControl, notebookState, notebookCells, teardownControls }
  from "slatecontrols/adapter";

// ── Copies ───────────────────────────────────────────────────────────────────────────────────────

// The copy of the control `b` that the cell `cellId` declares. The copy is not wired: call
// `wireCopies` after it is in the page.
function copyElement(cellId, b) {
  const el = document.createElement("div");
  el.className = "widget";                // the class gives the `.wval` value mirror and the style
  el.innerHTML = controlMarkup(cellId, b);
  return el;
}

// The panel draws a copy again when this key changes. The key has no value: Slate changes the
// values of the copies in place, so a copy keeps its element while the reader moves it.
const copyKey = (cellId, b) => JSON.stringify([cellId, b.name, b.widget, b.params]);

// Wire the copies under `root`. Call it after `root` is in the page.
function wireCopies(root) {
  root.querySelectorAll("[data-bind]").forEach(wireControl);
}

// Release the copies under `root`, before the panel removes them.
function teardownCopies(root) {
  teardownControls(root);
}

// ── List ─────────────────────────────────────────────────────────────────────────────────────────

// The controls that the panel shows, in groups. A group is `{ cellId, items }`, and an item is
// `{ cellId, bind, pinned }`: the declaring cell, the bind spec, and true for a pinned control. The
// `cellId` of a group is null when the list has no groups.
function panelGroups(cells, pinned, ui) {
  const found = new Map();
  for (const c of cells)
    for (const b of c.binds || [])
      if (!found.has(b.name)) found.set(b.name, { cellId: c.id, bind: b, pinned: true });
  const items = pinned.filter(n => found.has(n)).map(n => found.get(n));
  return items.length === 0 ? [] : [{ cellId: null, items }];
}

// The body of the panel: the controls in their groups.
function ControlsList({ pinned, ui, setUi, frame }) {
  const body = useRef(null);
  const groups = panelGroups(notebookCells(), pinned, ui);
  const key = JSON.stringify(groups.map(g => [g.cellId, g.items.map(i => copyKey(i.cellId, i.bind))]));
  useEffect(() => {
    const el = body.current;
    if (el === null) return;
    teardownCopies(el);
    el.replaceChildren(...groups.flatMap(g => g.items.map(i => copyElement(i.cellId, i.bind))));
    wireCopies(el);
  }, [key]);

  return html`
    ${groups.length === 0 && html`<div class="hint">No pinned name has a control.</div>`}
    <div class="sc-body" ref=${body}></div>`;
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
