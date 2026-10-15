const PANEL_MODES = (:pinned, :in_view, :both, :all)

"""
    ControlsPanel(names::Symbol...; mode = :pinned)

A controls panel: a window on the notebook page that shows copies of the controls that other cells
declare. Return it from a cell. The output of the cell is the panel. An edit in a copy changes the
bound value, as an edit in the original control does.

`names` are the pinned controls. The panel skips a name that has no control.

`mode` selects the controls that the panel shows:

- `:pinned`: the pinned controls.
- `:in_view`: the controls that the cells in view declare or use.
- `:both`: the pinned controls and the in-view controls.
- `:all`: all the controls of the notebook.

Use one `ControlsPanel` on a page. A second panel shows an error in its output. On a static page,
the panel shows nothing.
"""
struct ControlsPanel
    pinned::Vector{Symbol}
    mode::Symbol
    function ControlsPanel(names::Symbol...; mode = :pinned)
        mode in PANEL_MODES || throw(ArgumentError(
            "ControlsPanel: mode must be one of :pinned, :in_view, :both, :all. " *
            "The value $(repr(mode)) is not a mode."))
        return new(collect(names), mode)
    end
end

slate_render(p::ControlsPanel) =
    component("controls-panel"; pinned = String.(p.pinned), mode = String(p.mode))
