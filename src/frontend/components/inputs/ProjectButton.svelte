<script lang="ts">
    import type { ID } from "../../../types/Show"
    import { activeProject, activeShow, projects, projectView, showRecentlyUsedProjects } from "../../stores"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import HiddenInput from "./HiddenInput.svelte"

    export let name: string
    export let parent: ID
    export let id: ID
    export let recentlyUsed: boolean = false
    // export let type: ShowType
    // export let created;
    // export let parent; // path
    // $: type = name.slice(name.lastIndexOf(".") + 1)
    $: active = $activeProject === id

    function open(e: any) {
        if (e.ctrlKey || e.metaKey || e.target.closest(".edit") || e.target.querySelector(".edit") || editActive) return

        // set last used
        showRecentlyUsedProjects.set(false)
        projects.update((a) => {
            if (a[id]) a[id].used = Date.now()
            return a
        })

        projectView.set(false)

        let alreadyActive = $activeProject === id
        if (alreadyActive && !recentlyUsed) return

        activeProject.set(id)

        // select first if ALT key is NOT held down
        if (e.altKey || !$projects[id].shows.length) return

        activeShow.set({ ...$projects[id].shows[0], index: 0 })
    }

    function edit(e: any) {
        if (!editActive) history({ id: "UPDATE", newData: { key: "name", data: e.detail.value }, oldData: { id }, location: { page: "show", id: "project_key" } })
    }

    let editActive: boolean = false
</script>

<button on:click={open} data-parent={parent} class={recentlyUsed ? "" : "context #project_button__projects"} class:active>
    <Icon id="project" right />
    <HiddenInput value={name} id={"project_" + id} on:edit={edit} bind:edit={editActive} allowEdit={!recentlyUsed} />
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
