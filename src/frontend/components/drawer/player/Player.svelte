<script lang="ts">
  import { activeShow, outBackground, playerVideos } from "../../../stores"
  import Button from "../../inputs/Button.svelte"
  import HiddenInput from "../../inputs/HiddenInput.svelte"
  import SelectElem from "../../system/SelectElem.svelte"

  export let active: string | null

  // const urls: any = {
  //   youtube: "https://youtube.com/v/3020988",
  // }
  // $: url = active ? urls[active] : null
  // $: console.log(url)

  // export let id: string
</script>

<!-- TODO: loading -->
<div class="main">
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
  <!-- {#if active === "youtube"}
        <YouTube {id} />
  {/if} -->
</div>

<!-- <iframe src={url} title="Web" frameborder="0" /> -->
<style>
  .main,
  .main :global(iframe) {
    height: 100%;
    width: 100%;
    overflow: hidden;
  }

  .main :global(button) {
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
</style>
