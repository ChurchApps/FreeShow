<script lang="ts">
    import { openedFolders } from "../../stores"
    import { history } from "../helpers/history"

    import Icon from "../helpers/Icon.svelte"
    import HiddenInput from "./HiddenInput.svelte"

    export let project: any
    export let opened: boolean
    export let readOnly: boolean = false

    let editActive = false

    const toggle = (e: any, project: any, opened: boolean) => {
        if (editActive || e.ctrlKey || e.metaKey || e.target.classList.contains("name") || e.target.classList.contains("add")) return

        if (opened) {
            let spliced = $openedFolders
            if (spliced.indexOf(project.id) > -1) {
                spliced.splice(spliced.indexOf(project.id), 1)
                openedFolders.set(spliced)
            }
        } else if (!$openedFolders.includes(project.id)) {
            openedFolders.set([...$openedFolders, project.id])
        }

        opened = !opened
    }

    function edit(e: any, id: string) {
        history({ id: "UPDATE", newData: { key: "name", data: e.detail.value }, oldData: { id }, location: { page: "show", id: "project_folder_key" } })
    }
</script>

<button id={project.id} class:opened class="folder {readOnly ? 'context #folder_readonly' : 'context #folder__projects'}" on:click={(e) => toggle(e, project, opened)}>
    <span>
        {#if opened}
            <Icon id="folderOpen" right white />
        {:else}
            <Icon id="folder" right white />
        {/if}
        <HiddenInput value={project.name} id={"folder_" + project.id} on:edit={(e) => edit(e, project.id || "")} bind:edit={editActive} allowEdit={!readOnly} />
    </span>
</button>

<style>
    .folder {
        display: flex;

        width: 100%;
        border: none;
        color: inherit;
        background-color: inherit;

        align-items: center;
        background-color: inherit;
        /* pointer-events: none; */
        font-size: 0.9em;
        /* cursor: pointer; */
        padding: 0.2em 0.8em;
        font-weight: 600;

        justify-content: space-between;
    }
    .folder:hover,
    .folder:active {
        background-color: rgb(255 255 255 / 0.06);
    }

    .folder span {
        display: flex;
        align-items: center;
        width: 100%;
    }
</style>
