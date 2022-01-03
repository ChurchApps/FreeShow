<script lang="ts">
  import { FOLDER_READ } from "../../../../types/Channels"
  import { mediaFolders } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Center from "../../system/Center.svelte"
  import Folder from "./Folder.svelte"
  import Media from "./Media.svelte"

  export let active: string | null

  // get list of files
  interface Files {
    [key: string]: { folders: string[]; files: string[] }
  }
  let files: Files = {}
  let folders: any = { folders: [], files: [] }
  let folder: null | string = null
  $: {
    if (folder !== null) window.api.send(FOLDER_READ, { id: "___folder", url: folder, filters: ["png", "jpg", "jpeg", "mp4", "mov"] })
  }
  $: if (active) folder = null
  mediaFolders.subscribe((mf) => {
    Object.entries(mf).forEach((folder) => {
      window.api.send(FOLDER_READ, { id: folder[0], url: folder[1].url, filters: ["png", "jpg", "jpeg", "mp4", "mov"] })
    })
  })
  window.api.receive(FOLDER_READ, (msg: any) => {
    if (msg.id !== "___files") {
      if (msg.id === "___folder") {
        msg.data.url = folder
        folders = msg.data
      } else files[msg.id] = msg.data || { folders: [], files: [] }
    }
  })
  $: console.log(files)
</script>

<!-- TODO: fix: big images & many files -->
{#key folder}
  {#key active}
    <div class="scroll" style="flex: 1;overflow-y: auto;">
      <div class="grid" style="height: 100%;">
        {#if folder !== null}
          {#if active && folders.folders.length + folders.files.length > 0}
            {#each folders.folders as name}
              <Folder bind:folder {name} url={folders.url} />
            {/each}
            {#key folder}
              {#each folders.files as name}
                <Media {name} url={folders.url} />
              {/each}
            {/key}
          {:else}
            <Center>
              <Icon id="noImage" size={5} />
            </Center>
          {/if}
        {:else if active === "all"}
          {#key $mediaFolders}
            <!-- {#key folder} -->
            {#each Object.entries(files) as [url, fileList]}
              <!-- {#each fileList.folders as name}
          <Folder {name} id={url} />
        {/each} -->
              {#each fileList.files as name}
                <Media {name} id={url} />
              {/each}
            {/each}
            <!-- {/key} -->
          {/key}
        {:else if active && files[active].files.length + files[active].folders.length > 0}
          {#if active}
            {#each files[active].folders as name}
              <Folder bind:folder {name} id={active} />
            {/each}
            {#each files[active].files as name}
              <Media {name} id={active} />
            {/each}
          {/if}
        {:else}
          <Center>
            <Icon id="noImage" size={5} />
          </Center>
        {/if}
      </div>
    </div>
  {/key}
{/key}
<div class="tabs" style="display: flex;justify-content: space-evenly;align-items: center;">
  {#if folder}
    <Button
      size={1.3}
      on:click={() => {
        let arr = folder?.split("/") || []
        arr.pop()
        if (arr.join("/").length > (active?.length || 0)) folder = arr.join("/")
        else folder = null
      }}
    >
      <Icon id="previous" />
    </Button>
    {folder.split("/").pop()}
    <Button size={1.3} on:click={() => (folder = null)}>
      <Icon id="home" />
    </Button>
  {:else if active && $mediaFolders[active]}
    <T id={$mediaFolders[active].name} />
  {:else}
    {active}
  {/if}
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
