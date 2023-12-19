<script lang="ts">
    import { OUTPUT } from "../types/Channels"
    import type { Resolution } from "../types/Settings"
    import ContextMenu from "./components/context/ContextMenu.svelte"
    import DrawSettings from "./components/draw/DrawSettings.svelte"
    import DrawTools from "./components/draw/DrawTools.svelte"
    import Slide from "./components/draw/Slide.svelte"
    import Drawer from "./components/drawer/Drawer.svelte"
    import EditTools from "./components/edit/EditTools.svelte"
    import Editor from "./components/edit/Editor.svelte"
    import EffectTools from "./components/edit/EffectTools.svelte"
    import MediaTools from "./components/edit/MediaTools.svelte"
    import Navigation from "./components/edit/Navigation.svelte"
    import Pdf from "./components/export/Pdf.svelte"
    import { getResolution } from "./components/helpers/output"
    import { startEventTimer, startTimer } from "./components/helpers/timerTick"
    import MenuBar from "./components/main/MenuBar.svelte"
    import Popup from "./components/main/Popup.svelte"
    import Recorder from "./components/main/Recorder.svelte"
    import Toast from "./components/main/Toast.svelte"
    import Top from "./components/main/Top.svelte"
    import Output from "./components/output/Output.svelte"
    import Preview from "./components/output/Preview.svelte"
    import Settings from "./components/settings/Settings.svelte"
    import SettingsTabs from "./components/settings/SettingsTabs.svelte"
    import Projects from "./components/show/Projects.svelte"
    import Show from "./components/show/Show.svelte"
    import ShowTools from "./components/show/ShowTools.svelte"
    import { getStyleResolution } from "./components/slide/getStyleResolution"
    import Shows from "./components/stage/Shows.svelte"
    import StageShow from "./components/stage/StageShow.svelte"
    import StageTools from "./components/stage/StageTools.svelte"
    import Resizeable from "./components/system/Resizeable.svelte"
    import { activeEdit, activePage, activeShow, activeStage, activeTimers, autosave, currentWindow, disabledServers, events, loaded, os, outputDisplay, outputs, special, styles } from "./stores"
    import { focusArea, hideDisplay, logerror, startAutosave, toggleRemoteStream } from "./utils/common"
    import { keydown } from "./utils/shortcuts"
    import { startup } from "./utils/startup"

    startup()
    $: page = $activePage
    $: isWindows = !$currentWindow && $os.platform === "win32"

    // get output resolution
    let width: number = 0
    let height: number = 0
    let resolution: Resolution = getResolution()
    $: if ($currentWindow === "output") resolution = getResolution(null, { $outputs, $styles }, true)

    // countdown timer tick
    $: if ($activeTimers.length) startTimer()

    // check for show event
    $: if (Object.keys($events).length) startEventTimer()

    // autosave
    $: if ($autosave) startAutosave()

    // stream to OutputShow
    $: if (!$currentWindow && ($disabledServers.output_stream !== "" || !$outputDisplay)) toggleRemoteStream()

    // close youtube ad
    let closeAd: boolean = false
    window.api.receive(OUTPUT, (a: any) => {
        if ($currentWindow !== "output" || a.channel !== "CLOSE_AD") return

        closeAd = true
        setTimeout(() => (closeAd = false), 10)
    })

    // enable output window dragging
    let enableOutputMove: boolean = false
    function mousemoveOutput(e: any) {
        if (e.ctrlKey || e.metaKey || e.target.closest(".dragger")) enableOutputMove = true
        else enableOutputMove = false
    }
    $: if ($currentWindow === "output") window.api.send(OUTPUT, { channel: "MOVE", data: { enabled: enableOutputMove } })
</script>

<svelte:window on:keydown={keydown} on:mousedown={focusArea} on:error={logerror} on:unhandledrejection={logerror} />

{#if $currentWindow === "pdf"}
    <Pdf />
{:else}
    {#if isWindows}
        <MenuBar />
    {/if}
    <main style={isWindows ? "height: calc(100% - 30px);" : ""} class:closeAd class:background={$currentWindow === "output"}>
        <ContextMenu />

        {#if $currentWindow === "output"}
            <div
                class="fill context #output_window"
                style="flex-direction: {getStyleResolution(resolution, width, height, 'fit').includes('width') && !Object.values($outputs)[0].stageOutput ? 'row' : 'column'}"
                class:hideCursor={$special.hideCursor}
                on:mousemove={mousemoveOutput}
                bind:offsetWidth={width}
                bind:offsetHeight={height}
                on:dblclick={() => hideDisplay()}
            >
                {#if enableOutputMove}
                    <div class="dragger">
                        <p>Drag window</p>
                    </div>
                {/if}
                {#if Object.values($outputs)[0].stageOutput}
                    <StageShow stageId={Object.values($outputs)[0].stageOutput} edit={false} />
                {:else}
                    <Output style={getStyleResolution(resolution, width, height, "fit")} center />
                {/if}
            </div>
        {:else}
            <!-- WIP black window before output is loaded (don't show app screen when creating output windows) -->
            <!-- {#if !$loaded}<div class="black" />{/if} -->

            <Popup />
            <Toast />
            <Recorder />

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
        {/if}
    </main>
{/if}

<style>
    main {
        height: 100%;
    }
    main:not(.background) {
        background-color: var(--primary);
    }

    .dragger {
        -webkit-app-region: drag;
        position: absolute;
        top: 0;
        left: 0;
        height: 5vh;
        width: 100%;
        z-index: 10;

        display: flex;
        justify-content: center;
        align-items: center;

        background-color: rgb(255 255 255 / 0.2);
    }

    .closeAd {
        height: 1px;
    }

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

    .fill {
        height: 100%;
        width: 100%;
        overflow: hidden;

        display: flex;
        /* enable this to see the actual output window cropped size */
        /* background: var(--primary-darkest); */
    }

    .fill.hideCursor {
        cursor: none;
    }

    /* .black {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: black;
        z-index: 500;
    } */
</style>
