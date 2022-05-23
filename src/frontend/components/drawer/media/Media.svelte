<script lang="ts">
  import { READ_FOLDER } from "../../../../types/Channels"
  import { activeShow, dictionary, imageExtensions, mediaFolders, mediaOptions, videoExtensions } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Center from "../../system/Center.svelte"
  import Folder from "./Folder.svelte"
  import Media from "./MediaCard.svelte"

  export let active: string | null

  let files: any[] = []
  let extensions: string[] = [...$videoExtensions, ...$imageExtensions]

  $: rootPath = active === "all" ? "" : active !== null ? $mediaFolders[active].path! : ""
  $: path = active === "all" ? "" : rootPath
  $: name =
    rootPath === path
      ? active !== "all" && active !== null
        ? $mediaFolders[active].name
        : "category.all"
      : path.substring((path.lastIndexOf("\\") > -1 ? path.lastIndexOf("\\") : path.lastIndexOf("/")) + 1)

  // get list of files & folders
  let prevActive: null | string = null
  $: {
    if (active === "all") {
      if (active !== prevActive) {
        prevActive = active
        files = []
        Object.values($mediaFolders).forEach((data) => window.api.send(READ_FOLDER, data.path))
      }
    } else if (path.length) {
      if (path !== prevActive) {
        prevActive = path
        files = []
        window.api.send(READ_FOLDER, path)
      }
    }
  }

  // receive files
  window.api.receive(READ_FOLDER, (msg: any) => {
    if (active === "all" || msg.path === path) {
      files.push(
        ...msg.files
          .filter((file: any) => extensions.includes(file.extension) || file.folder)
          // .sort((a: any, b: any) => a.name < b.name)
          .sort((a: any, b: any) => (a.folder === b.folder ? 0 : a.folder ? -1 : 1))
      )

      filterFiles()

      slowLoader = 10
      increaseLoading()
    }
  })

  let scrollElem: any

  // arrow selector
  let activeFile: null | number = null
  let allFiles: string[] = []
  let content = allFiles.length

  activeShow.subscribe((a) => {
    if (a?.type !== "video" && $activeShow?.type !== "image") activeFile = null
  })

  // filter files
  let activeView: "all" | "folder" | "image" | "video" = "all"
  let filteredFiles: any[] = []
  $: if (activeView) filterFiles()

  function filterFiles() {
    // filter files
    if (activeView === "all") filteredFiles = files.filter((a) => active !== "all" || !a.folder)
    else
      filteredFiles = files.filter(
        (a) => (activeView === "folder" && active !== "all" && a.folder) || (!a.folder && activeView === ($videoExtensions.includes(a.extension) ? "video" : "image"))
      )

    // reset arrow selector
    allFiles = [...filteredFiles.filter((a) => !a.folder).map((a) => a.path)]
    if ($activeShow !== null && allFiles.includes($activeShow.id)) activeFile = allFiles.findIndex((a) => a === $activeShow!.id)
    else activeFile = null
    content = allFiles.length

    // scroll to top
    scrollElem?.scrollTo(0, 0)
  }

  function wheel(e: any) {
    if (e.ctrlKey || e.metaKey) mediaOptions.set({ ...$mediaOptions, columns: Math.max(2, Math.min(10, $mediaOptions.columns + e.deltaY / 100)) })
  }

  const shortcuts: any = {
    ArrowRight: () => {
      if (activeFile === null || activeFile < content - 1) activeFile = activeFile === null ? 0 : activeFile + 1
    },
    ArrowLeft: () => {
      if (activeFile === null || activeFile > 0) activeFile = activeFile === null ? content - 1 : activeFile - 1
    },
    Backspace: () => {
      if (rootPath === path) return
      goBack()
    },
  }

  function keydown(e: any) {
    if (e.target.closest("input") || e.target.closest(".edit") || !e.ctrlKey || !allFiles.length) return

    if (shortcuts[e.key]) {
      // e.preventDefault()
      shortcuts[e.key]()
    }
  }

  function goBack() {
    const lastSlash = path.lastIndexOf("\\") > -1 ? path.lastIndexOf("\\") : path.lastIndexOf("/")
    const folder = path.slice(0, lastSlash)
    path = folder.length > rootPath.length ? folder : rootPath
  }

  const slidesViews: any = { grid: "list", list: "grid" }
  const nextActiveView: any = { all: "folder", folder: "image", image: "video", video: "all" }

  // TODO: temporary loading preformance test
  let slowLoader: number = 10
  let timeout: any = null
  function increaseLoading() {
    if (timeout) clearTimeout(timeout)
    if (slowLoader < filteredFiles.length) {
      setTimeout(() => {
        slowLoader += 1
        console.log(slowLoader + "/" + filteredFiles.length)
        increaseLoading()
      }, 200)
    }
  }
</script>

<svelte:window on:keydown={keydown} />

<!-- TODO: fix: big images & many files -->
<!-- TODO: autoscroll -->
<!-- TODO: ctrl+arrow keys change drawer item... -->
<div class="scroll" style="flex: 1;overflow-y: auto;" bind:this={scrollElem} on:wheel={wheel}>
  <div class="grid" class:list={$mediaOptions.mode === "list"} style="height: 100%;">
    {#if filteredFiles.length}
      {#key rootPath}
        {#key path}
          {#each filteredFiles as file, i}
            {#if file.folder}
              <Folder bind:rootPath={path} name={file.name} path={file.path} />
            {:else if slowLoader > i}
              <Media name={file.name} path={file.path} type={$videoExtensions.includes(file.extension) ? "video" : "image"} bind:activeFile {allFiles} />
            {/if}
          {/each}
        {/key}
      {/key}
    {:else}
      <Center>
        <Icon id="noImage" size={5} />
      </Center>
    {/if}
  </div>
</div>

<div class="tabs" style="display: flex;align-items: center;">
  <Button disabled={rootPath === path} title={$dictionary.actions?.back} on:click={goBack}>
    <Icon size={1.3} id="back" />
  </Button>
  <Button disabled={rootPath === path} title={$dictionary.actions?.home} on:click={() => (path = rootPath)}>
    <Icon size={1.3} id="home" />
  </Button>
  <span style="flex: 1;text-align: center;">
    {#key name}
      {#if name.includes(".")}
        <T id={name} />
      {:else}
        {name}
      {/if}
    {/key}
  </span>
  <Button disabled={!allFiles.length || activeFile === 0} on:click={() => (activeFile = activeFile === null ? content - 1 : activeFile - 1)}>
    <Icon size={1.3} id="previous" />
  </Button>
  {activeFile === null ? "" : activeFile + 1 + "/"}{content}
  <Button disabled={!allFiles.length || activeFile === content - 1} on:click={() => (activeFile = activeFile === null ? 0 : activeFile + 1)}>
    <Icon size={1.3} id="next" />
  </Button>
  <div class="seperator" />
  <Button title={$dictionary.media?.[activeView]} on:click={() => (activeView = nextActiveView[activeView])}>
    <Icon size={1.3} id={activeView} white={activeView === "all"} />
  </Button>
  <Button
    on:click={() =>
      mediaOptions.update((a) => {
        a.mode = slidesViews[$mediaOptions.mode]
        return a
      })}
    title={$dictionary.show?.[$mediaOptions.mode]}
  >
    <Icon size={1.3} id={$mediaOptions.mode} white />
  </Button>
  <Button
    disabled={$mediaOptions.columns >= 10}
    on:click={() => mediaOptions.set({ ...$mediaOptions, columns: Math.min(10, $mediaOptions.columns + 1) })}
    title={$dictionary.actions?.zoomOut}
  >
    <Icon size={1.3} id="remove" white />
  </Button>
  <Button
    disabled={$mediaOptions.columns <= 2}
    on:click={() => mediaOptions.set({ ...$mediaOptions, columns: Math.max(2, $mediaOptions.columns - 1) })}
    title={$dictionary.actions?.zoomIn}
  >
    <Icon size={1.3} id="add" white />
  </Button>
  <p class="text">{(100 / $mediaOptions.columns).toFixed()}%</p>
</div>

<style>
  .tabs {
    display: flex;
    background-color: var(--primary-darkest);
  }

  .grid {
    display: flex;
    flex-wrap: wrap;
    flex: 1;
    /* gap: 10px;
    padding: 10px; */
    padding: 5px;
    place-content: flex-start;
  }

  .text {
    opacity: 0.8;
    text-align: right;
    width: 50px;
    margin-right: 10px;
  }

  .seperator {
    width: 3px;
    height: 100%;
    background-color: var(--primary-lighter);
  }
</style>
