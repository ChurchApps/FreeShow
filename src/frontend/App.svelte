<script lang="ts">
  // import T from "./components/helpers/T.svelte"
  // import Settings from "./components/views/Settings.svelte"
  import Top from "./components/main/Top.svelte"
  import Projects from "./components/show/Projects.svelte"
  import Show from "./components/show/Show.svelte"
  import Editor from "./components/edit/Editor.svelte"
  import Preview from "./components/main/Preview.svelte"
  import { setLanguage } from "./utils/language"
  import { listen } from "./utils/messages"
  import { startup } from "./utils/startup"
  import Drawer from "./components/drawer/Drawer.svelte"
  import type { TopViews } from "../types/Views"
  import ContextMenu from "./components/system/ContextMenu.svelte"
  import Settings from "./components/settings/Settings.svelte"
  import Navigation from "./components/edit/Navigation.svelte"
  import { activePage } from "./stores"
  import ProjectTools from "./components/show/ProjectTools.svelte"
  import EditTools from "./components/edit/EditTools.svelte"
  import ShowTools from "./components/slide/ShowTools.svelte"
  import Resizeable from "./components/system/Resizeable.svelte"

  // CHECK IF FIRST TIME USER
  startup()

  // SET LANGUAGE
  // https://lokalise.com/blog/svelte-i18n/
  setLanguage()

  // LISTEN TO MESSAGES FROM CLIENT/ELECTRON
  listen()

  // import VideoStream from "./components/controllers/VideoStream.svelte"
  // import type { activeFilePath } from "./stores";

  let page: TopViews = "show"
  activePage.subscribe((p) => (page = p))

  // TODO: update send to lan remote on active show/slide update

  function keydown(e: any) {
    // ctrl + number
    if (e.ctrlKey) {
      // WIP reflow: flow / ...
      let menus: TopViews[] = ["show", "edit", "reflow", "draw", "stage", "settings"]
      if (Object.keys(menus).includes((e.key - 1).toString())) {
        activePage.set(menus[e.key - 1])
      }
    }
  }
</script>

<svelte:window on:keydown={keydown} />

<main>
  <!-- <h1>FreeShow</h1> -->

  <ContextMenu />
  <!-- {contextMenu && <ContextMenu event={contextMenu} setAction={setAction} />} -->

  <div class="column">
    <Top />
    <!-- <div class="row"> -->
    <!-- All / Current/active -->

    <div class="row">
      <!-- maxWidth={window.innerWidth / 3} -->
      <Resizeable id={"mainLeft"}>
        <div class="left">
          {#if page === "show"}
            <Projects />
            <ProjectTools />
          {:else if page === "edit"}
            <Navigation />
          {/if}
        </div>
      </Resizeable>
      <div class="center">
        {#if page === "show"}
          <Show />
        {:else if page === "edit"}
          <Editor />
        {:else if page === "settings"}
          <Settings />
        {/if}
      </div>
      <Resizeable id={"mainRight"} side="right">
        <div class="right">
          <Preview />
          {#if page === "show"}
            <ShowTools />
          {:else if page === "edit"}
            <EditTools />
          {/if}
        </div>
      </Resizeable>
    </div>

    <!-- <Slides live={live} setLive={setLive} />
              <Preview live={live} setLive={setLive} /> -->
    {#if page === "show" || page === "edit"}
      <Drawer />
    {/if}
    <!-- </div> -->
  </div>

  <!-- <VideoPlayer {$activeFilePath} /> -->

  <!-- <video>
		<track kind="captions">
	</video> -->

  <!-- <VideoStream /> -->

  <!-- <p class="file-path">
    {$activeFilePath ? $activeFilePath : "Press 'Save' or hit 'CTRL + S' to save"}
  </p>

	<div class="editor-and-preview">
    <Editor bind:markdown />
    <Preview {markdown} />
  </div> -->
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
</style>
