<script lang="ts">
  // import T from "./components/helpers/T.svelte"
  // import Settings from "./components/views/Settings.svelte"
  import Top from "./components/main/Top.svelte"
  import Projects from "./components/show/Projects.svelte"
  import Show from "./components/show/Show.svelte"
  import Editor from "./components/edit/Editor.svelte"
  import Preview from "./components/output/Preview.svelte"
  import { setLanguage } from "./utils/language"
  import { startup } from "./utils/startup"
  import Drawer from "./components/drawer/Drawer.svelte"
  import type { TopViews } from "../types/Views"
  import ContextMenu from "./components/system/ContextMenu.svelte"
  import Settings from "./components/settings/Settings.svelte"
  import Navigation from "./components/edit/Navigation.svelte"
  import { activePage, activeProject, activeShow, activeStage, drawer, outputWindow, outSlide, projectView, screen, shows } from "./stores"
  import ProjectTools from "./components/show/ProjectTools.svelte"
  import EditTools from "./components/edit/EditTools.svelte"
  import ShowTools from "./components/show/ShowTools.svelte"
  import Resizeable from "./components/system/Resizeable.svelte"
  import Output from "./components/output/Output.svelte"
  import { redo, undo } from "./components/helpers/history"
  import { getStyleResolution } from "./components/slide/getStyleResolution"
  import type { Resolution } from "../types/Settings"
  import Slide from "./components/draw/Slide.svelte"
  import DrawTools from "./components/draw/DrawTools.svelte"
  import DrawSettings from "./components/draw/DrawSettings.svelte"
  import Shows from "./components/stage/Shows.svelte"
  import StageTools from "./components/stage/StageTools.svelte"
  import StageShow from "./components/stage/StageShow.svelte"
  import MediaTools from "./components/drawer/media/MediaTools.svelte"

  // CHECK IF FIRST TIME USER
  startup()

  // SET LANGUAGE
  // https://lokalise.com/blog/svelte-i18n/
  setLanguage()

  // import VideoStream from "./components/controllers/VideoStream.svelte"
  // import type { activeFilePath } from "./stores";

  // TODO: a better way of doing this!!!
  // shows.subscribe((s) => {
  //   if (!$outputWindow) window.api.send(OUTPUT, { channel: "SHOWS", data: s })
  // })

  let page: TopViews = "show"
  activePage.subscribe((p) => (page = p))

  // TODO: update send to lan remote on active show/slide update

  function keydown(e: any) {
    // ctrl + number
    if (e.ctrlKey) {
      // WIP reflow: flow / ...
      let menus: TopViews[] = ["show", "edit", "draw", "stage", "calendar", "settings"]
      if (Object.keys(menus).includes((e.key - 1).toString())) {
        activePage.set(menus[e.key - 1])
      }

      // prevent undo
      if (!e.target.closest(".search")) {
        if (e.key.toLowerCase() === "z" && !e.shiftKey) {
          undo()
        } else if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) {
          redo()
        }
      }
    } else {
      if (e.key === "Escape") {
        if (document.activeElement !== document.body) {
          ;(document.activeElement as HTMLElement).blur()
        } else {
          // hide / show drawer

          if ($drawer.height <= 40) drawer.set({ height: $drawer.stored || 300, stored: null })
          else drawer.set({ height: 40, stored: $drawer.height })
        }
      }
    }
  }

  let width: number = 0
  let height: number = 0
  let resolution: Resolution = $outSlide ? $shows[$outSlide.id].settings.resolution! : $screen.resolution
</script>

<svelte:window on:keydown={keydown} />

<main>
  {#if $outputWindow}
    <div class="fill" bind:offsetWidth={width} bind:offsetHeight={height}>
      <Output style={getStyleResolution(resolution, width, height, "fit")} center />
    </div>
  {:else}
    <!-- <h1>FreeShow</h1> -->

    <ContextMenu />

    <div class="column">
      <Top />
      <!-- All / Current/active -->

      <div class="row">
        <!-- maxWidth={window.innerWidth / 3} -->
        <Resizeable id="mainLeft">
          <div class="left">
            {#if page === "show"}
              <Projects />
              {#if $activeProject && !$projectView}
                <ProjectTools />
              {/if}
            {:else if page === "edit"}
              <Navigation />
            {:else if page === "stage"}
              <Shows />
            {:else if page === "draw"}
              <DrawTools />
            {/if}
          </div>
        </Resizeable>
        <div class="center">
          {#if page === "show"}
            <Show />
            <!-- <VideoPlayer /> -->
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
        <Resizeable id="mainRight" side="right">
          <div class="right">
            <Preview />
            {#if page === "show" && $activeShow}
              {#if $activeShow.type === "private" || $activeShow.type === null || $activeShow.type === undefined}
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
            {/if}
          </div>
        </Resizeable>
      </div>

      <!-- <Slides live={live} setLive={setLive} />
              <Preview live={live} setLive={setLive} /> -->
      {#if page === "show" || page === "edit"}
        <Drawer />
      {/if}
    </div>

    <!-- <VideoStream /> -->
    <!-- <p class="file-path">
    {$activeFilePath ? $activeFilePath : "Press 'Save' or hit 'CTRL + S' to save"}
  </p> -->
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
    cursor: none;
    height: 100%;
    width: 100%;
    /* TODO: change electron window resolution...?? */
    /* background-color: black; */
  }
</style>
