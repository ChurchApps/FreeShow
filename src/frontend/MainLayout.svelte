<script lang="ts">
    import { customActionActivation } from "./components/actions/actions"
    import DrawSettings from "./components/draw/DrawSettings.svelte"
    import DrawTools from "./components/draw/DrawTools.svelte"
    import Slide from "./components/draw/Slide.svelte"
    import Drawer from "./components/drawer/Drawer.svelte"
    import EditTools from "./components/edit/EditTools.svelte"
    import Editor from "./components/edit/Editor.svelte"
    import EffectTools from "./components/edit/EffectTools.svelte"
    import MediaTools from "./components/edit/MediaTools.svelte"
    import Navigation from "./components/edit/Navigation.svelte"
    import Top from "./components/main/Top.svelte"
    import Preview from "./components/output/preview/Preview.svelte"
    import Settings from "./components/settings/Settings.svelte"
    import SettingsTabs from "./components/settings/SettingsTabs.svelte"
    import Projects from "./components/show/Projects.svelte"
    import Show from "./components/show/Show.svelte"
    import ShowTools from "./components/show/ShowTools.svelte"
    import FocusMode from "./components/show/focus/FocusMode.svelte"
    import Shows from "./components/stage/Shows.svelte"
    import StageShow from "./components/stage/StageShow.svelte"
    import StageTools from "./components/stage/StageTools.svelte"
    import Resizeable from "./components/system/Resizeable.svelte"
    import { activeEdit, activePage, activeShow, activeStage, currentWindow, focusMode, loaded, os, textEditActive } from "./stores"
    import { DEFAULT_WIDTH } from "./utils/common"

    $: page = $activePage
    $: isWindows = !$currentWindow && $os.platform === "win32"

    let previousId = ""
    $: if ($activeShow?.id !== previousId) showOpened()
    function showOpened() {
        if (!$activeShow?.id || $activeShow?.type !== "show") return

        // allow show to actually open before triggering
        setTimeout(() => customActionActivation("show_opened"), 50)
        previousId = $activeShow?.id
    }
</script>

<div class="column">
    {#if !$focusMode}
        <Top {isWindows} />
    {/if}
    <div class="row">
        <Resizeable id="leftPanel">
            <div class="left">
                {#if page === "show"}
                    <Projects />
                {:else if page === "edit"}
                    <Navigation />
                {:else if page === "stage"}
                    <Shows />
                {:else if page === "draw"}
                    <DrawTools />
                {:else if page === "settings"}
                    <SettingsTabs />
                {/if}
            </div>
        </Resizeable>

        <div class="center">
            {#if page === "show"}
                {#if $focusMode}
                    <FocusMode />
                {:else}
                    <Show />
                {/if}
            {:else if page === "edit"}
                <Editor />
            {:else if page === "draw"}
                <Slide />
            {:else if page === "settings"}
                <Settings />
            {:else if page === "stage"}
                <StageShow />
            {/if}
        </div>

        <Resizeable id="rightPanel" let:width side="right">
            <div class="right" class:row={width > DEFAULT_WIDTH * 1.8}>
                <Preview />
                {#if page === "show"}
                    {#if $activeShow && ($activeShow.type === "show" || $activeShow.type === undefined) && !$focusMode}
                        <ShowTools />
                    {/if}
                {:else if page === "edit"}
                    {#if $activeEdit.type === "media"}
                        <MediaTools />
                    {:else if $activeEdit.type === "effect"}
                        <EffectTools />
                    {:else if !$focusMode && !$textEditActive}
                        <EditTools />
                    {/if}
                {:else if page === "draw"}
                    <DrawSettings />
                {:else if page === "stage" && $activeStage.id}
                    <StageTools />
                {/if}
            </div>
        </Resizeable>
    </div>

    {#if $loaded && (page === "show" || page === "edit")}
        <Drawer />
    {/if}
</div>

<style>
    .column,
    .row {
        display: flex;
        justify-content: space-between;
        /* background: var(--primary-darker); */
    }

    .column {
        flex-direction: column;
        height: 100%;
    }

    .row {
        flex: 1;
        overflow: hidden;
    }

    .center {
        position: relative;

        flex: 1;
        background-color: var(--primary-darker);
        overflow: auto;

        scroll-behavior: smooth;
    }

    .left,
    .right {
        display: flex;
        flex-direction: column;
        flex: 1;
        justify-content: space-between;
        overflow: hidden;
    }
    .right.row {
        flex-direction: row-reverse;
    }

    .right :global(.border) {
        border-top: 2px solid var(--primary-lighter);
    }
    .right.row :global(.border) {
        border: none;
        border-right: 2px solid var(--primary-lighter);
        min-width: 50%;
    }

    .right.row :global(.color .picker) {
        right: -1px;
        left: unset;
    }
</style>
