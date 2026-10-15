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

#%% code id=panel
ControlsPanel(:freq, :color, :grid, :title, :nothere)

#%% code id=1d38a4
ControlsPanel(:freq, :color, :grid, :title, :nothere)

# ╔═╡ Slate.config · per-notebook settings (Settings panel)
#   docid = ea36326c-752e-4995-9285-9ad4ee5f0072
# ╚═╡
