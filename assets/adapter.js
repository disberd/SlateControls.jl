// The only module that touches undocumented Slate page helpers. The composite widget and the
// controls panel import the helpers from here. When Slate ships a documented `Slate.controls`
// API, change only this file.
//
// Slate loads view.js and cellops.js as classic scripts, so their top-level functions are
// properties of `window`.

const REQUIRED = ['controlMarkup', 'wireControl', 'transBinduses'];

// A static page has no notebook state and no helpers. Do the check only on a live page.
const missing = window.__slateState ? REQUIRED.filter(n => typeof window[n] !== 'function') : [];
if (missing.length) {
  console.error(`SlateControls: this Slate version does not have ${missing.join(', ')}. ` +
                'Use the Slate version that the SlateControls compat entry gives.');
}

export const ok = missing.length === 0;

// Markup of one control, as Slate draws it in a cell.
export const controlMarkup = (bindId, b) => window.controlMarkup(bindId, b);

// Wire a control element: its edits post to the bind of `el.dataset.bind`.
export const wireControl = el => window.wireControl(el);

// The bind names that a cell reads, directly or through its upstream cells.
export const transBinduses = cell => window.transBinduses(cell);

// The live notebook state. A static page has none.
export const notebookState = () => window.__slateState || null;

// The cells of the live notebook. Read it in a component render: the component then renders
// again when the notebook changes. The value is `[]` on a static page.
export const notebookCells = () =>
  window.slateStore ? window.slateStore.cells.value : ((notebookState() || {}).cells || []);

// Release the resources of the custom controls under `root`, before the panel removes them.
export const teardownControls = root => window.slateTeardownOutput && window.slateTeardownOutput(root);

// Typeset the math in the labels of the controls under `root`. Slate typesets only at page load
// and when it mounts the controls of a cell.
export const typesetControls = root => window.typeset && window.typeset(root);
