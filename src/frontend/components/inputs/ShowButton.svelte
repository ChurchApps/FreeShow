<script lang="ts">
  import type { ID, ShowType } from "../../../types/Show"

  import { activeShow, output, shows } from "../../stores"

  import Icon from "../helpers/Icon.svelte"
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
      output.update((o) => {
        o.slide = {
          id,
          index: 0,
        }
        return o
      })
    }
  }
</script>

<!-- <span style="background-image: url(tutorial/icons/{type}.svg)">{name}</span> -->
<button on:click={click} on:dblclick={doubleClick} class:active class="context_show_button" {style}>
  {#if icon}
    <Icon id={icon} />
  {/if}
  <!-- <p style="margin: 5px;">{name}</p> -->
  <HiddenInput value={name} />

  {#if m}
    {m}
  {/if}
</button>

<!-- <button class="listItem" on:click={() => setFreeShow({...freeShow, project: i})} onDoubleClick={() => {setProject(false); setFreeShow({...freeShow, activeSong: projects[i].timeline[0].name})}}>{project.name}</button> -->
<style>
  button {
    width: 100%;
    padding: 0.1em 0.5em;
    background-color: inherit;
    color: inherit;
    font-size: inherit;
    border: none;
    /* border: 2px solid var(--secondary); */

    display: flex;
    align-items: center;
    /* background-color: rgb(255 255 255 / .05); */
    cursor: pointer;
  }
  button:hover {
    background-color: var(--hover);
  }
  button.active {
    background-color: var(--secondary-opacity);
    color: var(--secondary-text);
    outline-offset: -2px;
    outline: 2px solid var(--secondary);
  }
  /* hover */
  button :global(svg) {
    padding: 0 10px;
    box-sizing: content-box;
  }
</style>
