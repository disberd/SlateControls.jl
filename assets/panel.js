// The controls panel component. It shows copies of the pinned controls. A copy posts its edits to
// the cell that declares the control. Slate then shows the new value in the copy and in the
// original control, because it updates all the controls on the page.
import { html } from "@slate/widget";
import { useEffect, useRef } from "preact/hooks";
import { controlMarkup, wireControl, notebookState, notebookCells, teardownControls }
  from "slatecontrols/adapter";

// The ref to the body of the panel that shows its controls. A page shows only one panel. The
// other panels show an error. The owner is live until its element leaves the page.
let owner = null;
const isLive = ref => ref !== null && (ref.current === null || ref.current.isConnected);

// The id of the declaring cell and the bind spec, for each pinned name that has a control.
function pinnedControls(cells, pinned) {
  const found = new Map();
  for (const c of cells)
    for (const b of c.binds || []) if (!found.has(b.name)) found.set(b.name, [c.id, b]);
  return pinned.filter(n => found.has(n)).map(n => found.get(n));
}

export default function ControlsPanel({ params }) {
  if (notebookState() === null) return null;           // a static page
  const body = useRef(null);
  if (!isLive(owner)) owner = body;
  const mine = owner === body;
  useEffect(() => () => { if (owner === body) owner = null; }, []);

  const controls = pinnedControls(notebookCells(), (params && params.pinned) || []);
  // The key has no values: Slate changes the values of the copies in place. A new key draws the
  // copies again, so a copy that the reader moves keeps its element.
  const key = JSON.stringify(controls.map(([id, b]) => [id, b.name, b.widget, b.params]));
  useEffect(() => {
    const el = body.current;
    if (!mine || el === null) return;
    teardownControls(el);
    el.innerHTML = controls.map(([id, b]) => `<div class="widget">${controlMarkup(id, b)}</div>`).join("");
    el.querySelectorAll("[data-bind]").forEach(wireControl);
  }, [key, mine]);

  if (!mine) {
    const cell = owner.current && owner.current.closest(".cell");
    const where = cell ? ` in cell ${cell.dataset.cid}` : "";
    return html`<div class="slatecontrols-panel-error" style="color: var(--red)">
      This page has a ControlsPanel${where}. A page shows only one ControlsPanel. Remove this one.
    </div>`;
  }
  return html`<div class="slatecontrols-panel">
    ${controls.length === 0 && html`<div class="hint">No pinned name has a control.</div>`}
    <div ref=${body}></div>
  </div>`;
}
