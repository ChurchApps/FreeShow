<script lang="ts">
  import { uid } from "uid"
  import { activeShow, dictionary, outBackground, playerVideos } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import HiddenInput from "../../inputs/HiddenInput.svelte"
  import TextInput from "../../inputs/TextInput.svelte"
  import Center from "../../system/Center.svelte"
  import SelectElem from "../../system/SelectElem.svelte"

  export let active: any

  // const urls: any = {
  //   youtube: "https://youtube.com/v/3020988",
  // }
  // $: url = active ? urls[active] : null
  // $: console.log(url)

  // export let id: string

  function setValue(e: any, key: string) {
    data[key] = e.target.value
  }

  let data: any = { name: "", id: "" }
  function add() {
    // TODO: remove url (keep only id)
    if (data.id.length)
      playerVideos.update((a) => {
        if (!data.name.length) data.name = data.id
        a[uid()] = { ...data, type: active }
        return a
      })
    data = { name: "", id: "" }
  }

  function changeName(name: string, id: string) {
    playerVideos.update((a) => {
      a[id].name = name
      return a
    })
  }

  $: videos = Object.entries($playerVideos)
    .map(([id, video]: any) => ({ rid: id, ...video }))
    .filter((a) => a.type === active)
    .sort((a, b) => (a.name < b.name ? -1 : 1))
</script>

<!-- TODO: loading -->
<div class="main">
  <div class="scroll">
    <div class="content" style="height: 100%;">
      {#if videos.length}
        {#each videos as video}
          <SelectElem id="player" data={video.rid} draggable>
            <Button
              class="context #player_button"
              on:click={() => activeShow.set({ id: video.rid, type: "player" })}
              on:dblclick={() => outBackground.set({ id: video.rid, type: "player" })}
              active={$activeShow?.id === video.rid}
              bold={false}
              border
            >
              <HiddenInput value={video.name || ""} id={"player_" + video.rid} on:edit={(e) => changeName(e.detail.value, video.rid)} />
              <span style="opacity: 0.5;">{video.id}</span>
            </Button>
          </SelectElem>
        {/each}
      {:else}
        <Center faded>
          <T id="empty.player" />
        </Center>
      {/if}
    </div>
  </div>
  <div class="add">
    <TextInput value={data.name} on:change={(e) => setValue(e, "name")} placeholder={$dictionary.inputs?.name} />
    <TextInput value={data.id} on:change={(e) => setValue(e, "id")} placeholder={$dictionary.inputs?.video_id} />
    <Button on:click={add} style="white-space: nowrap;">
      <Icon id="add" right />
      <T id="settings.add" />
    </Button>
  </div>
</div>

<!-- <iframe src={url} title="Web" frameborder="0" /> -->
<style>
  .main {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    background-color: var(--primary-darker);
    flex: 1;
  }

  /* .main :global(iframe) {
    height: 100%;
    width: 100%;
    overflow: hidden;
  } */

  .scroll :global(button) {
    padding: 10px;
    width: 100%;
    display: flex;
    justify-content: space-between;

    background-color: inherit;
    color: inherit;
    font-size: 0.9em;
    border: none;
    display: flex;
    align-items: center;
    padding: 0.2em 0.8em;
    transition: background-color 0.2s;
  }

  .scroll {
    overflow-y: auto;
    flex: 1;
  }

  /* .content {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    background-color: var(--primary-darker);
    height: 100%;
  } */

  .add,
  .add :global(input) {
    display: flex;
    background-color: var(--primary-darkest);
  }
</style>
