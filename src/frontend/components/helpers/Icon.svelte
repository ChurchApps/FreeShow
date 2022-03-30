<script lang="ts">
  import { activePopup } from "../../stores"
  import { customIcons } from "../main/customIcons"
  import icons from "./icons"

  export let id: string
  export let size: number = 1
  export let white: boolean = false
  export let right: boolean = false
  export let fill: boolean = false
  export let custom: boolean = false
  export let select: boolean = false

  $: width = size + "rem"
  $: height = size + "rem"
  let box: number = 24

  $: icon = custom ? customIcons[id] : icons[id]

  const click = () => {
    if (select) activePopup.set("icon")
  }
</script>

<svg
  class={$$props.class}
  class:white
  class:right
  class:fill
  class:select
  on:click={click}
  style="{$$props.style || ''} min-width: {width}"
  {width}
  {height}
  viewBox="0 0 {box} {box}"
>
  {@html icon ? icon : icons.noIcon}
</svg>

<style>
  svg {
    fill: var(--secondary);
  }

  svg.select {
    cursor: pointer;
  }

  svg.select:hover {
    background-color: var(--hover);
  }

  svg.white {
    fill: var(--text);
  }

  svg.right {
    padding-right: 0.8em;
  }

  svg.fill {
    width: 100%;
    height: 100%;
  }
</style>
