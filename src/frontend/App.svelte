<script lang="ts">
    import { OUTPUT } from "../types/Channels"
    import type { Resolution } from "../types/Settings"
    import type { DrawerTabIds, TopViews } from "../types/Tabs"
    import Calendar from "./components/calendar/Calendar.svelte"
    import CreateCalendarShow from "./components/calendar/CreateCalendarShow.svelte"
    import Day from "./components/calendar/Day.svelte"
    import ContextMenu from "./components/context/ContextMenu.svelte"
    import { menuClick, removeSlide } from "./components/context/menuClick"
    import DrawSettings from "./components/draw/DrawSettings.svelte"
    import DrawTools from "./components/draw/DrawTools.svelte"
    import Slide from "./components/draw/Slide.svelte"
    import Drawer from "./components/drawer/Drawer.svelte"
    import Editor from "./components/edit/Editor.svelte"
    import EditTools from "./components/edit/EditTools.svelte"
    import MediaTools from "./components/edit/MediaTools.svelte"
    import Navigation from "./components/edit/Navigation.svelte"
    import Pdf from "./components/export/Pdf.svelte"
    import { copy, cut } from "./components/helpers/clipboard"
    import { getActiveOutputs, getResolution, isOutCleared } from "./components/helpers/output"
    import { startEventTimer, startTimer } from "./components/helpers/timerTick"
    import MenuBar from "./components/main/MenuBar.svelte"
    import Popup from "./components/main/Popup.svelte"
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
        currentWindow,
        drawer,
        events,
        loaded,
        os,
        outputDisplay,
        outputs,
        playingAudio,
        selected,
    } from "./stores"
    import { send } from "./utils/request"
    import { startup } from "./utils/startup"

    startup()
    $: page = $activePage
    // let reloadPage: boolean = false
    // let previousPage: string = ""
    // $: if (page === "draw") {
    //   previousPage = "draw"
    //   reload()
    // }
    // $: if (page !== "draw" && previousPage === "draw") {
    //   previousPage = ""
    //   reload()
    // }
    // function reload() {
    //   reloadPage = true
    //   setTimeout(() => {
    //     reloadPage = false
    //   }, 2000)
    // }

    let width: number = 0
    let height: number = 0
    let resolution: Resolution = getResolution()
    $: resolution = getResolution(null, $outputs)

    const menus: TopViews[] = ["show", "edit", "calendar", "draw", "stage", "settings"]
    const drawerMenus: DrawerTabIds[] = ["shows", "media", "overlays", "audio", "scripture", "player", "live", "templates"]
    const ctrlKeys: any = {
        a: () => menuClick("selectAll"),
        c: () => menuClick("copy"),
        v: () => menuClick("paste"),
        // a: () => {
        //   if ($activeShow?.id && ($activeShow.type === undefined || $activeShow.type === "show")) {
        //     if ($activePage === "show") {
        //       // select all slides
        //       let ref = _show("active").layouts("active").ref()[0]
        //       let selection = ref.map((_: any, index: number) => ({ index }))
        //       selected.set({ id: "slide", data: selection })
        //       return true
        //     } else if ($activePage === "edit") {
        //       // select all elements...
        //     }
        //   }
        //   return false
        // },
        // c: () => {
        //   // TODO: slides don't get copied!!!!
        //   if ($selected.id) copy($selected)
        //   else if ($activeEdit.items) copy({ id: "item", data: $activeEdit })
        //   else if (window.getSelection()) navigator.clipboard.writeText(window.getSelection()!.toString())
        //   return true
        // },
        // v: () => {
        //   paste()
        //   return true
        // },
        x: () => {
            cut()
            // return true
        },
        e: () => activePopup.set("export"),
        i: () => activePopup.set("import"),
        n: () => activePopup.set("show"),
        o: () => {
            let enabledOutputs: any[] = getActiveOutputs($outputs, false)
            enabledOutputs.forEach((id) => {
                let output: any = { id, ...$outputs[id] }
                // , force: e.ctrlKey || e.metaKey
                send(OUTPUT, ["DISPLAY"], { enabled: !$outputDisplay, output })
            })
        },
        // ATTENTION: THESE ARE CALLED BY SYSTEM (menuTemplate -> menuClick)
        // s: () => save(),
        // y: (e: any) => {
        //   if (!e.target.closest(".edit")) redo()
        // },
        // z: (e: any) => {
        //   if (!e.target.closest(".edit")) undo()
        // },
        // Z: (e: any) => {
        //     if (!e.target.closest(".edit")) redo()
        // },
        s: () => menuClick("save"),
        y: () => menuClick("redo"),
        z: () => menuClick("undo"),
        Z: () => menuClick("redo"),
    }
    const keys: any = {
        Escape: () => {
            if (!isOutCleared() || Object.keys($playingAudio).length) return

            // close popup
            if ($activePopup !== null) activePopup.set(null)
            // blur focused elements
            else if (document.activeElement !== document.body) (document.activeElement as HTMLElement).blur()
            // else {
            //   // hide / show drawer
            //   if ($drawer.height <= 40) drawer.set({ height: $drawer.stored || 300, stored: null })
            //   else drawer.set({ height: 40, stored: $drawer.height })
        },
        Backspace: () => {
            if ($selected.id === "slide") removeSlide({ sel: $selected })
        },
        Delete: () => keys.Backspace(),
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

            if (e.key !== "s" && document.activeElement?.classList?.contains("edit") && Object.keys(ctrlKeys).includes(e.key)) return

            if (ctrlKeys[e.key]) {
                if (ctrlKeys[e.key](e)) e.preventDefault()
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

    // countdown timer tick
    $: if ($activeTimers.length) startTimer()

    // check for show event
    $: if (Object.keys($events).length) startEventTimer()

    function hideDisplay(ctrlKey: boolean = true) {
        if (!ctrlKey) return
        outputDisplay.set(false)
        window.api.send(OUTPUT, { channel: "DISPLAY", data: { enabled: false } })
    }

    // close youtube ad
    let closeAd: boolean = false
    window.api.receive(OUTPUT, (a: any) => {
        if (a.channel === "CLOSE_AD") {
            closeAd = true
            setTimeout(() => (closeAd = false), 10)
        }
    })
</script>

<svelte:window on:keydown={keydown} />

{#if $currentWindow === "pdf"}
    <Pdf />
{:else}
    {#if !$currentWindow && $os.platform === "win32"}
        <MenuBar />
    {/if}
    <main style={!$currentWindow && $os.platform === "win32" ? "height: calc(100% - 30px);" : ""} class:closeAd>
        {#if $currentWindow === "output"}
            <!-- TODO: mac center  -->
            <div
                class="fill"
                style="flex-direction: {getStyleResolution(resolution, width, height, 'fit').includes('width') ? 'row' : 'column'}"
                bind:offsetWidth={width}
                bind:offsetHeight={height}
                on:dblclick={() => hideDisplay()}
                on:click={(e) => hideDisplay(e.ctrlKey || e.metaKey)}
            >
                <!-- Mac: width: 100%; -->
                <Output style={getStyleResolution(resolution, width, height, "fit")} center />
            </div>
        {:else}
            <ContextMenu />
            <Popup />

            <div class="column">
                <Top />
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
                            {:else if page === "calendar"}
                                <Day />
                            {:else if page === "settings"}
                                <SettingsTabs />
                            {/if}
                        </div>
                    </Resizeable>

                    <!-- {#if !reloadPage} -->
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
                        {:else if page === "calendar"}
                            <Calendar />
                        {/if}
                    </div>
                    <!-- {/if} -->

                    <Resizeable id="mainRight" let:width side="right">
                        <div class="right" class:row={width > 600}>
                            <Preview />
                            {#if page === "show"}
                                {#if $activeShow && ($activeShow.type === "show" || $activeShow.type === undefined)}
                                    <ShowTools />
                                {/if}
                            {:else if page === "edit"}
                                {#if ($activeShow && ($activeShow.type === "image" || $activeShow.type === "video")) || $activeEdit.type === "media"}
                                    <MediaTools />
                                {:else}
                                    <EditTools />
                                {/if}
                            {:else if page === "draw"}
                                <DrawSettings />
                            {:else if page === "stage" && $activeStage.id}
                                <StageTools />
                            {:else if page === "calendar"}
                                <CreateCalendarShow />
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

        display: flex;
        background: var(--primary-darkest);

        /* TODO: change electron window resolution...?? */
        /* background-color: black; */
    }
</style>
