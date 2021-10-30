<script lang="ts">
  import type { ID } from "../../../types/Show"

  import { activeProject, activeShow, projects, projectView } from "../../stores"

  import Icon from "../helpers/Icon.svelte"
  import HiddenInput from "./HiddenInput.svelte"

  export let name: string
  export let id: ID
  // export let type: ShowType
  // export let created;
  // export let parent; // path
  // $: type = name.slice(name.lastIndexOf(".") + 1)
  $: active = $activeProject === id
</script>

<!-- <span style="background-image: url(tutorial/icons/{type}.svg)">{name}</span> -->
<button
  on:click={() => activeProject.set(id)}
  on:dblclick={() => {
    projectView.set(false)
    activeShow.set({ id: $projects[id].shows[0].id, type: $projects[id].shows[0].type })
  }}
  class:active
>
  <Icon id="file" />
  <HiddenInput value={name} />
</button>

<!-- <button class="listItem" on:click={() => setFreeShow({...freeShow, project: i})} onDoubleClick={() => {setProject(false); setFreeShow({...freeShow, activeSong: projects[i].timeline[0].name})}}>{project.name}</button> -->
<style>
  button {
    width: 100%;
    padding: 0.3em;
    background-color: inherit;
    color: inherit;
    font-size: inherit;
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
