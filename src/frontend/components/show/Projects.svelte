<script lang="ts">
    import type { Tree } from "../../../types/Projects"
    import { ShowType } from "../../../types/Show"
    import {
        actions,
        activeFocus,
        activeProject,
        activeShow,
        dictionary,
        drawer,
        focusMode,
        folders,
        fullColors,
        labelsDisabled,
        openedFolders,
        projects,
        projectTemplates,
        projectView,
        showRecentlyUsedProjects,
        shows,
        sorted,
        special
    } from "../../stores"
    import { getAccess } from "../../utils/profile"
    import { getActionIcon } from "../actions/actions"
    import { clone, keysToID, removeDuplicateValues, sortByName, sortByTimeNew } from "../helpers/array"
    import { getContrast } from "../helpers/color"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { getFileName, removeExtension } from "../helpers/media"
    import { checkInput } from "../helpers/showActions"
    import T from "../helpers/T.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import Button from "../inputs/Button.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import ProjectButton from "../inputs/ProjectButton.svelte"
    import ShowButton from "../inputs/ShowButton.svelte"
    import { autoscroll } from "../system/autoscroll"
    import Autoscroll from "../system/Autoscroll.svelte"
    import Center from "../system/Center.svelte"
    import DropArea from "../system/DropArea.svelte"
    import SelectElem from "../system/SelectElem.svelte"
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
            const rootParentId = path.split("/")[0] || folder.id!
            if (profile[rootParentId] === "none") return

            const isReadOnly = profile[rootParentId] === "read"
            folder.readOnly = isReadOnly

            folderSorted.push(folder)
            if (folder.type !== "folder") return

            sortFolders(folder.id, index + 1, path + folder.id + "/")
        })
    }

    // autoscroll
    let scrollElem: HTMLElement | undefined
    let offset = -1
    $: itemsBefore = $drawer.height < 400 ? 5 : 1
    $: offset = autoscroll(scrollElem, Math.max(0, ($activeShow?.index || 0) - itemsBefore))

    // close if not existing
    $: if ($activeProject && !$projects[$activeProject]) activeProject.set(null) // projectView.set(true)
    // get pos if clicked in drawer, or position moved
    $: if ($activeProject && $activeShow?.index !== undefined && $projects[$activeProject]?.shows?.[$activeShow.index]?.id !== $activeShow?.id) findShowInProject()

    function findShowInProject() {
        if (!$projects[$activeProject!]?.shows) return

        let i = $projects[$activeProject!].shows.findIndex((p) => p.id === $activeShow?.id)
        let pos: number = i > -1 ? i : ($activeShow?.index ?? -1)

        // ($activeShow?.type !== "video" && $activeShow?.type !== "image")
        if (pos < 0 || $activeShow?.index === pos) return

        activeShow.update((a) => {
            a!.index = pos
            return a
        })
    }

    // pre v0.6.1
    $: if ($activeProject && $projects[$activeProject]?.notes !== undefined) moveNotes()
    function moveNotes() {
        projects.update((a) => {
            let notes: string = a[$activeProject!].notes || ""
            if (notes.length) a[$activeProject!].shows.splice(0, 0, { id: "notes", type: "section", name: "Notes", notes })

            delete a[$activeProject!].notes
            return a
        })
    }

    function addSection() {
        let activeShowIndex = $activeShow?.index !== undefined ? $activeShow?.index + 1 : null
        let index: number = activeShowIndex ?? $projects[$activeProject || ""]?.shows?.length ?? 0
        history({ id: "UPDATE", newData: { key: "shows", index }, oldData: { id: $activeProject }, location: { page: "show", id: "section" } })
    }

    function getContextMenuId(type: ShowType | undefined) {
        if ((type || "show") === "show") return "show"
        if (type === "video" || type === "image") return "media"
        return type
    }

    $: projectActive = !$projectView && $activeProject !== null
    $: activeProjectParent = $activeProject ? $projects[$activeProject]?.parent : ""
    $: projectReadOnly = readOnly || profile[activeProjectParent] === "read" || tree.find((a) => a.id === activeProjectParent)?.readOnly

    function createProject(folder: boolean = false) {
        let parent = interactedFolder || ($folders[$projects[$activeProject || ""]?.parent] ? $projects[$activeProject || ""]?.parent || "/" : "/")
        if (profile[parent] === "none" || tree.find((a) => a.id === parent)?.readOnly) parent = "/"
        history({ id: "UPDATE", newData: { replace: { parent } }, location: { page: "show", id: `project${folder ? "_folder" : ""}` } })
    }

    let listScrollElem: HTMLElement | undefined
    let listOffset = -1
    $: if (listScrollElem) {
        let time = tree.length * 0.5 + 20
        setTimeout(() => {
            if (!listScrollElem) return
            listOffset = autoscroll(listScrollElem, Math.max(0, [...(listScrollElem.querySelector(".ParentBlock")?.children || [])].findIndex((a) => a?.querySelector(".active")) - itemsBefore))
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
        recentlyUsedList = keysToID($projects).filter((a) => a.used && Date.now() - a.used < FIVE_DAYS)
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

    $: lessVisibleSection = $projects[$activeProject || ""]?.shows?.length > 10 || !!$projects[$activeProject || ""]?.shows?.find((a) => a.type === "section")
</script>

<svelte:window on:keydown={checkInput} />

<div class="main">
    <span class="tabs">
        {#if projectActive || recentlyUsedList.length}
            {#if !$focusMode}
                <Button style="flex: 1;padding: 0.3em 0.5em;" on:click={back} active={$projectView} center dark title={$dictionary.remote?.projects}>
                    <Icon id="back" size={1.2} />
                </Button>
                <div style="flex: 7;max-width: calc(100% - 43px);" class="header context #projectTab _close" title={$dictionary.remote?.project + ": " + ($projects[$activeProject || ""]?.name || "")}>
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
                <ProjectButton name={project.name} parent={project.parent} id={project.id} recentlyUsed />
            {/each}
        </div>
    {:else if !projectActive}
        <div id="projectsArea" class:float={!templates.length} class="list projects {readOnly ? '' : 'context #projects'}">
            <Autoscroll offset={listOffset} bind:scrollElem={listScrollElem} timeout={150} smoothTimeout={0}>
                <DropArea id="projects">
                    <ProjectList {tree} {readOnly} />
                </DropArea>
            </Autoscroll>
        </div>

        {#if templates.length}
            <div class="projectTemplates" style="margin-bottom: 60px;">
                {#each templates as project}
                    <ProjectButton name={project.name} parent={project.parent} id={project.id} {interactedFolder} template />
                {/each}
            </div>
        {/if}

        <!-- <div style="display: flex;">
            <span class="buttons left" style="position: relative;flex: 1;">
                <BottomButton style="height: 30px;" disabled={readOnly} title="new.folder" on:click={() => createProject(true)}>
                    <Icon id="folder" white />
                </BottomButton>
            </span>
            <span class="buttons right" style="position: relative;flex: 5;">
                <BottomButton style="height: 30px;" disabled={readOnly} icon="add" scrollElem={templates.length ? null : listScrollElem?.querySelector(".droparea")} title="new.project" on:click={() => createProject()}>
                    {#if !$labelsDisabled}<T id="new.project" />{/if}
                </BottomButton>
            </span>
        </div> -->

        <FloatingInputs>
            <MaterialButton icon="folder" title="new.folder" on:click={() => createProject(true)} white />
            <div class="divider"></div>
            <MaterialButton icon="add" title="new.project" on:click={() => createProject()}>
                {#if !$labelsDisabled}<T id="new.project" />{/if}
            </MaterialButton>
        </FloatingInputs>
    {:else}
        <div id="projectArea" class="list {projectReadOnly ? '' : 'context #project'}">
            <Autoscroll {offset} bind:scrollElem timeout={150}>
                <DropArea id="project" selectChildren let:fileOver file>
                    {#if $projects[$activeProject || ""]?.shows?.length}
                        {#each $projects[$activeProject || ""]?.shows as show, index}
                            {@const triggerAction = show.data?.settings?.triggerAction || $special.sectionTriggerAction}
                            {@const pcoLink = !!$shows[show.id]?.quickAccess?.pcoLink}

                            <SelectElem id="show" triggerOnHover data={{ ...show, name: show.name || removeExtension(getFileName(show.id)), index }} {fileOver} borders="edges" trigger="column" draggable>
                                {#if show.type === "section"}
                                    <Button
                                        active={$focusMode ? $activeFocus.id === show.id : $activeShow?.id === show.id}
                                        class="section {projectReadOnly ? '' : `context #project_section__project ${show.color ? 'color-border' : ''}`}"
                                        style="font-weight: bold;{$fullColors ? `background-color: ${show.color};color: ${getContrast(show.color || '')};` : `--border-color: ${show.color};color: ${show.color};`}"
                                        on:click={() => {
                                            if ($focusMode) activeFocus.set({ id: show.id, index, type: show.type })
                                            else activeShow.set({ ...show, index })
                                        }}
                                        dark
                                        center
                                        bold={false}
                                    >
                                        <p>
                                            {#if show.name?.length}
                                                {show.name}
                                            {:else}
                                                <span style="opacity: 0.5;"><T id="main.unnamed" /></span>
                                            {/if}
                                        </p>

                                        {#if triggerAction && $actions[triggerAction]}
                                            <span style="display: flex;position: absolute;inset-inline-end: 5px;" data-title={$actions[triggerAction].name}>
                                                <Icon id={getActionIcon(triggerAction)} size={0.8} white />
                                            </span>
                                        {/if}
                                    </Button>
                                {:else}
                                    <ShowButton id={show.id} {show} {index} class={projectReadOnly ? "" : `context #${pcoLink ? "pco_item__" : ""}project_${getContextMenuId(show.type)}__project`} icon />
                                {/if}
                            </SelectElem>
                        {/each}
                    {:else}
                        <Center faded>
                            <T id="empty.general" />
                        </Center>
                    {/if}
                </DropArea>
            </Autoscroll>
        </div>
    {/if}

    {#if $activeProject && !$projectView && !$focusMode && !recentlyUsedList.length && !projectReadOnly}
        <!-- <BottomButton icon="section" scrollElem={scrollElem?.querySelector(".droparea")} title="new.section" on:click={addSection}>
            {#if !$labelsDisabled}<T id="new.section" />{/if}
        </BottomButton> -->

        <FloatingInputs onlyOne round={lessVisibleSection}>
            <MaterialButton icon="section" title="new.section" on:click={addSection} white={lessVisibleSection}>
                {#if !lessVisibleSection && !$labelsDisabled}<T id="new.section" />{/if}
            </MaterialButton>
        </FloatingInputs>
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
        /* this is to be able to right click and add a folder/project at "root" level */
        padding-bottom: 10px;
    }
    .list.projects.float :global(.droparea) {
        padding-bottom: 60px;
    }
    .list#projectArea :global(.droparea) {
        /* "new" button */
        padding-bottom: 60px;
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

        max-height: calc(30px * 5);
        overflow-y: auto;

        border-top: 2px solid var(--primary-lighter);
    }

    #projectArea :global(button.color-border) {
        border-bottom: 2px solid var(--border-color);
        outline-color: var(--border-color);
    }
</style>
