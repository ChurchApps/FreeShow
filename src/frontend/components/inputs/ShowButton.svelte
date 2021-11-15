<script lang="ts">
  import type { ID, ShowType } from "../../../types/Show"

  import { activeShow, outSlide, shows } from "../../stores"

  import Icon from "../helpers/Icon.svelte"
  import Button from "./Button.svelte"
  import HiddenInput from "./HiddenInput.svelte"

  export let name: string
  export let id: ID
  export let type: ShowType = null
  export let match: [null] | [number, string] = [null]
  $: m = match[0]
  // TODO: svelte animate
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
    if (!active) activeShow.set({ id, type }) //  && !e.target.classList.contains("name")
  }

  function doubleClick(e: any) {
    if ($shows[id] && !e.target.classList.contains("name")) {
      outSlide.set({ id, index: 0 })
    }
  }
</script>

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
