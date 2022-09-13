<script lang="ts">
  import { createEventDispatcher } from "svelte"

  // import Icon from "../helpers/Icon.svelte"
  import Button from "./Button.svelte"
  // import HiddenInput from "./HiddenInput.svelte"

  export let activeShow: any
  export let show: any
  // export let project: null | string
  // export let projects: any
  // export let shows: any

  export let data: null | string = null

  // export let page: "side" | "drawer" = "drawer"
  export let match: null | number = null
  // TODO: svelte animate
  // search
  $: style = match !== null ? `background: linear-gradient(to right, var(--secondary-opacity) ${match}%, transparent ${match}%);` : ""

  // export let location;
  // export let access;

  // export let icon: null | string = null
  // export let category: string
  // const check = () => {
  //   if (!category[1]) return category[0]
  //   // else if (category[0].toLowerCase().includes('song') || category[0].toLowerCase().includes('music')) return 'song';
  //   else if (category[0].toLowerCase().includes("info") || category[0].toLowerCase().includes("presentation")) return "presentation"
  //   else return "song"
  // }
  // $: icon = check()
  // $: active = index !== null ? activeShow?.index === index : activeShow?.id === id

  // function click(e: any) {
  //   // get pos if clicked in drawer show
  //   let pos = index
  //   if (pos === null && project !== null && JSON.stringify(projects[project].shows).includes(id)) {
  //     pos = projects[project].shows.findIndex((p: any) => p.id === id)
  //   }
  //   // set active show
  //   if (!e.ctrlKey && !active && !e.target.closest("input")) activeShow.set({ id, index: pos, type })
  // }

  // function doubleClick(e: any) {
  //   console.log(e)

  //   // if (!$outLocked && $shows[id] && !e.target.classList.contains("name")) {
  //   //   outSlide.set({ id, index: 0 })
  //   // }
  // }

  let dispatch = createEventDispatcher()
  function click() {
    dispatch("click", show.id)
  }
</script>

<div id={show.id} class="main">
  <!-- on:click={click} on:dblclick={doubleClick} -->
  <Button on:click={click} active={activeShow?.id === show.id} class="context {$$props.class}" {style} bold={false} border>
    <span style="display: flex;align-items: center;flex: 1;">
      <!-- {#if icon}
          <Icon id={icon} />
        {/if} -->
      <p style="margin: 5px;white-space: nowrap;text-overflow: ellipsis;overflow: hidden;">{show.name}</p>
      <!-- <HiddenInput value={name} on:edit={edit} /> -->
    </span>

    {#if match}
      <span style="opacity: 0.8;padding-left: 10px;">
        {match}%
      </span>
    {/if}

    {#if data}
      <span style="opacity: 0.5;padding-left: 10px;font-size: 0.8em;overflow: hidden;text-overflow: ellipsis;white-space: nowrap;">{data}</span>
    {/if}
  </Button>
</div>

<style>
  .main :global(button) {
    width: 100%;
    justify-content: space-between;
  }
</style>
