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

  <!-- {contextMenu && <ContextMenu event={contextMenu} setAction={setAction} />} -->
  <Top bind:mode />
  <div style="display: flex;">
    {#if mode === "live"}
      <!-- All / Current/active -->
      <Projects />
      <Show />
      <!-- <Slides live={live} setLive={setLive} />
						<Preview live={live} setLive={setLive} /> -->
    {:else if mode === "edit"}
      <Editor />
    {:else if mode === "stage"}
      stage
    {/if}
    <!-- <Explorer mouse={mouse} request={request} /> -->

    <Preview {mode} />
  </div>

  <Drawer />

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
