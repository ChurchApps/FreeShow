<script lang="ts">
  // import Icon from "../helpers/Icon.svelte"
  import ProjectButton from "./ProjectButton.svelte"

  export let openedFolders: any
  export let projects: any
  export let activeProject: string
  export let activeShow: any
  export let projectView: boolean

  export let name: string
  export let tree: any[]
  export let id: string
  export let opened = false
  $: {
    if (id !== "/") opened = openedFolders.includes(id)
  }
  const toggle = (e: any) => {
    if (!e.ctrlKey && !e.target.classList.contains("name") && !e.target.classList.contains("add")) {
      // console.log(1);
      // console.log(openedFolders.splice(openedFolders.indexOf(id), 1));
      console.log(id, opened)
      if (opened) {
        let spliced = openedFolders
        if (spliced.indexOf(id)) {
          spliced.splice(spliced.indexOf(id), 1)
          openedFolders.set(spliced)
        }
      } else openedFolders.set([...openedFolders, id])
      console.log(openedFolders)
      opened = !opened
    }
  }
</script>

<div class="surround">
  {#if id !== "/"}
    <button {id} class:opened class="folder context #rename__projects" on:click={toggle}>
      <span>
        <!-- {#if opened}
          <Icon id="folderOpen" />
        {:else}
          <Icon id="folder" />
        {/if} -->
        <!-- <HiddenInput value={name} /> -->
        <span>{name}</span>
      </span>
      <!-- <button class="add" on:click={() => history({ id: "newFolder", oldData: id })} title={$dictionary.new?._folder}>+</button> -->
    </button>
  {/if}

  {#if opened}
    <ul>
      {#each tree as project}
        {#if project.parent === id}
          <li>
            {#if project.type === "folder"}
              <svelte:self {tree} id={project.id} name={project.name} />
            {:else if project.id}
              <ProjectButton {projects} {activeProject} {activeShow} {projectView} name={project.name} parent={id} id={project.id} />
            {/if}
          </li>
        {/if}
      {/each}
    </ul>
  {/if}
</div>

<style>
  .surround {
    background-color: rgb(255 255 255 / 0.02);
  }

  .folder {
    display: flex;

    width: 100%;
    border: none;
    color: inherit;
    background-color: inherit;

    align-items: center;
    background-color: rgb(255 255 255 / 0.03);
    /* pointer-events: none; */
    font-size: 0.9em;
    /* cursor: pointer; */
    font-weight: bold;

    justify-content: space-between;
  }
  .folder:hover,
  .folder:active {
    background-color: rgb(255 255 255 / 0.06);
  }
  .folder :global(svg) {
    padding: 0 10px;
    box-sizing: content-box;
  }

  .folder span {
    /* padding: 0.3em; */
    display: flex;
    align-items: center;
    width: 100%;
  }

  /* .opened {
    background-color: var(--hover);
	} */

  ul {
    margin-left: 0.5em;
    list-style: none;
  }

  /* .add {
    background-color: inherit;
    border: none;
    padding: 0.2em 3px;
    color: rgb(255 255 255 / 0.1);
    font-size: 1.3em;
    cursor: pointer;
  } */
</style>
