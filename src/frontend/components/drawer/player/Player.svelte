<script lang="ts">
  import { uid } from "uid"

  import { activeShow, outBackground, playerVideos } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import Button from "../../inputs/Button.svelte"
  import HiddenInput from "../../inputs/HiddenInput.svelte"
  import TextInput from "../../inputs/TextInput.svelte"
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
    playerVideos.update((a) => {
      a[uid()] = { ...data, type: active }
      return a
    })
    data = { name: "", id: "" }
  }
</script>

<!-- TODO: loading -->
<div class="main">
  <div class="scroll">
    <div class="content">
      {#each Object.entries($playerVideos) as [id, video]}
        {#if video.type === active}
          <SelectElem id="player" data={id} draggable>
            <Button
              on:click={() => activeShow.set({ id, type: "player" })}
              on:dblclick={() => outBackground.set({ id, type: "player" })}
              active={$activeShow?.id === id}
              bold={false}
              border
            >
              <HiddenInput value={video.name} />
              <span style="opacity: 0.5;">{video.id}</span>
            </Button>
          </SelectElem>
        {/if}
      {/each}
    </div>
  </div>
  <div class="add">
    <TextInput value={data.name} on:change={(e) => setValue(e, "name")} placeholder="[[[Name]]]" />
    <TextInput value={data.id} on:change={(e) => setValue(e, "id")} placeholder="[[[Url/ID]]]" />
    <Button on:click={add}>
      <Icon id="add" />
      Add
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
