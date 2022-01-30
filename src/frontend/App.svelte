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
  import { getStyleResolution } from "./components/slide/getStyleResolution"
  import Shows from "./components/stage/Shows.svelte"
  import StageShow from "./components/stage/StageShow.svelte"
  import StageTools from "./components/stage/StageTools.svelte"
  import Resizeable from "./components/system/Resizeable.svelte"
  import { activePage, activePopup, activeShow, activeStage, drawer, os, outputDisplay, outputWindow, outSlide, screen, showsCache } from "./stores"
  import { setLanguage } from "./utils/language"
  import { save } from "./utils/save"
  import { startup } from "./utils/startup"

  // CHECK IF FIRST TIME USER
  startup()

  // SET LANGUAGE
  // https://lokalise.com/blog/svelte-i18n/
  setLanguage()

  function keydown(e: any) {
    if (!$outputWindow) {
      // ctrl + number
      if (e.ctrlKey) {
        let menus: TopViews[] = ["show", "edit", "stage", "draw", "calendar", "settings"]
        if (Object.keys(menus).includes((e.key - 1).toString())) activePage.set(menus[e.key - 1])

        // save
        if (e.key === "s") save()

        // undo/redo
        if (!e.target.closest(".edit")) {
          if (e.key.toLowerCase() === "z" && !e.shiftKey) {
            e.preventDefault()
            undo()
          } else if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) {
            e.preventDefault()
            redo()
          }
        }
      } else {
        if (e.key === "Escape") {
          if ($activePopup !== null) activePopup.set(null)
          else if (document.activeElement !== document.body) (document.activeElement as HTMLElement).blur()
          else {
            // hide / show drawer
            if ($drawer.height <= 40) drawer.set({ height: $drawer.stored || 300, stored: null })
            else drawer.set({ height: 40, stored: $drawer.height })
          }
        }
      }
    }
  }

  function display() {
    outputDisplay.set(false)
    window.api.send(OUTPUT, { channel: "DISPLAY", data: false })
  }

  let width: number = 0
  let height: number = 0
  let resolution: Resolution = $outSlide ? $showsCache[$outSlide.id].settings.resolution! : $screen.resolution

  $: page = $activePage

  // on loaded
  onMount(() => {
    window.api.send("LOADED")
  })
</script>

<svelte:window on:keydown={keydown} />

{#if !$outputWindow && $os.platform === "win32"}
  <MenuBar />
{/if}
<main style={$outputWindow ? "" : "height: calc(100% - 30px);"}>
  {#if $outputWindow}
    <div class="fill" bind:offsetWidth={width} bind:offsetHeight={height} on:dblclick={display}>
      <Output style={getStyleResolution(resolution, width, height, "fit")} center />
    </div>
  {:else}
    <ContextMenu />
    <Popup />

    <div class="column">
      <Top />
      <div class="row">
        <!-- maxWidth={window.innerWidth / 3} -->
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

        <Resizeable id="mainRight" side="right">
          <div class="right">
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

  .column {
    display: flex;
    flex-direction: column;
    height: 100%;
    justify-content: space-between;
    /* flex: 1 1 auto; */
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
  }
  .left,
  .right {
    display: flex;
    flex-direction: column;
    flex: 1;
    justify-content: space-between;
    overflow: hidden;
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
