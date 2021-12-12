<script lang="ts">
  import type { ID } from "../../../types/Show"

  import { activeProject, activeShow, projects, projectView } from "../../stores"

  import Icon from "../helpers/Icon.svelte"
  import HiddenInput from "./HiddenInput.svelte"

  export let name: string
  export let parent: ID
  export let id: ID
  // export let type: ShowType
  // export let created;
  // export let parent; // path
  // $: type = name.slice(name.lastIndexOf(".") + 1)
  $: active = $activeProject === id

  function click() {
    // set new project
    activeProject.set(id)

    // get active show pos
    if ($activeShow !== null) {
      let pos: number = -1
      if ($activeProject !== null) pos = $projects[$activeProject].shows.findIndex((p) => p.id === $activeShow!.id)
      console.log(pos)

      activeShow.update((as: any) => {
        as.index = pos >= 0 ? pos : null
        return as
      })
    }
  }
</script>

<!-- <span style="background-image: url(tutorial/icons/{type}.svg)">{name}</span> -->
<button
  on:click={click}
  on:dblclick={() => {
    projectView.set(false)
    if ($projects[id].shows.length) activeShow.set({ ...$projects[id].shows[0], index: 0 })
  }}
  data-parent={parent}
  class="context #rename__projects"
  class:active
>
  <Icon id="file" />
  <HiddenInput value={name} />
</button>

<!-- <button class="listItem" on:click={() => setFreeShow({...freeShow, project: i})} onDoubleClick={() => {setProject(false); setFreeShow({...freeShow, activeSong: projects[i].timeline[0].name})}}>{project.name}</button> -->
<style>
  button {
    width: 100%;
    padding: 0 0.3em;
    background-color: inherit;
    color: inherit;
    font-size: 0.9em;
    border: 2px solid var(--secondary);

    display: flex;
    align-items: center;
    /* background-color: rgb(255 255 255 / .05); */
    cursor: pointer;
  }
  button.active {
    background-color: var(--secondary-opacity);
    color: var(--secondary-text);
  }
  /* hover */
  button :global(svg) {
    padding: 0 10px;
    box-sizing: content-box;
  }
</style>
