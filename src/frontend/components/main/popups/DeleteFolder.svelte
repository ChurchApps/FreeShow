<script lang="ts">
    // Popup component for confirming folder deletion
    // Allows user to choose between deleting only the folder (moving projects to parent)
    // or deleting the folder and all projects inside it
    import { activePopup, folders, popupData, projects } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    // Get the folder IDs being deleted from popup data
    $: folderIds = $popupData.folderIds || []

    // Count total projects that will be deleted (including nested folders)
    $: projectCount = countProjectsInFolders(folderIds)

    /**
     * Recursively counts all projects inside the given folders and their subfolders
     * @param ids - Array of folder IDs to count projects in
     * @returns Total number of projects found
     */
    function countProjectsInFolders(ids: string[]): number {
        let count = 0
        const foldersToCheck = [...ids]

        while (foldersToCheck.length > 0) {
            const folderId = foldersToCheck.pop()!

            // Count projects in this folder
            Object.values($projects).forEach((project: any) => {
                if (project.parent === folderId) count++
            })

            // Find subfolders and add them to the list
            Object.entries($folders).forEach(([id, folder]: [string, any]) => {
                if (folder.parent === folderId) foldersToCheck.push(id)
            })
        }

        return count
    }

    /**
     * Handle delete folder only - keeps current behavior (projects move to parent)
     */
    function deleteFolderOnly() {
        popupData.set({ ...$popupData, id: "delete_folder", value: "folder_only" })
    }

    /**
     * Handle delete folder and all projects inside
     */
    function deleteFolderAndProjects() {
        popupData.set({ ...$popupData, id: "delete_folder", value: "folder_and_projects" })
    }

    /**
     * Cancel the deletion
     */
    function cancel() {
        popupData.set({})
        activePopup.set(null)
    }
</script>

<!-- Popup content for delete folder confirmation -->
<p class="description"><T id="popup.delete_folder_content" /></p>

{#if projectCount > 0}
    <p class="count">{projectCount} project{projectCount !== 1 ? "s" : ""}</p>
{/if}

<div class="buttons">
    <!-- Delete folder only button - moves projects to parent folder -->
    <MaterialButton style="flex: 1;" on:click={deleteFolderOnly}>
        <Icon id="folder" size={1.1} white />
        <div class="button-content">
            <span class="button-title"><T id="popup.delete_folder_only" /></span>
            <span class="button-description"><T id="popup.delete_folder_only_description" /></span>
        </div>
    </MaterialButton>

    <!-- Delete folder and all projects button -->
    <MaterialButton style="flex: 1;" on:click={deleteFolderAndProjects}>
        <Icon id="delete" style="fill: #ff5454;" size={1.1} white />
        <div class="button-content">
            <span class="button-title"><T id="popup.delete_folder_all" /></span>
            <span class="button-description"><T id="popup.delete_folder_all_description" /></span>
        </div>
    </MaterialButton>
</div>

<!-- Cancel button -->
<MaterialButton style="margin-top: 15px;" on:click={cancel}>
    <Icon id="close" size={1.1} white />
    <T id="popup.cancel" />
</MaterialButton>

<style>
    .description {
        margin-bottom: 10px;
        white-space: initial;
    }

    .count {
        margin-bottom: 20px;
        opacity: 0.7;
        font-size: 0.9em;
    }

    .buttons {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
    }

    .button-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        margin-left: 8px;
    }

    .button-title {
        font-weight: bold;
    }

    .button-description {
        font-size: 0.8em;
        opacity: 0.7;
    }
</style>
