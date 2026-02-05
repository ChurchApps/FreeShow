<script lang="ts">
    import { onMount } from "svelte"
    import type { Tree } from "../../../types/Projects"
    import { activeProject, folders, labelsDisabled, openedFolders, projects } from "../../stores"
    import { translateText } from "../../utils/language"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import HiddenInput from "../inputs/HiddenInput.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import Loader from "../main/Loader.svelte"
    import Center from "../system/Center.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import { openProject } from "./project"

    export let tree: Tree[]
    export let readOnly = false

    let visibleArchives: string[] = []

    function checkIfShown(project: any, _updater: any = null) {
        let allOpened = true
        project.path!.split("/").forEach((id: string) => {
            if (id.length && !$openedFolders.includes(id)) allOpened = false
        })
        return allOpened
    }

    let startLoading: boolean = tree.length < 50
    onMount(() => {
        // remove any deleted opened folders (and remove duplicates)
        openedFolders.set([...new Set($openedFolders.filter((id) => $folders[id]))])

        setTimeout(() => (startLoading = true), 20)
    })

    let foldersWithoutContent: string[] = []
    $: if (tree && $openedFolders) checkFolders()
    function checkFolders() {
        foldersWithoutContent = []
        // only check opened folders
        $openedFolders.forEach((folderId) => {
            if (Object.values($projects).find((a) => a.parent === folderId)) return
            if (Object.values($folders).find((a) => a.parent === folderId)) return

            foldersWithoutContent.push(folderId)
        })
    }

    let archivedCount: { [key: string]: { id: string; count: number } } = {}
    $: if (tree) checkArchivedCount()
    function checkArchivedCount() {
        archivedCount = {}
        tree.forEach((project) => {
            if (project.type === "folder" || !project.archived) return

            if (!archivedCount[project.parent]) {
                archivedCount[project.parent] = { id: project.id, count: 0 }
            }
            archivedCount[project.parent].count++
        })
    }

    let splittedTree: Tree[][] = []
    $: if (tree) splitRootFoldersToSections()
    function splitRootFoldersToSections() {
        splittedTree = [[]]
        let rootProjects: Tree[] = []

        tree.forEach((a) => {
            if (a.parent === "/" && a.type !== "folder") {
                rootProjects.push(a)
                return
            }

            if (a.type === "folder" && a.parent === "/" && splittedTree.at(-1)?.length) splittedTree.push([])

            splittedTree.at(-1)!.push(a)
        })

        if (rootProjects.length) {
            splittedTree.push([{ id: "ROOT" } as any, ...rootProjects])
        }

        splittedTree = splittedTree.filter((a) => a.length)
    }

    let editActive = false
    function rename(id: string, value: string) {
        // if (editActive) return

        history({ id: "UPDATE", newData: { key: "name", data: value }, oldData: { id }, location: { page: "show", id: "project_key" } })
    }
    function renameFolder(id: string, value: string) {
        console.log(id, value)
        // if (editActive) return

        history({ id: "UPDATE", newData: { key: "name", data: value }, oldData: { id }, location: { page: "show", id: "project_folder_key" } })
    }

    // click

    function open(e: any, id: string) {
        if (e.detail.target.closest(".edit") || e.detail.target.querySelector(".edit") || editActive) return
        if (e.detail.ctrl) return

        openProject(id, !e.detail.alt)
    }

    function toggleFolder(e: any, project: any, opened: boolean) {
        if (editActive || e.detail.ctrl || e.detail.target.classList.contains("name") || e.detail.target.classList.contains("add")) return

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

    ///

    let pathToActive = ""
    $: if ($activeProject || tree) updateActivePath()
    function updateActivePath() {
        let paths: string[] = []
        let currentParent = $projects[$activeProject!]?.parent

        let loopstop = 0
        while ((currentParent || "/") !== "/" && loopstop < 80) {
            loopstop++

            paths.push(currentParent)
            currentParent = $folders[currentParent]?.parent
        }
        pathToActive = paths.reverse().join("/")
    }
</script>

{#if tree.length}
    {#if startLoading}
        <div class="fullTree">
            {#each splittedTree as tree}
                <div class="rootFolder">
                    {#each tree as project}
                        {#if project.id === "ROOT"}
                            <div class="title">{translateText("category.unlabeled")}</div>
                        {:else}
                            {@const opened = $openedFolders.includes(project.id)}
                            {@const shown = checkIfShown(project, $openedFolders)}
                            {@const isArchivedShown = !project.archived || visibleArchives.includes(project.parent)}
                            {@const isEmpty = project.type === "folder" && foldersWithoutContent.includes(project.id)}
                            {@const isReadOnly = readOnly || project.readOnly}
                            {@const projectsCount = project.parent === "/" ? tree.reduce((value, a) => (a.type !== "folder" ? value + 1 : value), 0) : 0}

                            <div class="projectItem" class:indented={project.parent !== "/"} style="margin-inline-start: {8 * (project.index || 0)}px;background-color: rgb(255 255 255 / {0.01 * (project.index || 0)});">
                                <!-- , path: project.path -->
                                <SelectElem id={project.type || "project"} data={{ type: project.type || "project", id: project.id }} draggable trigger="column" borders="center">
                                    {#if project.type === "folder" && (project.parent === "/" || shown)}
                                        <MaterialButton style="width: 100%;padding: 0.22rem 0.65rem;" title="{opened ? 'actions.close' : 'main.open'}: <b>{project.name}</b>" on:click={(e) => toggleFolder(e, project, opened)} class="folder context #folder{readOnly ? '_readonly' : ''}" isActive={pathToActive.includes(project.id)} tab>
                                            <Icon id={opened ? "folderOpen" : "folder"} white />
                                            <HiddenInput value={project.name} id={"folder_" + project.id} on:edit={(e) => renameFolder(project.id, e.detail.value)} bind:edit={editActive} allowEdit={!isReadOnly} />

                                            {#if projectsCount}
                                                <span class="count">{projectsCount}</span>
                                            {/if}
                                        </MaterialButton>
                                    {:else if project.id && shown && isArchivedShown}
                                        <MaterialButton style="width: 100%;padding: 0.08rem 0.65rem;font-weight: normal;" title="actions.id_select_project: <b>{project.name}</b>" on:click={(e) => open(e, project.id)} class="context #project_button{readOnly ? '_readonly' : ''}" isActive={$activeProject === project.id} tab>
                                            <Icon id={$projects[project.id]?.archived ? "archive" : "project"} white={$projects[project.id]?.archived} />
                                            <HiddenInput value={project.name} id={"project_" + project.id} on:edit={(e) => rename(project.id, e.detail.value)} bind:edit={editActive} allowEdit={!isReadOnly} />
                                        </MaterialButton>
                                    {/if}
                                </SelectElem>
                            </div>

                            {#if shown && project.archived && !visibleArchives.includes(project.parent) && project.id === archivedCount[project.parent].id}
                                <div class:indented={project.parent !== "/"} style="margin-inline-start: {8 * (project.index || 0)}px;display: flex;align-items: center;flex-direction: column;">
                                    <Button
                                        on:click={() => {
                                            visibleArchives.push(project.parent)
                                            visibleArchives = visibleArchives
                                        }}
                                        style="width: 100%;border-top: 1px solid var(--primary-lighter);font-size: 0.9em;"
                                        center
                                    >
                                        <Icon id="archive" size={0.8} white right />
                                        <p style="display: flex;align-items: center;gap: 6px;"><T id="actions.show_archived" /> <span style="opacity: 0.4;font-size: 0.9em;">{archivedCount[project.parent].count}</span></p>
                                    </Button>
                                </div>
                            {/if}

                            {#if shown && isEmpty && !isReadOnly}
                                <div class:indented={project.parent !== "/"} style="margin-inline-start: {8 * ((project.index || 0) + 1)}px;display: flex;align-items: center;flex-direction: column;padding: 12px;">
                                    <p style="opacity: 0.5;padding-bottom: 8px;"><T id="empty.general" /></p>

                                    <MaterialButton variant="outlined" icon="add" title="new.project" style="justify-content: start;padding: 6px 14px;" on:click={() => history({ id: "UPDATE", newData: { replace: { parent: project.id } }, location: { page: "show", id: "project" } })}>
                                        {#if !$labelsDisabled}<p><T id="new.project" /></p>{/if}
                                    </MaterialButton>
                                </div>
                            {/if}
                        {/if}
                    {/each}
                </div>
            {/each}
        </div>
    {:else}
        <Center>
            <Loader />
        </Center>
    {/if}
{:else}
    <Center faded>
        <T id="empty.general" />
    </Center>
{/if}

<style>
    .fullTree {
        display: flex;
        flex-direction: column;
        gap: 5px;

        margin: 10px 0;
        margin-right: 5px;
    }
    .rootFolder {
        background-color: var(--primary-darker);

        border: 1px solid var(--primary-lighter);
        border-left: 0;

        border-radius: 10px;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;

        overflow: hidden;
    }

    .title {
        font-weight: 500;
        padding: 4px 14px;
        font-size: 0.8rem;
        opacity: 0.8;
        background: var(--primary-darkest);
        border-bottom: 1px solid var(--primary-lighter);
    }

    .count {
        opacity: 0.5;
        font-size: 0.78em;
        min-width: 28px;
        text-align: end;
        font-weight: normal;
    }

    .indented {
        border-inline-start: 1px solid var(--primary-lighter);
    }
</style>
