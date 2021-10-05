<script>
  import { each, onMount } from "svelte/internal";
  import { writable } from "svelte/store";
  import { activeProject, activeShow, folders, projects, projectView, shows } from "../../stores";
  import Icon from "../helpers/Icon.svelte";
import Button from "../inputs/Button.svelte";
  import Folder from "../inputs/Folder.svelte";
  import Item from "../inputs/Item.svelte";
  import ShowItem from "../inputs/ShowItem.svelte";

  // if ($activeProject) showAll = false;

  // let containsProject;
  // activeProject.subscribe(ap => {
  //   containsProject = [[], $activeProject];
  //   if (ap !== null && $folders[$projects[ap].parent]) {
  //     containsProject[0].push($projects[ap].parent);
  //     let debug = 0;
  //     while ($folders[containsProject[0][containsProject[0].length - 1]].parent !== '/' || debug > 50) {
  //       debug++;
  //       containsProject[0].push($folders[containsProject[0][containsProject[0].length - 1]].parent);
  //     }
  //   }
  //   console.log(containsProject);
  // });

  let tree = [];
  Object.entries($folders).forEach(folder => {
    folder[1].id = folder[0];
    folder[1].type = 'folder';
    tree.push(folder[1]);
  });
  Object.entries($projects).forEach(project => {
    let p = {...project[1]};
    p.id = project[0];
    delete p.shows;
    tree.push(p);
  });
</script>

<svelte:window on:keydown={e => {
  if ($activeProject !== null) {
    if (e.key === 'ArrowDown' && $projects[$activeProject].shows.length) {
      let newShow = null;
      if ($activeShow) {
        let found = false;
        $projects[$activeProject].shows.forEach((show, i) => {
          if (show.id === $activeShow.id) {
            found = true;
            if ($projects[$activeProject].shows[i + 1]) newShow = i + 1;
          }
        });
        if (!found) newShow = 0;
      } else newShow = 0;
      if (newShow !== null) activeShow.set($projects[$activeProject].shows[newShow]);

    } else if (e.key === 'ArrowUp' && $projects[$activeProject].shows.length) {
      let newShow = null;
      if ($activeShow) {
        let found = false;
        $projects[$activeProject].shows.forEach((show, i) => {
          if (show.id === $activeShow.id) {
            if (!found && i - 1 >= 0) newShow = i - 1;
            found = true;
          }
        });
        if (!found) newShow = $projects[$activeProject].shows.length - 1;
      } else newShow = $projects[$activeProject].shows.length - 1;
      if (newShow !== null) activeShow.set($projects[$activeProject].shows[newShow]);
    }
  }
}} />



<div>
  <span class="top">
    <Button on:click={() => projectView.set(true)} active={$projectView}>
      <Icon name="home" />
    </Button>
    <Button on:click={() => projectView.set(false)} active={!$projectView} disabled={$activeProject === null}>
      <Icon name="file" />
    </Button>
    <!-- <button on:click={() => projectView.set(true)}>
      <Icon name="home" />
    </button>
    <button on:click={() => projectView.set(false)}>
      <Icon name="file" />
    </button> -->
    <!-- <button onClick={() => setProject(true)} style={{width: '50%', backgroundColor: (project ? 'transparent' : ''), color: (project ? 'var(--secondary)' : '')}}>Projects</button>
    <button onClick={() => setProject(false)} style={{width: '50%', backgroundColor: (project ? '' : 'transparent'), color: (project ? '' : 'var(--secondary)')}}>Timeline</button> -->
  </span>
  {#if $projectView && $activeProject !== null}
    <div class="list">
      <!-- All Projects: -->

      <Folder id="/" name="All Projects" {tree} opened />

      <!-- <button class="listItem" on:click={() => setFreeShow({...freeShow, project: i})} onDoubleClick={() => {setProject(false); setFreeShow({...freeShow, activeSong: projects[i].timeline[0].name})}}>{project.name}</button> -->
    </div>
  {:else}
    <div class="list">
      <!-- {/* WIP: live on double click?? */} -->
      {#each $projects[$activeProject].shows as show}
        <span class="listItem">
          <!-- + ($activeShow?.type === "show" && $activeShow?.id === show.id ? " active" : "")} on:click={() => activeShow.set(show)} -->
          {#if !show.type}
            <ShowItem {...show} name={$shows[show.id]?.show.name} category={[$shows[show.id]?.show.category, true]} />
          {:else}
            <ShowItem {...show} name={$shows[show.id]?.show.name + ' [' + show.type + ']'} category={[show.type, false]} />
          {/if}
        </span>
        <!-- <button class="listItem" type={show.type} on:click={() => setFreeShow({...freeShow, activeSong: obj.name})} onDoubleClick={() => setLive({type: obj.type, name: obj.name, slide: 0})}>{show.name}</button> -->
      {/each}
    </div>
  {/if}
</div>

<style>
  div {
    width: 300px;
    height: 100%;
  }

  .top {
    display: flex;
    /* width: 100%;
    justify-content: space-between; */
  }
  .top :global(button) {
    width: 50%;
  }

  .list {
    display: flex;
    flex-direction: column;
  }

  /* .allProjects :global(.listItem) {
    width: 100%;
    padding: 10px;
    font-size: .9em;
    text-align: left;
    background-color: var(--primary);
    color: var(--text);
    border: 0;
  }
  .allProjects :global(.listItem:hover) {
    background-color: var(--hover);
  }
  .allProjects :global(.listItem:focus), .allProjects :global(.listItem:active) {
    background-color: var(--focus);
  }
  .allProjects :global(.listItem.active) {
    background-color: var(--secondary);
  }

  .allProjects :global(.listItem.folder) {
    background-color: rgb(255 255 255 / .05);
    /* border: 2px solid var(--secondary); * /
    display: flex;
    flex-direction: column;
    padding: 5px;
  }
  .allProjects :global(.listItem.folder:hover) {
    /* background-color: var(--hover); * /
    background-color: rgb(255 255 255 / .08);
  }
  .allProjects :global(.listItem .text) {
    display: flex;
    align-items: center;
    pointer-events: none;
  }
  .allProjects :global(.listItem svg) {
    fill: var(--secondary);
    padding: 0 10px;
    /* height: 20px; * /
    width: auto;

    inline-size: 2ch;
    box-sizing: content-box;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2px;
  }
  .allProjects :global(.listItem p) {
    margin: 5px;
  }
  .allProjects :global(.listItem.folder .folderContent:not(.open)) {
    display: none;
  } */
</style>