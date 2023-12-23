<script lang="ts">
    import type { Tree } from "../../../types/Projects"
    import ProjectsFolder from "./ProjectsFolder.svelte"

    export let folders: any
    export let openedFolders: any
    export let projects: any
    export let activeProject: any
    export let activeShow: any

    // WIP: folders
    let tree: Tree[] = []
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
</script>

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
