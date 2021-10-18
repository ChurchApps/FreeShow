<script lang="ts">
  import Icon from "../helpers/Icon.svelte"
  import ProjectButton from "./ProjectButton.svelte"
  import { openedFolders } from "../../stores"
  import HiddenInput from "./HiddenInput.svelte"
  import type { ID } from "../../../types/Show"
  import type { Tree } from "../../../types/Projects"

  export let name: string
  export let tree: Tree[]
  export let id: ID
  export let opened = $openedFolders.includes(id) ? true : false
  const toggle = (e: MouseEvent) => {
    if (!e.target.classList.contains("name")) {
      // console.log(1);
      // console.log($openedFolders.splice($openedFolders.indexOf(id), 1));
      console.log(id, opened)
      if (opened) {
        let spliced = $openedFolders
        if (spliced.indexOf(id)) {
          spliced.splice(spliced.indexOf(id), 1)
          openedFolders.set(spliced)
        }
      } else openedFolders.set([...$openedFolders, id])
      console.log($openedFolders)
      opened = !opened
    }
  }
</script>

<div class="surround">
  {#if id !== "/"}
    <span {id} class:opened class="folder" on:click={toggle}>
      <span>
        {#if opened}
          <Icon name="folder_open" />
        {:else}
          <Icon name="folder" />
        {/if}
        <HiddenInput value={name} />
      </span>
      <button class="add">+</button>
    </span>
  {/if}

  {#if opened}
    <ul>
      {#each tree as file}
        {#if file.parent === id}
          <li>
            {#if file.type === "folder"}
              <svelte:self {tree} id={file.id} name={file.name} />
            {:else}
              <ProjectButton name={file.name} id={file.id} />
            {/if}
          </li>
        {/if}
      {/each}
    </ul>

    <!-- <div class="addShow">+</div> -->
  {/if}
</div>

<style>
  .surround {
    background-color: rgb(255 255 255 / 0.02);
  }

  .folder {
    display: flex;
    align-items: center;
    background-color: rgb(255 255 255 / 0.03);
    /* pointer-events: none; */
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
    padding: 0.3em;
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
    /* , .addShow */
    justify-self: end;
    background-color: inherit;
    border: none;
    /* height: 100%; */
    font-size: inherit;
    padding: 0.6em 5px;
    color: transparent;
    cursor: pointer;
  }
  /* .addShow {
    color: inherit;
    text-align: center;
  } */
</style>
