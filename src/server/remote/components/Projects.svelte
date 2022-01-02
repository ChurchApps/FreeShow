<script lang="ts">
  import type { Tree } from "../../../types/Projects"
  import ProjectsFolder from "./ProjectsFolder.svelte"

  // export let categories = {}

  export let folders: any
  export let openedFolders: any
  export let projects: any
  export let activeProject: any
  // export let activeShow: any
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
  console.log(tree)

  // function keyDown(e: any) {
  //   if (!e.target?.closest(".edit") && activeProject !== null) {
  //     // let shows = GetProjects().active.shows // projects[activeProject].shows
  //     let shows = projects[activeProject]?.shows || []

  //     // TODO: duplicate of preview next / previousShow()
  //     if (shows.length) {
  //       let newIndex: null | number = null
  //       if (e.key === "ArrowDown") {
  //         // Arrow Down = change active show in project
  //         newIndex = 0
  //         if (activeShow && activeShow?.index !== null) newIndex = shows.findIndex((_s: any, i: number) => i - 1 === activeShow!.index)
  //       } else if (e.key === "ArrowUp") {
  //         // Arrow Up = change active show in project
  //         newIndex = shows.length - 1
  //         if (activeShow && activeShow?.index !== null) newIndex = shows.findIndex((_s: any, i: number) => i + 1 === activeShow!.index)
  //       }
  //       // Set active show in project list
  //       if (newIndex !== null && newIndex !== activeShow?.index && newIndex >= 0 && newIndex < shows.length) activeShow.set({ ...shows[newIndex], index: newIndex })
  //     }
  //   }
  // }
</script>

<!-- <svelte:window on:keydown={keyDown} /> -->

<div class="main">
  <div class="list context #projects" id="/">
    <ProjectsFolder {projects} {activeProject} {activeShow} {openedFolders} id="/" name="All Projects" {tree} opened />
  </div>
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

  .list {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    flex: 1;
  }
</style>
