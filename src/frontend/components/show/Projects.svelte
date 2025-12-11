<script lang="ts">
    import { uid } from "uid"
    import type { Tree } from "../../../types/Projects"
    import { activeEdit, activeProject, activeRename, activeShow, drawer, focusMode, folders, labelsDisabled, openedFolders, projects, projectTemplates, projectView, saved, showRecentlyUsedProjects, sorted } from "../../stores"
    import { translateText } from "../../utils/language"
    import { getAccess } from "../../utils/profile"
    import { clone, keysToID, removeDuplicateValues, sortByName, sortByTimeNew } from "../helpers/array"
    import { history } from "../helpers/history"
    import { getProjectName } from "../helpers/historyHelpers"
    import Icon from "../helpers/Icon.svelte"
    import { checkInput } from "../helpers/showActions"
    import T from "../helpers/T.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import HiddenInput from "../inputs/HiddenInput.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import Autoscroll from "../system/Autoscroll.svelte"
    import DropArea from "../system/DropArea.svelte"
    import ProjectContentList from "./ProjectContentList.svelte"
    import ProjectList from "./ProjectList.svelte"

    let tree: Tree[] = []

    if (Object.keys($projects).length) deleteDuplicatedProjects()
    function deleteDuplicatedProjects() {
        projects.set(removeDuplicateValues($projects))
    }

    let profile = getAccess("projects")
    let readOnly = profile.global === "read"

    $: f = Object.entries($folders)
        .filter(([id, a]) => !a.deleted && profile[id] !== "none")
        .map(([id, folder]) => ({ ...folder, id, type: "folder" as const }))
    $: p = Object.entries($projects)
        .filter(([_, a]) => !a.deleted)
        .map(([id, project]) => ({ ...project, parent: $folders[project.parent] ? project.parent : "/", id, shows: [] as any }))
    $: templates = sortByName(keysToID($projectTemplates)).filter((a) => !a.deleted)

    $: {
        let sortType = $sorted.projects?.type || "name"
        // sort by name regardless because project folders <= 0.9.5 doesn't have created date
        let sortedFolders = sortByName(f)
        let sortedProjects = sortByName(p)
        if (sortType === "created") {
            sortedFolders = sortedFolders.sort((a, b) => (b.created || 0) - (a.created || 0))
            sortedProjects = sortedProjects.sort((a, b) => (b.created || 0) - (a.created || 0))
        } else if (sortType === "modified") {
            sortedProjects = sortedProjects.sort((a, b) => (b.modified || 0) - (a.modified || 0))
        } else if (sortType === "name_des") {
            sortedFolders = sortedFolders.reverse()
            sortedProjects = sortedProjects.reverse()
        }

        // sort by archived state
        sortedProjects = sortedProjects.sort((a, b) => (!!a.archived === !!b.archived ? 0 : a.archived ? 1 : -1))

        tree = [...(sortedFolders as any), ...sortedProjects]

        // update parents (if folders are missing)
        tree = tree.map((a) => ({ ...a, parent: !$folders[a.parent] || $folders[a.parent].deleted ? "/" : a.parent }))

        folderSorted = []
        sortFolders()
        tree = folderSorted
    }

    let folderSorted: Tree[] = []
    function sortFolders(parent = "/", index = 0, path = "") {
        let filtered = tree.filter((a) => a.parent === parent).map((a) => ({ ...a, index, path }))
        filtered.forEach((folder) => {
            const rootParentId = path.split("/")[0] || folder.id
            if (profile[rootParentId] === "none") return

            const isReadOnly = profile[rootParentId] === "read"
            folder.readOnly = isReadOnly

            folderSorted.push(folder)
            if (folder.type !== "folder") return

            sortFolders(folder.id, index + 1, path + folder.id + "/")
        })
    }

    $: projectActive = !$projectView && $activeProject !== null

    function createProject(folder = false) {
        let parent = interactedFolder || ($folders[$projects[$activeProject || ""]?.parent] ? $projects[$activeProject || ""]?.parent || "/" : "/")
        if (profile[parent] === "none" || tree.find((a) => a.id === parent)?.readOnly) parent = "/"
        history({ id: "UPDATE", newData: { replace: { parent } }, location: { page: "show", id: `project${folder ? "_folder" : ""}` } })
    }

    // autoscroll
    let listScrollElem: HTMLElement | undefined
    let listOffset = -1
    $: if (listScrollElem) {
        let time = tree.length * 0.5 + 20
        setTimeout(() => {
            if (!listScrollElem) return
            const projectElements = [...(listScrollElem.querySelector(".fullTree")?.querySelectorAll("button") || [])]
            const activeProject = projectElements.findLast((a) => a?.classList.contains("isActive"))
            if (!activeProject) return

            listOffset = Math.max(0, ((activeProject.closest(".projectItem") as HTMLElement)?.offsetTop || 0) + listScrollElem.offsetTop - ($drawer.height < 400 ? 120 : 20))
        }, time)
    }

    function back() {
        projectView.set(true)
        showRecentlyUsedProjects.set(false)
    }

    // last used
    let recentlyUsedList: any[] = []
    // listen for $projects updates in case it has been updated from sync
    $: if ($showRecentlyUsedProjects && $projects) lastUsed()
    else recentlyUsedList = []

    function lastUsed() {
        const FIVE_DAYS = 432000000
        // get all projects used within the last five days
        recentlyUsedList = keysToID($projects).filter((a) => !a.archived && a.used && Date.now() - a.used < FIVE_DAYS)
        // last used first
        recentlyUsedList = sortByTimeNew(recentlyUsedList, "used").reverse()

        if (recentlyUsedList.length < 2) {
            recentlyUsedList = []
            showRecentlyUsedProjects.set(false)
        }
    }

    // most recently interacted with folder (to put new project inside)
    // if no project is opened this will also select an opened folder if any
    let interactedFolder = ""
    let previouslyOpened: string[] = []
    $: if ($openedFolders) checkInteraction()
    function checkInteraction() {
        if ($openedFolders.length > previouslyOpened.length) {
            $openedFolders.forEach((folderId) => {
                if (!previouslyOpened.includes(folderId)) interactedFolder = folderId
            })
        }
        previouslyOpened = clone($openedFolders)
    }
    $: if (!$folders[interactedFolder]) interactedFolder = ""

    // TEMPLATE

    function createFromTemplate(e: any, id: string) {
        // prevent extra single click on (template) double click
        let { ctrl, doubleClick, target } = e.detail

        if (target.closest(".edit") || target.querySelector(".edit") || editActive || doubleClick) return

        let project = clone($projectTemplates[id])
        if (!project) return

        project.parent = interactedFolder || ($folders[$projects[$activeProject || ""]?.parent] ? $projects[$activeProject || ""]?.parent || "/" : "/")

        if (project.name.includes("{") ? !ctrl : ctrl)
            project.name = getProjectName({ default_project_name: project.name }) // replace actual name values
        else project.name = getProjectName() // use default (auto) project name

        let projectId = uid()
        history({ id: "UPDATE", newData: { data: project }, oldData: { id: projectId }, location: { page: "show", id: "project" } })
        setTimeout(() => activeRename.set("project_" + projectId))
    }

    let editActive = false
    function rename(value: string, id: string) {
        // if (editActive) return

        history({ id: "UPDATE", newData: { key: "name", data: value }, oldData: { id }, location: { page: "show", id: "project_template" } })
    }

    // RECENTLY USED

    function openRecentlyUsed(e: any, id: string) {
        if (e.detail.target.closest(".edit") || e.detail.target.querySelector(".edit")) return

        // set back to saved if opening, as project used time is changed
        if ($saved) setTimeout(() => saved.set(true), 10)

        // set last used
        showRecentlyUsedProjects.set(false)
        projects.update((a) => {
            if (a[id]) a[id].used = Date.now()
            return a
        })

        projectView.set(false)
        activeProject.set(id)

        // select first
        if (!$projects[id]?.shows?.length) return
        let showRef = $projects[id].shows[0]
        if (!showRef) return

        activeShow.set({ ...showRef, index: 0 })

        let type = showRef.type
        // same as ShowButton
        if (type === "image" || type === "video") activeEdit.set({ id: showRef.id, type: "media", items: [] })
        else if ($activeEdit.id) activeEdit.set({ type: "show", slide: 0, items: [], showId: showRef.id })
    }
</script>

<svelte:window on:keydown={checkInput} />

<div class="main">
    <span class="tabs">
        {#if projectActive || recentlyUsedList.length}
            {#if !$focusMode}
                <MaterialButton style="flex: 1;padding: 0.3em 0.5em;" icon="back" title="remote.projects" on:click={back} />
                <!-- {recentlyUsedList.length ? '' : 'border-bottom: 1px solid var(--secondary);'} -->
                <div style="flex: 7;max-width: calc(100% - 43px);" class="header context #projectTab _close" title={translateText("remote.project: ") + ($projects[$activeProject || ""]?.name || "")}>
                    <!-- <Icon id="project" white right /> -->
                    {#if recentlyUsedList.length}
                        <p style="font-style: italic;opacity: 0.7;"><T id="info.recently_used" /></p>
                    {:else}
                        <p>{$projects[$activeProject || ""]?.name || ""}</p>
                    {/if}
                </div>
            {/if}
        {:else}
            <div class="header context #projectsTab">
                <!-- <Icon id="folder" white right /> -->
                <p><T id="remote.projects" /></p>
            </div>
        {/if}
    </span>

    {#if recentlyUsedList.length}
        <div id="projectsArea" class="list projects" style="overflow: auto;">
            {#each recentlyUsedList as project}
                <MaterialButton style="width: 100%;padding: 0.08rem 0.65rem;font-weight: normal;" on:click={(e) => openRecentlyUsed(e, project.id)} isActive={$activeProject === project.id} tab>
                    <Icon id="project" />
                    <HiddenInput value={project.name} id={"project_" + project.id} allowEdit={false} />
                </MaterialButton>
            {/each}
        </div>
    {:else if !projectActive}
        <div id="projectsArea" class:float={!templates.length} class="list projects {readOnly ? '' : 'context #projects'}">
            <Autoscroll offset={listOffset} bind:scrollElem={listScrollElem} timeout={150} smoothTimeout={0}>
                <DropArea id="projects">
                    <ProjectList {tree} {readOnly} />
                </DropArea>
            </Autoscroll>

            <FloatingInputs>
                <MaterialButton icon="folder" title="new.folder" on:click={() => createProject(true)} white />
                <div class="divider"></div>
                <MaterialButton icon="add" title="new.project" on:click={() => createProject()}>
                    {#if !$labelsDisabled}<T id="new.project" />{/if}
                </MaterialButton>
            </FloatingInputs>
        </div>

        {#if templates.length}
            <div class="projectTemplates">
                <div class="title">{translateText("tabs.templates")}</div>
                <div class="scroll">
                    {#each templates as project}
                        <MaterialButton id={project.id} style="width: 100%;padding: 0.1rem 0.65rem;font-weight: normal;" on:click={(e) => createFromTemplate(e, project.id)} class="context #project_template{readOnly ? '_readonly' : ''}" isActive={$activeProject === project.id} tab>
                            <Icon id="templates" white={$projects[project.id]?.archived} />
                            <HiddenInput value={project.name} id={"project_" + project.id} on:edit={(e) => rename(e.detail.value, project.id)} bind:edit={editActive} />
                        </MaterialButton>
                    {/each}
                </div>
            </div>
        {/if}
    {:else}
        <ProjectContentList {tree} {recentlyUsedList} />
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

    .tabs .header {
        width: 100%;
        padding: 0.2em 0.8em;
        font-weight: 600;

        display: flex;
        justify-content: center;
        align-items: center;
    }

    .list {
        position: relative;
        display: flex;
        flex-direction: column;
        /* overflow-y: auto;
    overflow-x: hidden; */
        overflow: hidden;
        /* height: 100%; */
        flex: 1;
    }

    .list.projects :global(.droparea) {
        /* "new project" buttons */
        padding-bottom: 50px;
    }

    .list :global(.section) {
        padding: 4px 40px;
        font-size: 0.8em;
        /* font-weight: bold; */
        width: 100%;
    }
    .list :global(.section.active) {
        outline-offset: -2px;
        outline: 2px solid var(--primary-lighter);
    }

    .projectTemplates {
        display: flex;
        flex-direction: column;

        border-top: 1px solid var(--primary-lighter);
        box-shadow: 0 -3px 5px rgb(0 0 0 / 0.05);

        background-color: var(--primary-darker);

        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        overflow: hidden;
    }
    .projectTemplates .scroll {
        max-height: calc(33px * 4);
        overflow-y: auto;
    }

    .title {
        font-weight: 500;
        padding: 4px 14px;
        font-size: 0.8rem;
        opacity: 0.8;
        background: var(--primary-darkest);
        border-bottom: 1px solid var(--primary-lighter);
    }
</style>
