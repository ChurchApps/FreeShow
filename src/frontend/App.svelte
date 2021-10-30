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
  import Actions from "./components/slide/Actions.svelte"
  import Settings from "./components/settings/Settings.svelte"
  import Navigation from "./components/edit/Navigation.svelte"
  import { activePage } from "./stores"

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
</script>

<main>
  <!-- <h1>FreeShow</h1> -->

  <ContextMenu />
  <!-- {contextMenu && <ContextMenu event={contextMenu} setAction={setAction} />} -->

  <div class="grid">
    <Top />
    <!-- <div class="row"> -->
    <!-- All / Current/active -->

    <div class="left">
      {#if page === "show"}
        <Projects />
      {:else if page === "edit"}
        <Navigation />
      {/if}
    </div>
    <div class="center">
      {#if page === "show"}
        <Show />
      {:else if page === "edit"}
        <Editor />
      {:else if page === "settings"}
        <Settings />
      {/if}
    </div>
    <div class="right">
      <Preview />
      {#if page === "show"}
        <Actions />
      {/if}
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
  /* .column {
    display: flex;
    flex-direction: column;
    align-content: stretch;
  }
  .row {
    display: flex;
    justify-content: space-between;
  } */
  .grid {
    height: calc(100vh); /* top height */
    display: grid;
    grid-template-columns: var(--navigation-width) auto var(--navigation-width);
    /* grid-template-rows: auto 1fr; */
    grid-template-rows: minmax(min-content, max-content) auto minmax(min-content, max-content);
    /* grid-template-rows: minmax(auto, 80vh) minmax(min-content, max-content); */
    /* grid-template-rows: auto; */
    grid-template-areas:
      "top top top"
      ". . ."
      "drawer drawer drawer";
  }
  /* .left {
    grid-area: left;
  }
  .right {
    grid-area: right;
  } */
  :global(.top) {
    grid-area: top;
    /* align-self: end; */
  }
  .center {
    /* grid-area: center; */
    overflow-y: auto;
    height: 100%;
    background-color: var(--primary-darker);
  }
  .left,
  .right {
    display: flex;
    flex-direction: column;
    overflow: auto;
  }
  :global(.drawer) {
    grid-area: drawer;
    /* align-self: end; */
  }
  /* .center {
    overflow-y: auto;
    max-height: 90vh;
  }
  .right {
    overflow: auto;
    width: 300px;
  } */

  /* main {
    width: 100vw;
    height: 100vh;
  } */
  /* main {
		text-align: center;
		padding: 1em;
		margin: 0 auto;
	} */

  /* @media (min-width: 640px) {
		main {
			max-width: none;
		}
	} */
</style>
