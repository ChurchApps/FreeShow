<script>
  import { activeShow, activeSlide, projects, projectView } from "../../stores";

  import Icon from "../helpers/Icon.svelte";

	export let name;
	export let id;
	export let type = null;
  
	// export let location;
	// export let access;

	export let category;
  const check = () => {
    if (!category[1]) return category[0];
    // else if (category[0].toLowerCase().includes('song') || category[0].toLowerCase().includes('music')) return 'song';
    else if (category[0].toLowerCase().includes('info') || category[0].toLowerCase().includes('presentation')) return 'presentation';
    else return 'song';
  }
  $: icon = check();
  $: active = $activeShow?.id === id;
</script>

<!-- <span style="background-image: url(tutorial/icons/{type}.svg)">{name}</span> -->
<button on:click={() => activeShow.set({id, type})} on:dblclick={() => {activeSlide.set({id, index: 0})}} class:active>
  <Icon name={icon} />
  <p style="margin: 5px;">{name}</p>
</button>
<!-- <button class="listItem" on:click={() => setFreeShow({...freeShow, project: i})} onDoubleClick={() => {setProject(false); setFreeShow({...freeShow, activeSong: projects[i].timeline[0].name})}}>{project.name}</button> -->

<style>
	button {
    width: 100%;
		padding: .3em;
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