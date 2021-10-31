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

  // left / right resize

  const minWidth = 4
  const defaultWidth = 300
  const maxWidth = window.innerWidth / 3
  let leftWidth: number = defaultWidth
  let rightWidth: number = defaultWidth
  let symmetric: boolean = false

  let move: boolean = false
  let mouse: null | { x: number; y: number; offsetX: number; target: any } = null
  function mousedown(e: any) {
    if (e.target.classList.contains("left") && e.target.offsetWidth - e.offsetX < 5) {
      mouse = {
        x: e.clientX,
        y: e.clientY,
        offsetX: window.innerWidth - leftWidth - e.clientX,
        target: e.target,
      }
    } else if (e.target.classList.contains("right") && e.offsetX < 4) {
      mouse = {
        x: e.clientX,
        y: e.clientY,
        offsetX: window.innerWidth - rightWidth - e.clientX,
        target: e.target,
      }
    }
    // console.log(e.clientY, e.target.offsetTop)
  }
  function mousemove(e: any) {
    if (mouse) {
      let newWidth: number = window.innerWidth - e.clientX - mouse.offsetX
      if (mouse.target.classList.contains("left")) newWidth = e.clientX
      // console.log(window.innerWidth, e.clientX, mouse.offsetX)

      if (newWidth < (defaultWidth * 0.6) / 2) newWidth = minWidth
      else if (newWidth < defaultWidth * 0.6) newWidth = defaultWidth * 0.6
      else if (newWidth > defaultWidth - 20 && newWidth < defaultWidth + 20) newWidth = defaultWidth
      else if (newWidth > maxWidth) newWidth = maxWidth
      else move = true
      if (mouse.target.classList.contains("left")) {
        leftWidth = newWidth
        if (symmetric) rightWidth = newWidth
        // storeLeftWidth = null
      } else {
        rightWidth = newWidth
        if (symmetric) leftWidth = newWidth
        // storeRightWidth = null
      }
      // if (newWidth >= 50 && newWidth < 500) height = newWidth
    }
  }

  let storeLeftWidth: null | number = null
  let storeRightWidth: null | number = null
  function click(e: any) {
    if (!move && !(e?.target instanceof HTMLInputElement)) {
      if (e.target.classList.contains("left") && e.target.offsetWidth - e.offsetX < 5) {
        if (leftWidth > minWidth) {
          storeLeftWidth = leftWidth
          leftWidth = minWidth
        } else {
          if (storeLeftWidth === null || storeLeftWidth < defaultWidth / 2) leftWidth = defaultWidth
          else leftWidth = storeLeftWidth
          storeLeftWidth = null
        }
      } else if (e.target.classList.contains("right") && e.offsetX < 4) {
        if (rightWidth > minWidth) {
          storeRightWidth = rightWidth
          rightWidth = minWidth
        } else {
          if (storeRightWidth === null || storeRightWidth < defaultWidth / 2) rightWidth = defaultWidth
          else rightWidth = storeRightWidth
          storeRightWidth = null
        }
      } else move = false
    } else move = false
  }

  function mouseup(e: any) {
    mouse = null
    if (!e.target.closest(".left") && !e.target.closest(".right")) move = false
  }
</script>

<svelte:window on:mouseup={mouseup} on:mousemove={mousemove} on:keydown={keydown} />

<main>
  <!-- <h1>FreeShow</h1> -->

  <ContextMenu />
  <!-- {contextMenu && <ContextMenu event={contextMenu} setAction={setAction} />} -->

  <div class="column">
    <Top />
    <!-- <div class="row"> -->
    <!-- All / Current/active -->

    <div class="row">
      <div class="left" style="width: {leftWidth}px" on:mousedown={mousedown} on:click={click}>
        {#if page === "show"}
          <Projects />
          <ProjectTools />
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
      <div class="right" style="width: {rightWidth}px" on:mousedown={mousedown} on:click={click}>
        <Preview />
        {#if page === "show"}
          <ShowTools />
        {:else if page === "edit"}
          <EditTools />
        {/if}
      </div>
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
    /* align-content: stretch; */
    /* box-sizing: border-box; */
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
    justify-content: space-between;
    overflow: hidden;
    position: relative;
  }
  .left {
    padding-right: 4px;
  }
  .right {
    padding-left: 4px;
  }
  .left::after,
  .right::after {
    content: "";
    background-color: var(--secondary);
    position: absolute;
    width: 4px;
    height: 100%;
    cursor: ew-resize;
  }
  .left::after {
    right: 0;
  }
  .right::after {
    left: 0;
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
