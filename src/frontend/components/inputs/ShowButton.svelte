<script lang="ts">
  import type { ID, ShowType } from "../../../types/Show"
  import { activeShow, outSlide, shows } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import Draggable from "../system/Draggable.svelte"
  import Button from "./Button.svelte"
  import HiddenInput from "./HiddenInput.svelte"

  export let name: string
  export let id: ID
  export let data: null | string = null
  export let index: null | number = null
  export let type: ShowType = null
  // export let page: "side" | "drawer" = "drawer"
  export let match: [null] | [number, string] = [null]
  $: m = match[0]
  // TODO: svelte animate
  // search
  $: style = match[0] ? `background: linear-gradient(to right, var(--secondary-opacity) ${m}%, transparent ${m}%);` : ""

  // export let location;
  // export let access;

  export let icon: null | string = null
  // export let category: string
  // const check = () => {
  //   if (!category[1]) return category[0]
  //   // else if (category[0].toLowerCase().includes('song') || category[0].toLowerCase().includes('music')) return 'song';
  //   else if (category[0].toLowerCase().includes("info") || category[0].toLowerCase().includes("presentation")) return "presentation"
  //   else return "song"
  // }
  // $: icon = check()
  $: active = $activeShow?.id === id

  function click(e: any) {
    if (!e.ctrlKey && !active && !e.target.closest("input")) activeShow.set({ id, type })
  }

  function doubleClick(e: any) {
    if ($shows[id] && !e.target.classList.contains("name")) {
      outSlide.set({ id, index: 0 })
    }
  }

  function edit(event: any) {
    shows.update((s: any) => {
      s[id].name = event.detail.value
      return s
    })
  }
</script>

<div class="main">
  <!-- <SelectElem id="show" data={{ id, type }}> -->
  <Draggable id="show" {index} direction="column">
    <!-- <span style="background-image: url(tutorial/icons/{type}.svg)">{name}</span> -->
    <!-- WIP padding-left: 0.8em; -->
    <Button on:click={click} on:dblclick={doubleClick} {active} class="context {$$props.class}" {style} bold={false} border>
      <span style="display: flex;align-items: center;flex: 1;">
        {#if icon}
          <Icon id={icon} />
        {/if}
        <!-- <p style="margin: 5px;">{name}</p> -->
        <HiddenInput value={name} on:edit={edit} />
      </span>

      {#if m}
        <span style="opacity: 0.8;padding-left: 10px;">
          {m}%
        </span>
      {/if}

      {#if data}
        <span style="opacity: 0.5;padding-left: 10px;">{data}</span>
      {/if}
    </Button>
  </Draggable>
  <!-- </SelectElem> -->
</div>

<style>
  .main :global(button) {
    width: 100%;
    justify-content: space-between;
  }
</style>
