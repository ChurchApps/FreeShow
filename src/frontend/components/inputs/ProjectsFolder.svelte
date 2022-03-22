<script lang="ts">
  import Icon from "../helpers/Icon.svelte"
  import ProjectButton from "./ProjectButton.svelte"
  import { dictionary, openedFolders } from "../../stores"
  import HiddenInput from "./HiddenInput.svelte"
  import type { ID } from "../../../types/Show"
  import type { Tree } from "../../../types/Projects"
  import SelectElem from "../system/SelectElem.svelte"
  import { history } from "../helpers/history"

  export let name: string
  export let tree: Tree[]
  export let id: ID
  export let opened = false
  export let index: number
  $: {
    if (id !== "/") opened = $openedFolders.includes(id)
  }
  const toggle = (e: any) => {
    if (!e.ctrlKey && !e.metaKey && !e.target.classList.contains("name") && !e.target.classList.contains("add")) {
      // console.log(1);
      // console.log($openedFolders.splice($openedFolders.indexOf(id), 1));
      console.log(id, opened)
      if (opened) {
        let spliced = $openedFolders
        if (spliced.indexOf(id) > -1) {
          spliced.splice(spliced.indexOf(id), 1)
          openedFolders.set(spliced)
        }
      } else openedFolders.set([...$openedFolders, id])
      console.log($openedFolders)
      opened = !opened
    }
  }

  function edit(e: any) {
    history({ id: "updateProjectFolder", newData: { key: "name", value: e.detail.value }, location: { page: "show", folder: id } })
  }
</script>

<div class="surround">
  {#if id !== "/"}
    <button {id} class:opened class="folder context #rename__projects" on:click={toggle}>
      <span>
        {#if opened}
          <Icon id="folderOpen" />
        {:else}
          <Icon id="folder" />
        {/if}
        <HiddenInput value={name} id={"folder_" + id} on:edit={edit} />
      </span>
      <button class="add" on:click={() => history({ id: "newFolder", oldData: id })} title={$dictionary.new?._folder}>+</button>
    </button>
  {/if}

  {#if opened}
    <ul>
      {#each tree as project}
        {#if project.parent === id}
          <li>
            <SelectElem id="folder" data={{ type: project.type || "project", id: project.id, index: project.type === "folder" ? index : 0 }} draggable>
              {#if project.type === "folder"}
                <svelte:self {tree} id={project.id} name={project.name} index={index + 1} />
              {:else if project.id}
                <ProjectButton name={project.name} parent={id} id={project.id} />
              {/if}
            </SelectElem>
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

  .add {
    /* justify-self: end; */
    background-color: inherit;
    border: none;
    /* height: 100%; */
    /* font-size: inherit; */
    padding: 0.2em 3px;
    /* color: transparent; */
    color: rgb(255 255 255 / 0.1);
    font-size: 1.3em;
    cursor: pointer;
  }
</style>
