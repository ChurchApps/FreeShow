<script lang="ts">
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
    import Preview from "./components/output/Preview.svelte"
    import Settings from "./components/settings/Settings.svelte"
    import SettingsTabs from "./components/settings/SettingsTabs.svelte"
    import Projects from "./components/show/Projects.svelte"
    import Show from "./components/show/Show.svelte"
    import ShowTools from "./components/show/ShowTools.svelte"
    import Shows from "./components/stage/Shows.svelte"
    import StageShow from "./components/stage/StageShow.svelte"
    import StageTools from "./components/stage/StageTools.svelte"
    import Resizeable from "./components/system/Resizeable.svelte"
    import { activeEdit, activePage, activeShow, activeStage, currentWindow, loaded, os } from "./stores"

    $: page = $activePage
    $: isWindows = !$currentWindow && $os.platform === "win32"
</script>

<div class="column">
    <Top {isWindows} />
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
                <Show />
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
            <div class="right" class:row={width > 300 * 1.5}>
                <Preview />
                {#if page === "show"}
                    {#if $activeShow && ($activeShow.type === "show" || $activeShow.type === undefined)}
                        <ShowTools />
                    {/if}
                {:else if page === "edit"}
                    {#if $activeEdit.type === "media"}
                        <MediaTools />
                    {:else if $activeEdit.type === "effect"}
                        <EffectTools />
                    {:else}
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
    .column {
        display: flex;
        flex-direction: column;
        height: 100%;
        justify-content: space-between;
    }

    .row {
        display: flex;
        flex: 1;
        justify-content: space-between;
        overflow: hidden;
    }

    .center {
        flex: 1;
        background-color: var(--primary-darker);
        overflow: auto;
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
</style>
