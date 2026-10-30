# SlateControls.jl

SlateControls adds a controls panel to [KaimonSlate](https://github.com/kahliburke/KaimonSlate.jl)
notebooks. The panel is a side panel or a floating window. It shows copies of the `@bind` controls
that other cells declare. An edit in a copy changes the bound value, as an edit in the original
control does.

## Requirements

- Julia 1.12 or later.
- KaimonSlate 1.12.1 or later. On an older Slate, the panel logs an error in the browser console.

## Installation

The package is not registered. Add it to the project of your notebook from the repository URL:

```julia
using Pkg
Pkg.add(url = "https://github.com/disberd/SlateControls.jl")
```

## Usage

This notebook fragment declares two controls and a panel that pins both:

```julia
using SlateControls

@bind freq Slider(1:10; default = 3)
@bind color Select(["red", "green", "blue"])

ControlsPanel(:freq, :color)
```

Put `ControlsPanel(...)` in its own cell. The output of that cell is the panel.

`ControlsPanel(names::Symbol...; mode = :pinned)` takes these arguments:

- `names`: the pinned controls. The panel skips a name that has no control.
- `mode`: the controls that the panel shows at first load. `:pinned` shows the pinned controls.
  `:in_view` shows the controls that the cells in view declare or use. `:both` shows the two
  lists together. `:all` shows all the controls of the notebook.

## Reader settings

The reader can pin and unpin controls, change the mode, group the controls by cell, and switch
between the side panel and the floating window. The browser keeps these settings for each
notebook. The reset button of the panel removes them.

## Limits

- Use one `ControlsPanel` on a page. A second panel shows an error in its output.
- Do not set the `collapsed` or `notes` flag on the panel cell. Slate hides the output of these
  cells, and the panel is in that output.
- On a static HTML export, the panel shows nothing. The controls in their cells work as before.

## Demo

`notebooks/panel_demo.jl` declares one control of each built-in kind and a panel. Open it in
KaimonSlate to try the panel.
