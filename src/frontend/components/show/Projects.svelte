<script lang="ts">
  import type { Tree } from "../../../types/Projects"
  import { activeProject, activeShow, dictionary, folders, projects, projectView } from "../../stores"
  import { GetProjects } from "../helpers/get"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import { loadShows } from "../helpers/setShow"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import ProjectsFolder from "../inputs/ProjectsFolder.svelte"
  import ShowButton from "../inputs/ShowButton.svelte"
  import Autoscroll from "../system/Autoscroll.svelte"
  import Center from "../system/Center.svelte"
  import DropArea from "../system/DropArea.svelte"
  import SelectElem from "../system/SelectElem.svelte"
  import ProjectTools from "./ProjectTools.svelte"

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
  $: {
    tree = []
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
  }

  function keydown(e: KeyboardEvent) {
    if (!e.target?.closest(".edit") && $activeProject !== null) {
      if (e.key.includes("Arrow")) e.preventDefault()
      let shows = GetProjects().active.shows // $projects[$activeProject].shows

      // TODO: duplicate of preview next / previousShow()
      if (shows.length && !e.ctrlKey) {
        let newIndex: null | number = null
        if (e.key === "ArrowDown") {
          // Arrow Down = change active show in project
          newIndex = 0
          if ($activeShow && $activeShow?.index !== null) newIndex = shows.findIndex((_s, i) => i - 1 === $activeShow!.index)
        } else if (e.key === "ArrowUp") {
          // Arrow Up = change active show in project
          newIndex = shows.length - 1
          if ($activeShow && $activeShow?.index !== null) newIndex = shows.findIndex((_s, i) => i + 1 === $activeShow!.index)
        }
        // Set active show in project list
        if (newIndex !== null && newIndex !== $activeShow?.index && newIndex >= 0 && newIndex < shows.length) activeShow.set({ ...shows[newIndex], index: newIndex })
      }
    }
  }

  // autoscroll
  let scrollElem: any
  let offset: number = -1
  $: {
    if (scrollElem && $activeShow?.index !== undefined)
      offset = scrollElem.querySelector(".ParentBlock").children[Math.max(0, $activeShow.index - 1)]?.offsetTop - scrollElem.offsetTop
  }

  let debug = 0
  $: {
    // get pos if clicked in drawer show
    let pos: null | number = $activeShow?.index || null
    if ($activeShow && $activeProject) {
      let i = $projects[$activeProject].shows.findIndex((p) => p.id === $activeShow?.id)
      if (i > -1) pos = i

      if (($activeShow?.type === "video" || $activeShow?.type === "image") && pos !== null && $activeShow.index !== pos && debug < 50) {
        debug++
        activeShow.update((a) => {
          a!.index = pos!
          return a
        })
      }
    }
  }

  activeProject.subscribe((a) => {
    if (!a) projectView.set(true)
    else {
      console.log("GET SHOW CACHE 2")
      loadShows($projects[a].shows.filter((a) => a.type === undefined || a.type === "show").map((a) => a.id))
      // TODO: CHECK VIDEOS
    }
  })

  // function newShow(isPrivate: boolean = false) {
  //   let id: any = "newShow"
  //   if (isPrivate) id = "newPrivateShow"
  //   // , newData: { project: $activeProject, type: "private" }
  //   history({ id, location: { page: "show", project: $activeProject! } })
  // }
</script>

<svelte:window on:keydown={keydown} />

<div class="main">
  <span class="tabs">
    <!-- TODO: set different project system folders.... -->
    <!-- TODO: right click change... -->
    <Button style="flex: 1" on:click={() => projectView.set(true)} active={$projectView} center dark title={"Projects"}>
      <Icon id="folder" />
    </Button>
    <!-- TODO: right click go to recent -->
    <Button
      style="flex: 5;"
      on:click={() => projectView.set(false)}
      class="context #projectTab _close"
      active={!$projectView}
      dark
      center
      disabled={$activeProject === null}
      title={$activeProject ? "Project: " + $projects[$activeProject].name : null}
    >
      <Icon id="project" style="padding-right: 10px;" />
      <p style="color: white; overflow: hidden;">{$activeProject ? $projects[$activeProject].name : ""}</p>
    </Button>
    <!-- <button onClick={() => setProject(true)} style={{width: '50%', backgroundColor: (project ? 'transparent' : ''), color: (project ? 'var(--secondary)' : '')}}>Projects</button>
    <button onClick={() => setProject(false)} style={{width: '50%', backgroundColor: (project ? '' : 'transparent'), color: (project ? '' : 'var(--secondary)')}}>Timeline</button> -->
  </span>
  {#if $projectView}
    <div class="list context #projects" id="/">
      <DropArea id="projects">
        <!-- All Projects: -->

        <ProjectsFolder id="/" name="All Projects" {tree} opened index={1} />

        <!-- <button class="listItem" on:click={() => setFreeShow({...freeShow, project: i})} onDoubleClick={() => {setProject(false); setFreeShow({...freeShow, activeSong: projects[i].timeline[0].name})}}>{project.name}</button> -->
      </DropArea>
    </div>
    <div class="tabs">
      <Button on:click={() => history({ id: "newFolder" })} center title={$dictionary.new?.folder}>
        <Icon id="folder" />
      </Button>
      <Button on:click={() => history({ id: "newProject" })} center title={$dictionary.new?.project}>
        <Icon id="project" />
      </Button>
    </div>
  {:else if $activeProject !== null}
    <div class="list context #project">
      <Autoscroll {offset} bind:scrollElem>
        <DropArea id="project" selectChildren let:fileOver file>
          <!-- {/* WIP: live on double click?? */} -->
          {#if $projects[$activeProject].shows.length}
            {#each $projects[$activeProject].shows as show, index}
              <!-- + ($activeShow?.type === "show" && $activeShow?.id === show.id ? " active" : "")} on:click={() => activeShow.set(show)} -->
              <!-- <ShowButton {...show} name={$shows[show.id]?.name} category={[$shows[show.id]?.category, true]} /> -->
              <SelectElem id="show" data={{ id: show.id, index }} {fileOver} borders="edges" trigger="column" draggable>
                <ShowButton id={show.id} {show} {index} class="context #{show.type ? '' : 'show'}__project" icon />
              </SelectElem>
              <!-- <button class="listItem" type={show.type} on:click={() => setFreeShow({...freeShow, activeSong: obj.name})} onDoubleClick={() => setLive({type: obj.type, name: obj.name, slide: 0})}>{show.name}</button> -->
            {/each}
          {:else}
            <Center faded>
              <T id="empty.show" />
            </Center>
          {/if}
        </DropArea>
      </Autoscroll>
    </div>
    <!-- <div class="tabs">
      <Button on:click={() => newShow()} center title={$dictionary.new?.show}>
        <Icon id="showIcon" />
      </Button>
      <Button on:click={() => newShow(true)} center title={$dictionary.new?.private}>
        <Icon id="private" />
      </Button>
    </div> -->
  {:else}
    <Center faded>
      <T id="empty.project_select" />
    </Center>
  {/if}
</div>
{#if $activeProject && !$projectView}
  <ProjectTools />
{/if}

<style>
  .main {
    /* max-height: 50%; */
    /* width: 100%; */
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
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
    position: relative;
    display: flex;
    flex-direction: column;
    /* overflow-y: auto;
    overflow-x: hidden; */
    overflow: hidden;
    height: 100%;
  }
</style>
