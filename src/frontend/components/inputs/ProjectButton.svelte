<script lang="ts">
    import type { ID } from "../../../types/Show"
    import { activeProject, activeShow, projects, projectView } from "../../stores"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import HiddenInput from "./HiddenInput.svelte"

    export let name: string
    export let parent: ID
    export let id: ID
    // export let type: ShowType
    // export let created;
    // export let parent; // path
    // $: type = name.slice(name.lastIndexOf(".") + 1)
    $: active = $activeProject === id

    function open(e: any) {
        if (e.target.closest(".edit") || e.target.querySelector(".edit") || editActive) return

        // set new project
        activeProject.set(id)

        projectView.set(false)
        if ($projects[id].shows.length) activeShow.set({ ...$projects[id].shows[0], index: 0 })
    }

    // WIP select with context menu
    // function select(e: any) {
    //     if (e.target.closest(".edit")) return

    //     // set new project
    //     activeProject.set(id)

    //     // if ($activeProject) loadShows($projects[$activeProject].shows.map((a) => ({ id: a.id })))

    //     // get active show pos
    //     if ($activeShow !== null) {
    //         let pos: number = -1
    //         if ($activeProject) pos = $projects[$activeProject].shows.findIndex((p) => p.id === $activeShow!.id && (!p.layout || $showsCache[$activeShow!.id].settings.activeLayout === p.layout))
    //         console.log(pos)

    //         activeShow.update((as: any) => {
    //             as.index = pos >= 0 ? pos : null
    //             return as
    //         })
    //     }
    // }

    function edit(e: any) {
        if (!editActive) history({ id: "UPDATE", newData: { key: "name", data: e.detail.value }, oldData: { id }, location: { page: "show", id: "project_key" } })
    }

    let editActive: boolean = false
</script>

<button on:click={open} data-parent={parent} class="context #project_button__projects" class:active>
    <Icon id="project" right />
    <HiddenInput value={name} id={"project_" + id} on:edit={edit} bind:edit={editActive} />
</button>

<style>
    button {
        width: 100%;
        /* padding: 0.2em 0.8em; */
        padding: 0.1em 0.8em;
        font-size: 0.9em;
        /* border: 2px solid var(--secondary); */
        border: 0;
        background-color: inherit;
        color: var(--text);

        display: flex;
        align-items: center;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    button:hover,
    button:active {
        background-color: rgb(255 255 255 / 0.06);
    }
    button.active {
        background-color: var(--primary-darker);
        outline-offset: -2px;
        outline: 2px solid var(--primary-lighter);
    }
</style>
