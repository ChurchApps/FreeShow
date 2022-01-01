<script lang="ts">
  import type { Tree } from "../../../types/Projects"
  // import Icon from "../helpers/Icon.svelte"
  import Button from "./Button.svelte"
  import ProjectsFolder from "./ProjectsFolder.svelte"
  import ShowButton from "./ShowButton.svelte"
  import Center from "./Center.svelte"

  let projectView = false
  let openedFolders: any = {}
  // export let categories = {}

  export let shows: any
  export let folders: any
  export let projects: any
  export let activeProject: any
  export let activeShow: any

  let tree: Tree[] = [] // TODO: Folder...
  $: {
    tree = []
    Object.entries(folders).forEach((folder: any) => {
      folder[1].id = folder[0]
      folder[1].type = "folder"
      tree.push(folder[1])
    })
    Object.entries(projects).forEach((project: any) => {
      let p = { ...project[1] }
      p.id = project[0]
      p.shows = []
      tree.push(p)
    })
  }

  function keyDown(e: any) {
    if (!e.target?.closest(".edit") && activeProject !== null) {
      // let shows = GetProjects().active.shows // projects[activeProject].shows
      let shows = projects[activeProject]?.shows || []

      // TODO: duplicate of preview next / previousShow()
      if (shows.length) {
        let newIndex: null | number = null
        if (e.key === "ArrowDown") {
          // Arrow Down = change active show in project
          newIndex = 0
          if (activeShow && activeShow?.index !== null) newIndex = shows.findIndex((_s: any, i: number) => i - 1 === activeShow!.index)
        } else if (e.key === "ArrowUp") {
          // Arrow Up = change active show in project
          newIndex = shows.length - 1
          if (activeShow && activeShow?.index !== null) newIndex = shows.findIndex((_s: any, i: number) => i + 1 === activeShow!.index)
        }
        // Set active show in project list
        if (newIndex !== null && newIndex !== activeShow?.index && newIndex >= 0 && newIndex < shows.length) activeShow.set({ ...shows[newIndex], index: newIndex })
      }
    }
  }
</script>

<svelte:window on:keydown={keyDown} />

<div class="main">
  <span class="tabs">
    <Button style="flex: 1" on:click={() => (projectView = true)} active={projectView} center title={"Projects"}>
      <!-- <Icon id="home" /> -->
    </Button>
    <!-- TODO: right click go to recent -->
    <Button
      style="flex: 5;"
      on:click={() => (projectView = false)}
      active={!projectView}
      center
      disabled={activeProject === null}
      title={activeProject ? "Project: " + projects[activeProject]?.name : null}
    >
      <!-- <Icon id="project" style="padding-right: 10px;" /> -->
      <p style="color: white; overflow: hidden;">{activeProject ? projects[activeProject]?.name : ""}</p>
    </Button>
    <!-- <button onClick={() => setProject(true)} style={{width: '50%', backgroundColor: (project ? 'transparent' : ''), color: (project ? 'var(--secondary)' : '')}}>Projects</button>
    <button onClick={() => setProject(false)} style={{width: '50%', backgroundColor: (project ? '' : 'transparent'), color: (project ? '' : 'var(--secondary)')}}>Timeline</button> -->
  </span>
  {#if projectView}
    <div class="list context #projects" id="/">
      <ProjectsFolder {projects} {activeProject} {activeShow} {projectView} {openedFolders} id="/" name="All Projects" {tree} opened />
    </div>
    <!-- <div class="tabs">
      <Button on:click={() => history({ id: "newProject" })} center title={$dictionary.new?.project}>
        <Icon id="project" />
      </Button>
      <Button on:click={() => history({ id: "newFolder" })} center title={$dictionary.new?._folder}>
        <Icon id="folder" />
      </Button>
    </div> -->
  {:else if activeProject !== null}
    <div class="list context #project">
      {#if projects[activeProject]?.shows.length}
        {#each projects[activeProject]?.shows as show, index}
          <ShowButton
            {activeShow}
            {activeProject}
            {projects}
            id={show.id}
            {index}
            type={show.type}
            name={shows[show.id]?.name}
            icon={shows[show.id]?.private ? "private" : show.type ? show.type : "noIcon"}
            class="context #{show.type ? '' : 'show'}__project"
          />
          <!-- icon={shows[show.id]?.private ? "private" : show.type ? show.type : shows[show.id]?.category ? $categories[shows[show.id].category || ""].icon : "noIcon"} -->
        {/each}
      {:else}
        <Center faded>[[[No shows]]]</Center>
      {/if}
    </div>
    <!-- <div class="tabs">
      <Button on:click={() => history({ id: "newShow", newData: { project: activeProject } })} center title={$dictionary.new?.show}>
        <Icon id="showIcon" />
      </Button>
      <Button on:click={() => history({ id: "newPrivateShow", newData: { project: activeProject, type: "private" } })} center title={$dictionary.new?._private}>
        <Icon id="private" />
      </Button>
    </div> -->
  {:else}
    <Center faded>[[[Select a project]]]</Center>
  {/if}
</div>

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
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex: 1;
  }
</style>
