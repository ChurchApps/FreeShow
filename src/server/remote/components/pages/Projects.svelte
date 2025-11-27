<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { uid } from "uid"
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { _set, activeProject, dictionary, folders, openedFolders, project, projects, projectsOpened } from "../../util/stores"

    let dispatch = createEventDispatcher()

    type TreeItem = {
        id: string
        name: string
        type: "folder" | "project"
        parent: string
        index: number
        path: string
    }

    function sortByName(items: any[]): any[] {
        return [...items].sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    }

    function buildTree(parent = "/", index = 0, path = "", _updater: any = null): TreeItem[] {
        const tree: TreeItem[] = []

        // Get folders in this parent
        const folderEntries = Object.entries($folders || {})
            .filter(([, folder]: [string, any]) => !folder.deleted && (folder.parent === parent || (parent === "/" && !$folders[folder.parent])))
            .map(([folderId, folder]: [string, any]) => ({ ...folder, id: folderId, type: "folder" as const }))

        // Get projects in this parent
        const projectEntries = ($projects || []).filter((p: any) => p.parent === parent || (parent === "/" && !$folders[p.parent])).map((p: any) => ({ ...p, type: "project" as const }))

        // Sort and combine
        const sortedFolders = sortByName(folderEntries)
        const sortedProjects = sortByName(projectEntries)

        // Add folders first
        sortedFolders.forEach((item: any) => {
            const itemPath = path + item.id + "/"
            tree.push({
                id: item.id,
                name: item.name,
                type: "folder",
                parent: item.parent || "/",
                index,
                path: path
            })

            const children = buildTree(item.id, index + 1, itemPath)
            tree.push(...children)
        })

        // Add projects
        sortedProjects.forEach((item: any) => {
            tree.push({
                id: item.id,
                name: item.name,
                type: "project",
                parent: item.parent || "/",
                index,
                path: path
            })
        })

        return tree
    }

    $: tree = buildTree("/", 0, "", { $projects })

    // Split tree into sections (root folders and their children)
    $: splittedTree = (() => {
        const sections: TreeItem[][] = [[]]
        let rootProjects: TreeItem[] = []

        tree.forEach(a => {
            if (a.parent === "/" && a.type !== "folder") {
                rootProjects.push(a)
                return
            }

            if (a.type === "folder" && a.parent === "/" && sections.at(-1)?.length) sections.push([])

            sections.at(-1)!.push(a)
        })

        if (rootProjects.length) {
            sections.push([{ id: "ROOT", name: "", type: "project", parent: "/", index: 0, path: "" } as TreeItem, ...rootProjects])
        }

        return sections.filter(a => a.length)
    })()

    function checkIfShown(item: TreeItem): boolean {
        if (item.parent === "/") return true
        const pathParts = item.path.split("/").filter(Boolean)
        return pathParts.every(id => $openedFolders.includes(id))
    }

    function toggleFolder(folderId: string) {
        if ($openedFolders.includes(folderId)) {
            _set(
                "openedFolders",
                $openedFolders.filter(id => id !== folderId)
            )
        } else {
            _set("openedFolders", [...$openedFolders, folderId])
        }
    }

    function openProject(projectId: string) {
        const proj = $projects.find((p: any) => p.id === projectId)
        if (proj) {
            _set("activeProject", proj)
            dispatch("open")
        }
    }

    function createProject() {
        const name = prompt("Please enter a name:")
        if (!name) return

        const projectId = uid()
        send("API:create_project", { name, id: projectId })

        projectsOpened.set(false)
        project.set(projectId)
    }
</script>

<div class="container">
    <h2 class="header">{translate("remote.projects", $dictionary)}</h2>

    <div class="scroll project-list">
        {#if tree.length}
            <div class="fullTree">
                {#each splittedTree as section}
                    <div class="rootFolder">
                        {#each section as item}
                            {#if item.id === "ROOT"}
                                <div class="title">{translate("category.unlabeled", $dictionary) || "Unlabeled"}</div>
                            {:else}
                                {@const shown = checkIfShown(item)}
                                {@const isOpened = $openedFolders.includes(item.id)}
                                {@const isActive = $activeProject?.id === item.id}
                                {@const activeProjectParent = $activeProject?.parent || "/"}
                                {@const isActiveFolder = item.type === "folder" && item.id === activeProjectParent && activeProjectParent !== "/"}

                                {#if shown}
                                    <div class="projectItem" class:indented={item.parent !== "/"} class:root={item.parent === "/"} style="margin-inline-start: {8 * item.index}px;">
                                        {#if item.type === "folder"}
                                            <Button on:click={() => toggleFolder(item.id)} class="project-button folder" active={isActiveFolder} bold={false} border>
                                                <Icon id={isOpened ? "folderOpen" : "folder"} right />
                                                <span>{item.name}</span>
                                            </Button>
                                        {:else}
                                            <Button on:click={() => openProject(item.id)} class="project-button" active={isActive} bold={false} border>
                                                <Icon id="project" right />
                                                <span>{item.name}</span>
                                            </Button>
                                        {/if}
                                    </div>
                                {/if}
                            {/if}
                        {/each}
                    </div>
                {/each}
            </div>
        {:else}
            <Center faded>{translate("empty.project_select", $dictionary)}</Center>
        {/if}
    </div>

    <div class="floating-input-container">
        <Button on:click={createProject} center dark class="floating-action-button">
            <Icon id="add" size={1.2} right />
            <span>{translate("new.project", $dictionary)}</span>
        </Button>
    </div>
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        flex: 1;
        position: relative;
        height: 100%;
    }

    .header {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        height: 58px;
        padding: 0 44px;
        border-bottom: 1px solid var(--primary-lighter);
        background-color: var(--primary-darker);
        color: var(--text);
        font-weight: 600;
        font-size: 1.05em;
        box-sizing: border-box;
        margin: 0;
    }

    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: thin;
        scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
    }
    .scroll::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    .scroll::-webkit-scrollbar-track,
    .scroll::-webkit-scrollbar-corner {
        background: rgb(255 255 255 / 0.05);
    }
    .scroll::-webkit-scrollbar-thumb {
        background: rgb(255 255 255 / 0.3);
        border-radius: 8px;
    }
    .scroll::-webkit-scrollbar-thumb:hover {
        background: rgb(255 255 255 / 0.5);
    }

    .project-list {
        padding-bottom: 60px;
    }

    .fullTree {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin: 10px 0;
        padding-right: 5px;
    }

    .rootFolder {
        background-color: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);
        border-left: 0;
        border-radius: 10px;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        overflow: hidden;
        width: 100%;
        max-width: 520px;
    }

    .title {
        font-weight: 500;
        padding: 4px 14px;
        font-size: 0.8rem;
        opacity: 0.8;
        background: var(--primary-darkest);
        border-bottom: 1px solid var(--primary-lighter);
    }

    .projectItem {
        display: flex;
        transition: background-color 0.15s ease;
    }

    .projectItem.root {
        background-color: transparent;
    }

    .projectItem:not(.root) {
        background-color: rgb(255 255 255 / 0.01);
    }

    .projectItem.indented {
        border-inline-start: 1px solid var(--primary-lighter);
    }

    .projectItem :global(button) {
        width: 100%;
        padding: 0.22rem 0.65rem;
        min-height: 44px;
        font-size: 1em;
        align-items: center;
        justify-content: flex-start;
        text-align: left;
        margin: 0;
        border-radius: 0;
        background-color: transparent !important;
        border-left: none !important;
    }

    .projectItem.root :global(button) {
        background-color: transparent !important;
    }

    .projectItem :global(button):hover {
        background-color: rgb(255 255 255 / 0.05) !important;
    }

    /* Active state - purple accent bar */
    .projectItem :global(button.active) {
        background-color: rgb(255 255 255 / 0.08) !important;
        box-shadow: inset 4px 0 0 var(--secondary) !important;
        border-top: none !important;
        border-right: none !important;
        border-bottom: none !important;
        outline: none !important;
        box-sizing: border-box !important;
    }

    .projectItem.root :global(button.active) {
        background-color: transparent !important;
    }

    .rootFolder .projectItem:last-child :global(button.active) {
        border-bottom-right-radius: 12px !important;
    }

    .rootFolder .projectItem:first-child :global(button.active) {
        border-top-right-radius: 12px !important;
    }

    .projectItem :global(button.folder) {
        font-weight: 600;
    }

    .projectItem :global(button) :global(span) {
        display: flex;
        align-items: center;
        line-height: 1.2;
        text-align: left;
        flex: 1;
        min-width: 0;
    }

    .projectItem :global(button) :global(svg) {
        width: 1.2em;
        height: 1.2em;
        flex-shrink: 0;
        margin-right: 0.5em;
    }

    .floating-input-container {
        position: absolute;
        bottom: 10px;
        right: 15px;
        z-index: 10;
    }

    :global(.floating-action-button) {
        font-size: 1em;
        border-radius: 50px !important;
        height: 40px;
        padding: 0 20px !important;
        display: flex !important;
        align-items: center !important;
        gap: 0.45em;
        background-color: rgba(25, 25, 35, 0.92) !important;
        border: 2px solid rgba(255, 255, 255, 0.1) !important;
        box-shadow: 1px 1px 6px rgb(0 0 0 / 0.4);
        backdrop-filter: blur(3px);
    }

    :global(.floating-action-button span) {
        font-weight: 600;
        white-space: nowrap;
    }

    :global(.floating-action-button:hover) {
        background-color: rgba(35, 35, 55, 0.95) !important;
        transform: translateY(-1px);
    }

    /* Mobile styles */
    @media screen and (max-width: 1000px) {
        .header {
            height: 60px;
            font-size: 1.15em;
            padding: 0;
        }

        .project-list {
            padding: 0 0 60px;
        }

        .fullTree {
            margin: 10px 0;
            padding-right: 12px;
        }

        .rootFolder {
            width: 100%;
            border-radius: 0 10px 10px 0;
            border-left: none;
        }

        .projectItem :global(button) {
            padding: 0.3rem 0.75rem;
            min-height: 48px;
            font-size: 1.05em;
        }

        .projectItem :global(button) {
            border-bottom-left-radius: 0 !important;
        }

        .projectItem :global(button) :global(svg) {
            width: 1.4em;
            height: 1.4em;
        }

        .floating-input-container {
            bottom: 15px;
            right: 10px;
        }
    }
</style>
