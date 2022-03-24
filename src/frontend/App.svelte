<script lang="ts">
  import { onMount } from "svelte"
  import { OUTPUT } from "../types/Channels"
  import type { Resolution } from "../types/Settings"
  import type { TopViews } from "../types/Tabs"
  import Calendar from "./components/calendar/Calendar.svelte"
  import CreateCalendarShow from "./components/calendar/CreateCalendarShow.svelte"
  import Day from "./components/calendar/Day.svelte"
  import ContextMenu from "./components/context/ContextMenu.svelte"
  import DrawSettings from "./components/draw/DrawSettings.svelte"
  import DrawTools from "./components/draw/DrawTools.svelte"
  import Slide from "./components/draw/Slide.svelte"
  import Drawer from "./components/drawer/Drawer.svelte"
  import MediaTools from "./components/drawer/media/MediaTools.svelte"
  import Editor from "./components/edit/Editor.svelte"
  import EditTools from "./components/edit/EditTools.svelte"
  import Navigation from "./components/edit/Navigation.svelte"
  import { redo, undo } from "./components/helpers/history"
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
  import TimerInterval from "./components/show/tools/TimerInterval.svelte"
  import { getStyleResolution } from "./components/slide/getStyleResolution"
  import Shows from "./components/stage/Shows.svelte"
  import StageShow from "./components/stage/StageShow.svelte"
  import StageTools from "./components/stage/StageTools.svelte"
  import Resizeable from "./components/system/Resizeable.svelte"
  import { activeDrawerTab, activeEdit, activePage, activePopup, activeShow, activeStage, drawer, os, outputDisplay, outputWindow, outSlide, screen, showsCache } from "./stores"
  import { save } from "./utils/save"
  import { startup } from "./utils/startup"

  startup()
  onMount(() => window.api.send("LOADED"))
  $: page = $activePage

  let width: number = 0
  let height: number = 0
  let resolution: Resolution = $outSlide ? $showsCache[$outSlide.id].settings.resolution! : $screen.resolution

  const menus: TopViews[] = ["show", "edit", "stage", "draw", "calendar", "settings"]
  const drawerMenus: string[] = ["shows", "media", "overlays", "templates", "audio", "scripture", "player", "live"]
  const ctrlKeys: any = {
    n: () => activePopup.set("show"),
    o: () => {
      outputDisplay.set(!$outputDisplay)
      window.api.send(OUTPUT, { channel: "DISPLAY", data: $outputDisplay })
    },
    r: () => console.log("refresh"),
    s: () => save(),
    y: (e: any) => {
      if (!e.target.closest(".edit")) redo()
    },
    z: (e: any) => {
      if (!e.target.closest(".edit")) undo()
    },
    Z: (e: any) => {
      if (!e.target.closest(".edit")) redo()
    },
  }
  const keys: any = {
    Escape: () => {
      // close popup
      if ($activePopup !== null) activePopup.set(null)
      // blur focused elements
      else if (document.activeElement !== document.body) (document.activeElement as HTMLElement).blur()
      // "blur" edit items
      else if ($activeEdit.items.length) {
        activeEdit.update((a) => {
          a.items = []
          return a
        })
      } else {
        // hide / show drawer
        if ($drawer.height <= 40) drawer.set({ height: $drawer.stored || 300, stored: null })
        else drawer.set({ height: 40, stored: $drawer.height })
      }
    },
  }

  function keydown(e: any) {
    if ($outputWindow) return
    if (e.ctrlKey || e.metaKey) {
      if (document.activeElement === document.body && Object.keys(drawerMenus).includes((e.key - 1).toString())) {
        activeDrawerTab.set(drawerMenus[e.key - 1])
        // open drawer
        if ($drawer.height < 300) drawer.set({ height: $drawer.stored || 300, stored: null })
        return
      }

      if (ctrlKeys[e.key]) {
        e.preventDefault()
        ctrlKeys[e.key](e)
      }
      return
    }

    if (document.activeElement === document.body && Object.keys(menus).includes((e.key - 1).toString())) activePage.set(menus[e.key - 1])

    if (keys[e.key]) {
      e.preventDefault()
      keys[e.key](e)
    }
  }

  function hideDisplay() {
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

{#if !$outputWindow && $os.platform === "win32"}
  <MenuBar />
{/if}
<main style={!$outputWindow && $os.platform === "win32" ? "height: calc(100% - 30px);" : ""} class:closeAd>
  {#if $outputWindow}
    <!-- TODO: mac center  -->
    <div class="fill" bind:offsetWidth={width} bind:offsetHeight={height} on:dblclick={hideDisplay}>
      <!-- Mac: width: 100%; -->
      <Output style={getStyleResolution(resolution, width, height, "fit")} center />
    </div>
  {:else}
    <ContextMenu />
    <Popup />
    <TimerInterval />

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

        <Resizeable id="mainRight" let:width side="right">
          <div class="right" class:row={width > 600}>
            <Preview />
            {#if page === "show" && $activeShow}
              {#if $activeShow.type === "show" || $activeShow.type === undefined}
                <ShowTools />
              {:else if $activeShow.type === "image" || $activeShow.type === "video"}
                <MediaTools />
              {/if}
            {:else if page === "edit"}
              <EditTools />
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

      {#if page === "show" || page === "edit"}
        <Drawer />
      {/if}
    </div>
  {/if}
</main>

<style>
  main {
    height: 100%;
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
    /* TODO: change electron window resolution...?? */
    /* background-color: black; */
  }
</style>
