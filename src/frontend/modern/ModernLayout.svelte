<script lang="ts">
    import AiFloating from "../ai/components/floating/AiFloating.svelte"
    import { customActionActivation } from "../components/actions/actions"
    import DrawTabs from "../components/draw/DrawTabs.svelte"
    import Navigation from "../components/edit/Navigation.svelte"
    import LazyLoad from "../components/helpers/LazyLoad.svelte"
    import ProfileChangerMenu from "../components/main/ProfileChangerMenu.svelte"
    import Tipbar from "../components/main/Tipbar.svelte"
    import Preview from "../components/output/preview/Preview.svelte"
    import SettingsTabs from "../components/settings/SettingsTabs.svelte"
    import Projects from "../components/show/Projects.svelte"
    import Show from "../components/show/Show.svelte"
    import ShowTools from "../components/show/ShowTools.svelte"
    import StageLayouts from "../components/stage/StageLayouts.svelte"
    import Resizeable from "../components/system/Resizeable.svelte"
    import Timeline from "../components/timeline/Timeline.svelte"
    import { activeEdit, activePage, activeProfile, activeProject, activeShow, activeStage, ai, dictionary, editMode, focusMode, loaded, outputDisplay, projectView, resized, showChangeProfileMenu, showsCache, special } from "../stores"
    import { DEFAULT_WIDTH } from "../utils/common"
    import { translateText } from "../utils/language"
    import ModernTopBar from "./components/ModernTopBar.svelte"

    $: page = $activePage

    let previousId = ""
    $: if ($activeShow?.id !== previousId) showOpened()
    function showOpened() {
        if (!$activeShow?.id || $activeShow?.type !== "show") return

        // allow show to actually open before triggering
        setTimeout(() => customActionActivation("show_opened"), 50)
        previousId = $activeShow?.id
    }

    $: drawerVisible = $loaded && (page === "show" || page === "edit")
</script>

<div class="app">
    <div class="workspace">
        <ModernTopBar />

        <div class="body">
            <Resizeable id="leftPanel">
                <section class="side left">
                    <div class="panelCard">
                        {#if page === "show"}
                            {#key $activeProfile}
                                <Projects />
                            {/key}
                        {:else if page === "edit"}
                            <Navigation />
                        {:else if page === "stage"}
                            <StageLayouts />
                        {:else if page === "draw"}
                            <DrawTabs />
                        {:else if page === "settings"}
                            <SettingsTabs />
                        {/if}
                    </div>
                </section>
            </Resizeable>

            <div class="center">
                {#if page === "show"}
                    {#if $focusMode}
                        <LazyLoad component={() => import("../components/show/focus/FocusMode.svelte")} show={$focusMode} />
                    {:else}
                        <Show />
                    {/if}
                {:else if page === "edit"}
                    <LazyLoad component={() => import("../components/edit/Editor.svelte")} show={page === "edit"} />
                {:else if page === "draw"}
                    <LazyLoad component={() => import("../components/draw/Slide.svelte")} show={page === "draw"} />
                {:else if page === "settings"}
                    <LazyLoad component={() => import("../components/settings/Settings.svelte")} show={page === "settings"} />
                {:else if page === "stage"}
                    <LazyLoad component={() => import("../components/stage/StageLayout.svelte")} show={page === "stage"} />
                {/if}
            </div>

            <Resizeable id="rightPanel" let:width side="right">
                <section class="side right" class:row={width > DEFAULT_WIDTH * 1.8}>
                    <div class="preview">
                        <div class="previewBar" class:live={$outputDisplay}>
                            <span class="led" />
                            <span>{translateText($outputDisplay ? "tabs.live" : "main.standby", $dictionary)}</span>
                        </div>
                        <Preview />
                    </div>

                    {#if page === "show"}
                        {#if $activeShow && ($activeShow.type === "show" || $activeShow.type === undefined) && !$focusMode}
                            <div class="toolsCard"><ShowTools /></div>
                        {/if}
                    {:else if page === "edit"}
                        {#if $activeEdit.type === "media" || $activeEdit.type === "camera"}
                            <div class="toolsCard"><LazyLoad component={() => import("../components/edit/MediaTools.svelte")} show={$activeEdit.type === "media" || $activeEdit.type === "camera"} /></div>
                        {:else if $activeEdit.type === "audio"}
                            <div class="toolsCard"><LazyLoad component={() => import("../components/edit/AudioTools.svelte")} show={$activeEdit.type === "audio"} /></div>
                        {:else if $activeEdit.type === "effect"}
                            <div class="toolsCard"><LazyLoad component={() => import("../components/edit/EffectTools.svelte")} show={$activeEdit.type === "effect"} /></div>
                        {:else if $activeEdit.type === "scene"}
                            <div class="toolsCard"><LazyLoad component={() => import("../components/edit/SceneTools.svelte")} show={$activeEdit.type === "scene"} /></div>
                        {:else if $activeEdit.type === "overlay" || $activeEdit.type === "template" || $showsCache[$activeShow?.id || ""]}
                            {#if $focusMode || (($activeEdit.type || "show") === "show" && $editMode !== "default")}
                                <!-- show nothing -->
                            {:else}
                                <div class="toolsCard"><LazyLoad component={() => import("../components/edit/EditTools.svelte")} show={!$focusMode} /></div>
                            {/if}
                        {/if}
                    {:else if page === "draw"}
                        <div class="toolsCard"><LazyLoad component={() => import("../components/draw/DrawSettings.svelte")} show={page === "draw"} /></div>
                    {:else if page === "stage" && $activeStage.id}
                        <div class="toolsCard"><LazyLoad component={() => import("../components/stage/StageTools.svelte")} show={page === "stage" && !!$activeStage.id} /></div>
                    {:else if page === "settings"}
                        <div class="toolsCard"><LazyLoad component={() => import("../components/settings/SettingsTools.svelte")} show={page === "settings"} /></div>
                    {/if}
                </section>
            </Resizeable>
        </div>

        {#if page === "show" && $special.projectTimelineActive && $activeProject && !$projectView}
            <Resizeable id="project_timeline" side="bottom" maxWidth={DEFAULT_WIDTH} minWidth={40}>
                {#key $activeProject}
                    <Timeline type="project" isClosed={$resized.project_timeline <= 40} />
                {/key}
            </Resizeable>
        {/if}

        {#if drawerVisible}
            <LazyLoad component={() => import("../components/drawer/Drawer.svelte")} show={drawerVisible} />
        {/if}
    </div>

    {#if $showChangeProfileMenu && $activeProfile !== null}
        <ProfileChangerMenu />
    {/if}

    {#if $ai.enabled}
        <AiFloating />
    {/if}

    <Tipbar />
</div>

<style>
    .app {
        display: flex;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: var(--ui-panel-deep);
        font-family: var(--ui-font);
    }

    .workspace {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        height: 100%;
        overflow: hidden;
    }

    .body {
        display: flex;
        flex: 1;
        min-height: 0;
        overflow: hidden;
    }

    .side {
        display: flex;
        flex-direction: column;
        flex: 1;
        height: 100%;
        min-height: 0;
        overflow: hidden;
    }

    .side.left {
        background: var(--ui-panel-deep);
    }
    .side.right {
        background: var(--ui-panel);
        overflow-y: auto;
    }
    .side.right.row {
        flex-direction: row-reverse;
    }

    .panelCard {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        background: var(--ui-panel-deep);
    }

    .center {
        position: relative;
        flex: 1;
        min-width: 0;
        background: var(--ui-panel-deep);
        overflow: auto;
        scroll-behavior: smooth;
    }

    .preview {
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
    }

    .previewBar {
        display: flex;
        align-items: center;
        gap: 7px;

        height: 27px;
        padding: 0 10px;

        font-family: var(--ui-font);
        font-size: 0.65em;
        font-weight: 600;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--ui-muted);
    }

    .led {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #e3a94a;
        box-shadow: 0 0 7px rgb(227 169 74 / 0.65);
    }
    .previewBar.live {
        color: #ffb3c1;
    }
    .previewBar.live .led {
        background: #ff5570;
        box-shadow: 0 0 8px #ff5570;
        animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.35;
        }
    }

    .toolsCard {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        border-top: 1px solid var(--ui-border);
        background: var(--ui-panel);
    }
</style>
