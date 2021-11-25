<script lang="ts">
  import type { ID, ShowType } from "../../../types/Show"
  import { activeShow, dragged, dragSelected, outSlide, shows } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import Draggable from "../system/Draggable.svelte"
  import Button from "./Button.svelte"
  import HiddenInput from "./HiddenInput.svelte"

  export let name: string
  export let id: ID
  export let index: number
  export let type: ShowType = null
  export let page: "side" | "drawer" = "drawer"
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

  function click() {
    console.log(active, overIndex)

    if (!active) activeShow.set({ id, type }) //  && !e.target.classList.contains("name")
  }

  function doubleClick(e: any) {
    if ($shows[id] && !e.target.classList.contains("name")) {
      outSlide.set({ id, index: 0 })
    }
  }

  export let overIndex: null | number
  let side: "left" | "right" = "left"
  // TODO: only left toolbar
  function dragenter() {
    if ($dragged === "show") {
      overIndex = index
    }
  }
</script>

<div
  class="main"
  on:mousedown={(e) => {
    if (page === "drawer") dragSelected.set([])
    else if (!$dragSelected.includes(index)) {
      if (e.ctrlKey) dragSelected.set([...$dragSelected, index])
      else dragSelected.set([index])
    }
  }}
>
  <Draggable id="show" data={JSON.stringify({ id, type })} on:dragenter={dragenter} hover={overIndex ? overIndex === index : false} {side} direction="column">
    <!-- <span style="background-image: url(tutorial/icons/{type}.svg)">{name}</span> -->
    <Button on:click={click} on:dblclick={doubleClick} {active} class="context_show_button" {style} bold={false} border>
      {#if icon}
        <Icon id={icon} />
      {/if}
      <!-- <p style="margin: 5px;">{name}</p> -->
      <HiddenInput value={name} />

      {#if m}
        {m}
      {/if}
    </Button>
  </Draggable>
</div>

<style>
  .main :global(button) {
    width: 100%;
  }
</style>
