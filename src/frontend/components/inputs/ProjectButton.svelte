<script lang="ts">
    import { uid } from "uid"
    import type { ID } from "../../../types/Show"
    import { activeEdit, activeProject, activeRename, activeShow, dictionary, projects, projectTemplates, projectView, saved, showRecentlyUsedProjects } from "../../stores"
    import { clone } from "../helpers/array"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import HiddenInput from "./HiddenInput.svelte"
    import { getProjectName } from "../helpers/historyHelpers"

    export let name: string
    export let parent: ID
    export let id: ID
    export let recentlyUsed: boolean = false
    export let template: boolean = false
    // export let type: ShowType
    // export let created;
    // export let parent; // path
    // $: type = name.slice(name.lastIndexOf(".") + 1)
    $: active = $activeProject === id

    function open(e: any) {
        // prevent extra single click on (template) double click
        let doubleClick = e.detail === 2

        if (e.target.closest(".edit") || e.target.querySelector(".edit") || editActive || doubleClick) return

        if (template) {
            let project = clone($projectTemplates[id])
            if (!project) return

            project.parent = $projects[$activeProject || ""]?.parent || "/"
            if (e.ctrlKey || e.metaKey) project.name = getProjectName() // use default project name
            let projectId = uid()
            history({ id: "UPDATE", newData: { data: project }, oldData: { id: projectId }, location: { page: "show", id: "project" } })
            setTimeout(() => activeRename.set("project_" + projectId))
            return
        }

        if (e.ctrlKey || e.metaKey) return

        // set back to saved if opening, as project used time is changed
        if ($saved) setTimeout(() => saved.set(true), 10)

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
        if (e.altKey || !$projects[id]?.shows?.length) return

        let showRef = $projects[id].shows[0]
        if (!showRef) return

        activeShow.set({ ...showRef, index: 0 })

        let type = showRef.type
        // same as ShowButton
        if (type === "image" || type === "video") activeEdit.set({ id: showRef.id, type: "media", items: [] })
        else if ($activeEdit.id) activeEdit.set({ type: "show", slide: 0, items: [], showId: showRef.id })
    }

    function dblclick() {
        if (!template) return

        // open selected project
        projectView.set(false)
    }

    function edit(e: any) {
        if (editActive) return

        if (template) history({ id: "UPDATE", newData: { key: "name", data: e.detail.value }, oldData: { id }, location: { page: "show", id: "project_template" } })
        else history({ id: "UPDATE", newData: { key: "name", data: e.detail.value }, oldData: { id }, location: { page: "show", id: "project_key" } })
    }

    let editActive: boolean = false
</script>

<button {id} on:click={open} on:dblclick={dblclick} data-parent={parent} class={recentlyUsed ? "" : `context #project_${template ? "template" : "button__projects"}`} title={template ? $dictionary.actions?.project_template_tip : ""} class:active>
    <Icon id={template ? "templates" : "project"} right />
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
