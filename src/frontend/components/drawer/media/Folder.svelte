<script lang="ts">
  import { FOLDER_READ } from "../../../../types/Channels"

  import { mediaFolders } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import Card from "../Card.svelte"
  import Label from "../Label.svelte"

  export let id: string = ""
  export let name: string
  export let folder: null | string
  export let url: string = $mediaFolders[id].url || ""
  // $: url = url + "/" + name

  let files: string[] = []
  let count: number = 0

  window.api.send(FOLDER_READ, { id: "___files" + url + "/" + name, url: url + "/" + name, filters: ["png", "jpg", "jpeg"] })
  window.api.receive(FOLDER_READ, (msg: any) => {
    if (msg.id === "___files" + url + "/" + name) {
      files = msg.data.files.slice(0, 4)
      count = msg.data.length
    }
  })
</script>

<Card on:click={() => (folder = url + "/" + name)}>
  <div class="grid">
    {#if files.length}
      {#each files as file}
        <img src={url + "/" + name + "/" + file} alt={file} />
      {/each}
    {:else if count}
      <Icon id="video" />
    {:else}
      <Icon id="empty" />
    {/if}
  </div>
  <Label label={name} icon={"folder"} white />
</Card>

<style>
  .grid {
    display: flex;
    flex-wrap: wrap;
  }
  .grid img {
    width: 50%;
  }
</style>
