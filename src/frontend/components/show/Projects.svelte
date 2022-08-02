<script lang="ts">
  import type { Tree } from "../../../types/Projects"
  import { activeProject, activeShow, dictionary, folders, projects, projectView } from "../../stores"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import { loadShows } from "../helpers/setShow"
  import { checkInput } from "../helpers/showActions"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  // import ProjectsFolder from "../inputs/ProjectsFolder.svelte"
  import ShowButton from "../inputs/ShowButton.svelte"
  import { autoscroll } from "../system/autoscroll"
  import Autoscroll from "../system/Autoscroll.svelte"
  import Center from "../system/Center.svelte"
  import DropArea from "../system/DropArea.svelte"
  import SelectElem from "../system/SelectElem.svelte"
  import ProjectList from "./ProjectList.svelte"
  import ProjectTools from "./ProjectTools.svelte"

  let tree: Tree[] = []
  $: f = Object.entries($folders).map(([id, folder]) => ({ ...folder, id, type: "folder" as "folder" }))
  $: p = Object.entries($projects).map(([id, project]) => ({ ...project, id, shows: [] as any }))
  $: {
    tree = [...f.sort((a, b) => a.name?.localeCompare(b.name)), ...p.sort((a, b) => a.name?.localeCompare(b.name))]

    folderSorted = []
    sortFolders()
    console.log(folderSorted)
    tree = folderSorted
  }

  let folderSorted: Tree[] = []
  function sortFolders(parent: string = "/", index: number = 0, path: string = "") {
    let filtered = tree.filter((a: any) => a.parent === parent).map((a) => ({ ...a, index, path }))
    filtered.forEach((folder) => {
      folderSorted.push(folder)
      if (folder.type === "folder") {
        sortFolders(folder.id, index + 1, path + folder.id + "/")
      }
    })
  }

  // autoscroll
  let scrollElem: any
  let offset: number = -1
  $: offset = autoscroll(scrollElem, ($activeShow?.index || 1) - 1)

  $: {
    // get pos if clicked in drawer
    if ($activeProject && $activeShow?.index !== undefined && $projects[$activeProject!].shows[$activeShow.index]?.id !== $activeShow?.id) findShowInProject()
  }

  function findShowInProject() {
    let i = $projects[$activeProject!].shows.findIndex((p) => p.id === $activeShow?.id)
    let pos: number = i > -1 ? i : $activeShow?.index || -1

    // ($activeShow?.type !== "video" && $activeShow?.type !== "image")
    if (pos < 0 || $activeShow?.index === pos) return

    activeShow.update((a) => {
      a!.index = pos
      return a
    })
  }

  activeProject.subscribe(loadProjectShows)
  function loadProjectShows(a: null | string) {
    if (!a || !$projects[a]) {
      activeProject.set(null)
      projectView.set(true)
      return
    }

    loadShows($projects[a].shows.filter((a) => a.type === undefined || a.type === "show").map((a) => a.id))
    // TODO: CHECK VIDEOS
  }
</script>

<svelte:window on:keydown={checkInput} />

<div class="main">
  <span class="tabs">
    <!-- TODO: set different project system folders.... -->
    <!-- TODO: right click change... -->
    <Button style="flex: 1" on:click={() => projectView.set(true)} active={$projectView} center dark title={$dictionary.remote?.projects}>
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
      title={$activeProject ? $dictionary.remote?.project + ": " + $projects[$activeProject]?.name : ""}
    >
      <Icon id="project" style="padding-right: 10px;" />
      <p style="color: white; overflow: hidden;">{$activeProject ? $projects[$activeProject]?.name : ""}</p>
    </Button>
    <!-- <button onClick={() => setProject(true)} style={{width: '50%', backgroundColor: (project ? 'transparent' : ''), color: (project ? 'var(--secondary)' : '')}}>Projects</button>
    <button onClick={() => setProject(false)} style={{width: '50%', backgroundColor: (project ? '' : 'transparent'), color: (project ? '' : 'var(--secondary)')}}>Timeline</button> -->
  </span>
  {#if $projectView}
    <div class="list context #projects" style="overflow: auto;">
      <DropArea id="projects">
        <ProjectList {tree} />
        <!-- <ProjectsFolder id="/" name="All Projects" {tree} opened index={0} /> -->
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
          {#if $projects[$activeProject]?.shows.length}
            {#each $projects[$activeProject]?.shows as show, index}
              <!-- + ($activeShow?.type === "show" && $activeShow?.id === show.id ? " active" : "")} on:click={() => activeShow.set(show)} -->
              <!-- <ShowButton {...show} name={$shows[show.id]?.name} category={[$shows[show.id]?.category, true]} /> -->
              <SelectElem id="show" data={{ id: show.id, index, type: show.type }} {fileOver} borders="edges" trigger="column" draggable>
                <ShowButton
                  id={show.id}
                  {show}
                  {index}
                  class="context #project_{show.type ? (show.type === 'video' || show.type === 'image' ? 'media' : show.type) : 'show'}__project"
                  icon
                />
              </SelectElem>
              <!-- <button class="listItem" type={show.type} on:click={() => setFreeShow({...freeShow, activeSong: obj.name})} onDoubleClick={() => setLive({type: obj.type, name: obj.name, slide: 0})}>{show.name}</button> -->
            {/each}
          {:else}
            <Center faded>
              <T id="empty.shows" />
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
