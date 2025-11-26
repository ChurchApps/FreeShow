<script lang="ts">
    import { customActionActivation } from "./components/actions/actions"
    import DrawTabs from "./components/draw/DrawTabs.svelte"
    import Navigation from "./components/edit/Navigation.svelte"
    import Top from "./components/main/Top.svelte"
    import Preview from "./components/output/preview/Preview.svelte"
    import LazyLoad from "./components/helpers/LazyLoad.svelte"
    import SettingsTabs from "./components/settings/SettingsTabs.svelte"
    import Projects from "./components/show/Projects.svelte"
    import Show from "./components/show/Show.svelte"
    import ShowTools from "./components/show/ShowTools.svelte"
    import StageLayouts from "./components/stage/StageLayouts.svelte"
    import Resizeable from "./components/system/Resizeable.svelte"
    import { activeEdit, activePage, activeShow, activeStage, currentWindow, focusMode, loaded, os, showsCache, textEditActive } from "./stores"
    import { DEFAULT_WIDTH } from "./utils/common"
    import Tipbar from "./components/main/Tipbar.svelte"

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
                    <StageLayouts />
                {:else if page === "draw"}
                    <DrawTabs />
                {:else if page === "settings"}
                    <SettingsTabs />
                {/if}
            </div>
        </Resizeable>

        <div class="center">
            {#if page === "show"}
                {#if $focusMode}
                    <LazyLoad component={() => import("./components/show/focus/FocusMode.svelte")} show={$focusMode} />
                {:else}
                    <Show />
                {/if}
            {:else if page === "edit"}
                <LazyLoad component={() => import("./components/edit/Editor.svelte")} show={page === "edit"} />
            {:else if page === "draw"}
                <LazyLoad component={() => import("./components/draw/Slide.svelte")} show={page === "draw"} />
            {:else if page === "settings"}
                <LazyLoad component={() => import("./components/settings/Settings.svelte")} show={page === "settings"} />
            {:else if page === "stage"}
                <LazyLoad component={() => import("./components/stage/StageLayout.svelte")} show={page === "stage"} />
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
                    {#if $activeEdit.type === "media" || $activeEdit.type === "camera"}
                        <LazyLoad component={() => import("./components/edit/MediaTools.svelte")} show={$activeEdit.type === "media" || $activeEdit.type === "camera"} />
                    {:else if $activeEdit.type === "audio"}
                        <LazyLoad component={() => import("./components/edit/AudioTools.svelte")} show={$activeEdit.type === "audio"} />
                    {:else if $activeEdit.type === "effect"}
                        <LazyLoad component={() => import("./components/edit/EffectTools.svelte")} show={$activeEdit.type === "effect"} />
                    {:else if $activeEdit.type === "overlay" || $activeEdit.type === "template" || $showsCache[$activeShow?.id || ""]}
                        {#if ($activeEdit.type || "show") === "show" && $textEditActive}
                            <!-- <LazyLoad component={() => import("./components/edit/TextEditTools.svelte")} show={($activeEdit.type || "show") === "show" && $textEditActive} /> -->
                        {:else if !$focusMode}
                            <LazyLoad component={() => import("./components/edit/EditTools.svelte")} show={!$focusMode} />
                        {/if}
                    {/if}
                {:else if page === "draw"}
                    <LazyLoad component={() => import("./components/draw/DrawSettings.svelte")} show={page === "draw"} />
                {:else if page === "stage" && $activeStage.id}
                    <LazyLoad component={() => import("./components/stage/StageTools.svelte")} show={page === "stage" && !!$activeStage.id} />
                {:else if page === "settings"}
                    <LazyLoad component={() => import("./components/settings/SettingsTools.svelte")} show={page === "settings"} />
                {/if}
            </div>
        </Resizeable>
    </div>

    {#if $loaded && (page === "show" || page === "edit")}
        <LazyLoad component={() => import("./components/drawer/Drawer.svelte")} show={$loaded && (page === "show" || page === "edit")} />
    {/if}

    <Tipbar />
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
        position: relative;

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
        border-inline-end: 2px solid var(--primary-lighter);
        min-width: 50%;
    }

    .right.row :global(.textfield .picker) {
        left: unset !important;
        right: 0;
    }
</style>
