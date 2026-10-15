@testitem "ControlsPanel renders the controls-panel component" begin
    using SlateExtensionsBase: slate_render
    d = slate_render(ControlsPanel(:b, :a))
    @test d["component"] == "controls-panel"
    @test d["props"]["pinned"] == ["b", "a"]
    @test d["props"]["mode"] == "pinned"
end

@testitem "ControlsPanel with no names pins no control" begin
    using SlateExtensionsBase: slate_render
    @test isempty(slate_render(ControlsPanel())["props"]["pinned"])
end

@testitem "ControlsPanel accepts each mode" begin
    using SlateExtensionsBase: slate_render
    for (mode, sent) in (:pinned => "pinned", :in_view => "in_view", :both => "both", :all => "all")
        @test slate_render(ControlsPanel(:a; mode))["props"]["mode"] == sent
    end
end

@testitem "ControlsPanel rejects an unknown mode" begin
    @test_throws "mode must be one of :pinned, :in_view, :both, :all" ControlsPanel(:a; mode = :sideways)
    @test_throws "mode must be one of" ControlsPanel(:a; mode = "pinned")
end
