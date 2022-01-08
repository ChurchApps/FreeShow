<script lang="ts">
  import { READ_FOLDER } from "../../../../types/Channels"
  import { activeShow, mediaFolders } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Center from "../../system/Center.svelte"
  import Folder from "./Folder.svelte"
  import Media from "./Media.svelte"

  export let active: string | null

  let files: any[] = []

  $: rootPath = active === "all" ? "" : active !== null ? $mediaFolders[active].path! : ""
  $: path = active === "all" ? "" : rootPath
  $: name = rootPath === path ? (active !== "all" && active !== null ? $mediaFolders[active].name : "category.all") : path.substring(path.lastIndexOf("\\") + 1)

  // get list of files & folders
  $: {
    if (active === "all") {
      files = []
      Object.values($mediaFolders).forEach((data) => {
        window.api.send(READ_FOLDER, data.path)
      })
    } else if (path.length) window.api.send(READ_FOLDER, path)
  }

  let videoExtensions: string[] = ["mp4", "mov"]
  let imageExtensions: string[] = ["png", "jpg", "jpeg"]
  let extensions: string[] = [...videoExtensions, ...imageExtensions]
  // receive files
  window.api.receive(READ_FOLDER, (msg: any) => {
    if (active === "all" || msg.path === path) {
      console.log(msg)
      files = msg.files
        .filter((file: any) => extensions.includes(file.extension) || file.folder)
        // .sort((a: any, b: any) => a.name < b.name)
        .sort((a: any, b: any) => (a.folder === b.folder ? 0 : a.folder ? -1 : 1))

      allFiles = [...files.filter((a) => !a.folder).map((a) => a.path)]
      if ($activeShow !== null && allFiles.includes($activeShow.id) && activeFile === null) activeFile = allFiles.findIndex((a) => a === $activeShow!.id)

      // testing
      // files = [...files, ...files, ...files, ...files]

      scrollElem?.scrollTo(0, 0)
    }
  })

  let scrollElem: any

  let activeFile: null | number = null
  let allFiles: string[] = []
  // TODO: update on path change!
  $: if (active) activeFile = null
  $: content = allFiles.length

  activeShow.subscribe((a) => {
    if (a?.type !== "video" && $activeShow?.type !== "image") activeFile = null
  })
</script>

<!-- TODO: fix: big images & many files -->
<!-- {#key files} -->
<!-- TODO: autoscroll -->
<!-- TODO: droparea for files????????? -->
<!-- TODO: ctrl scroll wheel zoom! -->
<div class="scroll" style="flex: 1;overflow-y: auto;" bind:this={scrollElem}>
  <div class="grid" style="height: 100%;">
    {#if files.length}
      {#key rootPath}
        {#key path}
          {#each files as file}
            {#if !file.folder}
              <!-- size={file.stat.size} -->
              <Media name={file.name} path={file.path} type={videoExtensions.includes(file.extension) ? "video" : "image"} bind:activeFile {allFiles} />
            {:else if active !== "all"}
              <Folder bind:rootPath={path} name={file.name} path={file.path} />
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
<!-- {/key} -->

<div class="tabs" style="display: flex;align-items: center;">
  <Button
    disabled={rootPath === path}
    title="[[[Go back]]]"
    on:click={() => {
      const folder = path.slice(0, path.lastIndexOf("\\"))
      if (folder.length > rootPath.length) path = folder
      else path = rootPath
    }}
  >
    <Icon size={1.3} id="back" />
  </Button>
  <Button disabled={rootPath === path} title="[[[Home]]]" on:click={() => (path = rootPath)}>
    <Icon size={1.3} id="home" />
  </Button>
  <span style="flex: 1;text-align: center;">
    {#key name}<T id={name} />{/key}
  </span>
  <Button disabled={!allFiles.length || activeFile === 0} on:click={() => (activeFile = activeFile === null ? content - 1 : activeFile - 1)}>
    <Icon size={1.3} id="previous" />
  </Button>
  {activeFile === null ? "" : activeFile + 1 + "/"}{content}
  <Button disabled={!allFiles.length || activeFile === content - 1} on:click={() => (activeFile = activeFile === null ? 0 : activeFile + 1)}>
    <Icon size={1.3} id="next" />
  </Button>
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
    gap: 10px;
    padding: 10px;
  }
</style>
