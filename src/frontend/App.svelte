<script lang="ts">
  // import T from "./components/helpers/T.svelte"
  // import Settings from "./components/views/Settings.svelte"
  import Top from "./components/views/Top.svelte"
  import Projects from "./components/views/Projects.svelte"
  import Show from "./components/views/Show.svelte"
  import Editor from "./components/views/Editor.svelte"
  import Preview from "./components/views/Preview.svelte"
  import FakeMonitor from "./components/views/FakeMonitor.svelte"
  import { setLanguage } from "./utils/language"
  import { listen } from "./utils/messages"
  import { startup } from "./utils/startup"
  import Drawer from "./components/views/Drawer.svelte"
  import type { TopViews } from "../types/Views"
  import ContextMenu from "./components/system/ContextMenu.svelte"

  // CHECK IF FIRST TIME USER
  startup()

  // SET LANGUAGE
  // https://lokalise.com/blog/svelte-i18n/
  setLanguage()

  // LISTEN TO MESSAGES FROM CLIENT/ELECTRON
  listen()

  // import VideoStream from "./components/controllers/VideoStream.svelte"
  // import type { activeFilePath } from "./stores";

  let mode: TopViews = "live"

  // TODO: update send to lan remote on active show/slide update
</script>

<main>
  <h1>FreeShow</h1>

  <ContextMenu />
  <!-- {contextMenu && <ContextMenu event={contextMenu} setAction={setAction} />} -->

  <Top bind:mode />
  <div class="grid">
    <!-- <div class="row"> -->
    {#if mode === "live"}
      <!-- All / Current/active -->

      <div class="left">
        <Projects />
      </div>
      <div class="center">
        <Show />
      </div>
      <div class="right">
        <Preview {mode} />
        <div>actions</div>
      </div>
      <!-- <Slides live={live} setLive={setLive} />
              <Preview live={live} setLive={setLive} /> -->
    {:else if mode === "edit"}
      <Editor />
      <Preview {mode} />
    {:else if mode === "stage"}
      stage
      <Preview {mode} />
    {/if}
    <!-- </div> -->

    <!-- <Explorer mouse={mouse} request={request} /> -->
    <Drawer />
  </div>

  <FakeMonitor />

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
    height: calc(100vh - 77px); /* top height */
    display: grid;
    grid-template-columns: var(--navigation-width) auto var(--navigation-width);
    /* grid-template-rows: auto 1fr; */
    grid-template-rows: auto minmax(min-content, max-content);
    /* grid-template-rows: minmax(auto, 80vh) minmax(min-content, max-content); */
    /* grid-template-rows: auto; */
    grid-template-areas:
      ". . ."
      "drawer drawer drawer";
  }
  /* .left {
    grid-area: left;
  }
  .right {
    grid-area: right;
  } */
  .center {
    /* grid-area: center; */
    overflow-y: auto;
  }
  :global(.drawer) {
    grid-area: drawer;
    /* align-self: end; */
  }
  .left,
  .right {
    display: flex;
    flex-direction: column;
    overflow: auto;
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
