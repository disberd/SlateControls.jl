module SlateControls

using SlateExtensionsBase: provide_assets!, provide_import!, ext_asset_url, @pkg_dir, @pkg_asset,
    register_component!, component, provide_frontend!
import SlateExtensionsBase: slate_render

export ControlsPanel

include("panel.jl")

# Slate calls this hook one time for each notebook namespace. Registration from here, not from
# `__init__`, lets Revise pick up edits.
function __slate_frontend(_slate_on)
    provide_assets!(@__MODULE__, @pkg_dir("assets"))
    provide_import!("slatecontrols/adapter", ext_asset_url(@__MODULE__, "adapter.js"))
    register_component!("controls-panel", @pkg_asset("assets/panel.js"))
    css = @pkg_asset("assets/panel.css")
    provide_frontend!(string(
        "(function(){var id='slatecontrols-panel-css';if(document.getElementById(id))return;",
        "var s=document.createElement('style');s.id=id;s.textContent=", repr(css), ";",
        "document.head.appendChild(s);})();"); id = "SlateControls.panel-css")
    return nothing
end

end
