<script lang="ts">
  import type { Tree } from "../../../types/Projects"

  import { activeProject, activeShow, folders, projects, projectView, shows } from "../../stores"
  import { GetProjects } from "../helpers/get"
  import Icon from "../helpers/Icon.svelte"
  import Button from "../inputs/Button.svelte"
  import ProjectsFolder from "../inputs/ProjectsFolder.svelte"
  import ShowButton from "../inputs/ShowButton.svelte"

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

  let tree: Tree[] = [] // TODO: Folder...
  Object.entries($folders).forEach((folder) => {
    folder[1].id = folder[0]
    folder[1].type = "folder"
    tree.push(folder[1])
  })
  Object.entries($projects).forEach((project) => {
    let p = { ...project[1] }
    p.id = project[0]
    p.shows = []
    tree.push(p)
  })

  function keyDown(e: KeyboardEvent) {
    if ($activeProject !== null) {
      let shows = GetProjects().active.shows // $projects[$activeProject].shows

      if (shows.length) {
        let newShow: null | number = null
        if (e.key === "ArrowDown") {
          // Arrow Down = change active show in project
          if ($activeShow !== null) {
            // REMOVE let found = false
            shows.forEach((show, i) => {
              if (show.id === $activeShow!.id) {
                // found = true
                if (shows[i + 1]) newShow = i + 1
              }
            })
            // if (!found) newShow = 0
          } else newShow = 0
        } else if (e.key === "ArrowUp") {
          // Arrow Up = change active show in project
          if ($activeShow !== null) {
            // let found = false
            shows.forEach((show, i) => {
              if (show.id === $activeShow!.id && newShow === null) {
                if (i - 1 >= 0) newShow = i - 1
                else newShow = 0
                // if (!found && i - 1 >= 0) newShow = i - 1
                // found = true
              }
            })
            // if (!found) newShow = shows.length - 1
          } else newShow = shows.length - 1
        }
        // Set active show in project list
        if (newShow !== null) activeShow.set(shows[newShow])
      }
    }
  }
</script>

<svelte:window on:keydown={keyDown} />

<div class="main">
  <span class="tabs">
    <!-- TODO: set different project system folders.... -->
    <!-- TODO: right click change... -->
    <Button on:click={() => projectView.set(true)} active={$projectView}>
      <Icon id="home" />
    </Button>
    <!-- TODO: right click go to recent -->
    <Button on:click={() => projectView.set(false)} active={!$projectView} disabled={$activeProject === null} title={$activeProject ? $projects[$activeProject].name : null}>
      <Icon id="file" />
      <p style="color: white; overflow: hidden;">{$activeProject ? $projects[$activeProject].name : ""}</p>
    </Button>
    <!-- <button on:click={() => projectView.set(true)}>
      <Icon id="home" />
    </button>
    <button on:click={() => projectView.set(false)}>
      <Icon id="file" />
    </button> -->
    <!-- <button onClick={() => setProject(true)} style={{width: '50%', backgroundColor: (project ? 'transparent' : ''), color: (project ? 'var(--secondary)' : '')}}>Projects</button>
    <button onClick={() => setProject(false)} style={{width: '50%', backgroundColor: (project ? '' : 'transparent'), color: (project ? '' : 'var(--secondary)')}}>Timeline</button> -->
  </span>
  {#if $projectView && $activeProject !== null}
    <div class="list">
      <!-- All Projects: -->

      <ProjectsFolder id="/" name="All Projects" {tree} opened />

      <!-- <button class="listItem" on:click={() => setFreeShow({...freeShow, project: i})} onDoubleClick={() => {setProject(false); setFreeShow({...freeShow, activeSong: projects[i].timeline[0].name})}}>{project.name}</button> -->
    </div>
  {:else if $activeProject !== null}
    <div class="list">
      <!-- {/* WIP: live on double click?? */} -->
      {#each $projects[$activeProject].shows as show}
        <span class="listItem">
          <!-- + ($activeShow?.type === "show" && $activeShow?.id === show.id ? " active" : "")} on:click={() => activeShow.set(show)} -->
          {#if !show.type}
            <!-- <ShowButton {...show} name={$shows[show.id]?.name} category={[$shows[show.id]?.category, true]} /> -->
            <ShowButton id={show.id} type={show.type} name={$shows[show.id]?.name} icon={$shows[show.id]?.category || "unknown"} />
          {:else}
            <ShowButton id={show.id} type={show.type} name={$shows[show.id]?.name + " [" + show.type + "]"} icon={show.type} />
          {/if}
        </span>
        <!-- <button class="listItem" type={show.type} on:click={() => setFreeShow({...freeShow, activeSong: obj.name})} onDoubleClick={() => setLive({type: obj.type, name: obj.name, slide: 0})}>{show.name}</button> -->
      {/each}
    </div>
  {/if}
</div>

<style>
  .main {
    max-height: 50%;
    /* width: 100%; */
    display: flex;
    flex-direction: column;
    flex: 1;
    border-bottom: 3px solid var(--secondary);
  }

  .tabs {
    display: flex;
    background-color: var(--primary-darker);
    /* width: 100%;
    justify-content: space-between; */
  }
  .tabs :global(button) {
    width: 50%;
  }

  .list {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
</style>
