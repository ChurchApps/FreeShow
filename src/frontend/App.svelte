<script lang="ts">
    import { MAIN, OUTPUT } from "../types/Channels"
    import type { Resolution } from "../types/Settings"
    import type { DrawerTabIds, TopViews } from "../types/Tabs"
    import ContextMenu from "./components/context/ContextMenu.svelte"
    import DrawSettings from "./components/draw/DrawSettings.svelte"
    import DrawTools from "./components/draw/DrawTools.svelte"
    import Slide from "./components/draw/Slide.svelte"
    import Drawer from "./components/drawer/Drawer.svelte"
    import Editor from "./components/edit/Editor.svelte"
    import EditTools from "./components/edit/EditTools.svelte"
    import EffectTools from "./components/edit/EffectTools.svelte"
    import MediaTools from "./components/edit/MediaTools.svelte"
    import Navigation from "./components/edit/Navigation.svelte"
    import Pdf from "./components/export/Pdf.svelte"
    import { copy, cut, deleteAction, paste, selectAll } from "./components/helpers/clipboard"
    import { redo, undo } from "./components/helpers/history"
    import { displayOutputs, getActiveOutputs, getResolution, isOutCleared } from "./components/helpers/output"
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
    import {
        activeDrawerTab,
        activeEdit,
        activePage,
        activePopup,
        activeShow,
        activeStage,
        activeTimers,
        autosave,
        currentWindow,
        disabledServers,
        drawer,
        events,
        focusedArea,
        loaded,
        os,
        outputDisplay,
        outputs,
        playingAudio,
        selected,
        serverData,
        styles,
        volume,
    } from "./stores"
    import { newToast } from "./utils/messages"
    import { save } from "./utils/save"
    import { startup } from "./utils/startup"
    import { convertAutosave } from "./values/autosave"

    startup()
    $: page = $activePage

    let width: number = 0
    let height: number = 0
    let resolution: Resolution = getResolution()
    $: resolution = getResolution(null, { $outputs, $styles }, true)

    const menus: TopViews[] = ["show", "edit", "stage", "draw", "settings"]
    const drawerMenus: DrawerTabIds[] = ["shows", "media", "overlays", "audio", "scripture", "calendar", "templates"]
    const ctrlKeys: any = {
        a: () => selectAll(),
        c: () => copy(),
        v: () => paste(),
        x: () => cut(),
        e: () => activePopup.set("export"),
        i: () => activePopup.set("import"),
        n: () => activePopup.set("show"),
        m: () => volume.set($volume ? 0 : 1),
        o: () => displayOutputs(),
        s: () => save(),
        y: () => redo(),
        z: () => undo(),
        Z: () => redo(),
        "?": () => activePopup.set("shortcuts"),
        // F2: () => menuClick("rename"),
    }
    const keys: any = {
        Escape: () => {
            // blur focused elements
            if (document.activeElement !== document.body) {
                ;(document.activeElement as HTMLElement).blur()
                return
            }

            let outCleared = isOutCleared() && !Object.keys($playingAudio).length
            // close popup
            if ($activePopup !== null && outCleared && $activePopup !== "initialize") activePopup.set(null)
        },
        Delete: () => deleteAction($selected, "remove"),
        Backspace: () => keys.Delete(),
        // Enter: (e: any) => {
        //   if (!e.target.closest(".edit")) {
        //     // hide / show drawer
        //     if ($drawer.height <= 40) drawer.set({ height: $drawer.stored || 300, stored: null })
        //     else drawer.set({ height: 40, stored: $drawer.height })
        //   }
        // },
    }

    function keydown(e: any) {
        if ($currentWindow === "output") return

        if (e.ctrlKey || e.metaKey) {
            if (document.activeElement === document.body && Object.keys(drawerMenus).includes((e.key - 1).toString())) {
                activeDrawerTab.set(drawerMenus[e.key - 1])
                // open drawer
                if ($drawer.height < 300) drawer.set({ height: $drawer.stored || 300, stored: null })
                return
            }

            // use default input shortcuts on supported devices (this includes working undo/redo)
            const exeption = ["e", "i", "n", "o", "s", "a"]
            if ((e.key === "i" && document.activeElement?.closest(".editItem")) || (document.activeElement?.classList?.contains("edit") && !exeption.includes(e.key) && $os.platform !== "darwin")) {
                return
            }

            if (ctrlKeys[e.key]) {
                ctrlKeys[e.key](e)
            }
            return
        }

        if (e.altKey) return
        if (document.activeElement?.classList.contains("edit") && e.key !== "Escape") return
        if (document.activeElement === document.body && Object.keys(menus).includes((e.key - 1).toString())) activePage.set(menus[e.key - 1])

        if (keys[e.key]) {
            e.preventDefault()
            keys[e.key](e)
        }
    }

    function focusArea(e: any) {
        if (e.target.closest(".menus") || e.target.closest(".contextMenu")) return
        focusedArea.set(e.target.closest(".selectElem")?.id || e.target.querySelector(".selectElem")?.id || "")
    }

    // countdown timer tick
    $: if ($activeTimers.length) startTimer()

    // check for show event
    $: if (Object.keys($events).length) startEventTimer()

    function hideDisplay(ctrlKey: boolean = true) {
        if (!ctrlKey) return
        outputDisplay.set(false)
        window.api.send(OUTPUT, { channel: "DISPLAY", data: { enabled: false } })
    }

    // autosave
    let autosaveTimeout: any = null
    $: if ($autosave) startAutosave()
    function startAutosave() {
        if (autosaveTimeout) clearTimeout(autosaveTimeout)
        if (!convertAutosave[$autosave]) {
            autosaveTimeout = null
            return
        }

        autosaveTimeout = setTimeout(() => {
            newToast("$toast.saving")
            save()
            startAutosave()
        }, convertAutosave[$autosave])
    }

    // close youtube ad
    let closeAd: boolean = false
    window.api.receive(OUTPUT, (a: any) => {
        if (a.channel === "CLOSE_AD") {
            closeAd = true
            setTimeout(() => (closeAd = false), 10)
        }
    })

    $: isWindows = !$currentWindow && $os.platform === "win32"

    let enableOutputMove: boolean = false
    function mousemoveOutput(e: any) {
        if (e.ctrlKey || e.metaKey || e.target.closest(".dragger")) enableOutputMove = true
        else enableOutputMove = false
    }
    $: if ($currentWindow === "output") window.api.send(OUTPUT, { channel: "MOVE", data: { enabled: enableOutputMove } })

    // stream to OutputShow
    let streamStarted = false
    $: if ($disabledServers.output_stream === false && !$currentWindow && $outputDisplay && !streamStarted) {
        let captureOutputId = $serverData?.output_stream?.outputId || getActiveOutputs($outputs, true, true)[0]
        if (captureOutputId) {
            streamStarted = true
            window.api.send(MAIN, { channel: "START_STREAM", data: { id: captureOutputId } })
        }
    }
</script>

<svelte:window on:keydown={keydown} on:mousedown={focusArea} />

{#if $currentWindow === "pdf"}
    <Pdf />
{:else}
    {#if isWindows}
        <MenuBar />
    {/if}
    <main style={isWindows ? "height: calc(100% - 30px);" : ""} class:closeAd>
        {#if $currentWindow === "output"}
            <!-- TODO: mac center  -->
            <div
                class="fill"
                style="flex-direction: {getStyleResolution(resolution, width, height, 'fit').includes('width') ? 'row' : 'column'}"
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
                <!-- Mac: width: 100%; -->
                <Output style={getStyleResolution(resolution, width, height, "fit")} center />
            </div>
        {:else}
            <ContextMenu />
            <Popup />
            <Toast />
            <Recorder />

            <div class="column">
                <Top {isWindows} />
                <div class="row">
                    <Resizeable id="mainLeft">
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

                    <Resizeable id="mainRight" let:width side="right">
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

    /* @media (min-width: 640px) {
		main {
			max-width: none;
		}
	} */

    .fill {
        /* TODO: setting for hiding cursor... */
        /* cursor: none; */
        height: 100%;
        width: 100%;
        overflow: hidden;

        display: flex;
        background-color: black;
        /* enable this to see the actual output window cropped size */
        /* background: var(--primary-darkest); */
    }
</style>
