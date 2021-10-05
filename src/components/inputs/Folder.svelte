<script>
  import Icon from "../helpers/Icon.svelte";
  import Item from "./Item.svelte";
  import { openedFolders } from "../../stores";
import HiddenInput from "./HiddenInput.svelte";

  export let name;
  export let tree;
  export let id;
  export let opened = $openedFolders.includes(id) ? true : false;

  const toggle = (e) => {
    if (!e.target.classList.contains('name')) {
      // console.log(1);
      // console.log($openedFolders.splice($openedFolders.indexOf(id), 1));
      console.log(id, opened);
      if (opened) {
        let spliced = $openedFolders;
        spliced.splice(spliced.indexOf(id), 1);
        openedFolders.set(spliced);
      }
      else openedFolders.set([...$openedFolders, id]);
      console.log($openedFolders);
      opened = !opened;
    }
  }
</script>

<div class="surround">

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

{#if opened}
	<ul>
		{#each tree as file}
    {#if file.parent === id}
        <li>
          {#if file.type === 'folder'}
            <svelte:self {tree} id={file.id} name={file.name} />
          {:else}
            <Item name={file.name} id={file.id} type={file.type} />
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
    background-color: rgb(255 255 255 / .02);
  }

	.folder {
    display: flex;
    align-items: center;
    background-color: rgb(255 255 255 / .03);
    /* pointer-events: none; */
    /* cursor: pointer; */
		font-weight: bold;
    
    justify-content: space-between;
	}
  .folder:hover, .folder:active {
    background-color: rgb(255 255 255 / .06);
  }
  .folder :global(svg) {
    padding: 0 10px;
    box-sizing: content-box;
  }

  .folder span {
    padding: .3em;
    display: flex;
    align-items: center;
    width: 100%;
  }

	/* .opened {
    background-color: var(--hover);
	} */

	ul {
		margin-left: .5em;
		list-style: none;
	}

  .add { /* , .addShow */
    justify-self: end;
    background-color: inherit;
    border: none;
    /* height: 100%; */
    font-size: inherit;
    padding: .6em 5px;
    color: transparent;
    cursor: pointer;
  }
  /* .addShow {
    color: inherit;
    text-align: center;
  } */
</style>