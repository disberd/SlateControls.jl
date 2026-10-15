try; import KaimonSlate; catch; error("This is a Kaimon Slate notebook — running it as plain Julia needs the KaimonSlate runtime in this environment. Add it with `import Pkg; Pkg.add(\"KaimonSlate\")`, or open it in Kaimon Slate."); end; KaimonSlate.standalone!(@__MODULE__; dir=@__DIR__)

#%% md id=intro
@md"""
# Controls panel demo

The cells below declare controls of different kinds. The last cell is a `ControlsPanel`. It shows
copies of its pinned controls. Change a copy, and the original control and the readout change too.
The pinned name `:nothere` has no control, so the panel skips it.
"""

#%% code id=pkg
using SlateControls

#%% code id=numbers
@bind freq Slider(1:10; default = 3)
@bind n NumberField(1, 100, 5)

#%% code id=choices
@bind color Select(["red", "green", "blue"])
@bind grid Checkbox(true)

#%% code id=words
@bind title TextField("A plot")

#%% code id=readout
(; freq, n, color, grid, title)

#%% md id=view_intro
@md"""
## Cells for the in-view check

Each cell below is about one window high. Scroll to bring different cells into view. The panel in the mode **In view** lists the controls that the cells in view declare or use.
"""

#%% code id=view_pad
pad(text) = HTML("<div style='min-height:70vh;padding:.5em 1em;border-left:3px solid var(--border)'>$text</div>")

#%% code id=view_direct
pad("<b>view_direct</b> reads <code>freq</code> in the code: freq = $freq")

#%% code id=view_observed
let o = bind_observable(:n)   # the name is quoted: no read, no edge
    pad("<b>view_observed</b> names <code>n</code> only in <code>bind_observable(:n)</code>")
end

#%% code id=view_upstream_a
palette = color == "red" ? "warm" : "cool"

#%% code id=view_upstream_b
pad("<b>view_upstream_b</b> reads <code>palette</code>. The cell above computes it from <code>color</code>: $palette")

#%% code id=view_seed
@bind seed hidden(Slider(1:100; default = 7))

#%% code id=view_seeded
pad("<b>view_seeded</b> reads the hidden control <code>seed</code>: seed = $seed")

#%% code id=view_none
pad("<b>view_none</b> reads no control")

#%% code id=panel
ControlsPanel(:freq, :color, :grid, :title, :nothere)

# ╔═╡ Slate.env · notebook packages (auto-maintained — manage via the package panel)
#   Observables 0.5.5 510215fc-4207-5dde-b226-833fc4488ee2
# ╚═╡
# ╔═╡ Slate.config · per-notebook settings (Settings panel)
#   docid = ea36326c-752e-4995-9285-9ad4ee5f0072
# ╚═╡
