<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount } from "svelte"
    import { fade, slide } from "svelte/transition"
    import type { ProjectShowRef, Tree } from "../../../types/Projects"
    import { ShowType } from "../../../types/Show"
    import { addProjectItem, addToProject, updateRecentlyAddedFiles } from "../../converters/project"
    import { actions, activeFocus, activePopup, activeProject, activeShow, contextActive, drawer, drawerTabsData, editingProjectTemplate, focusMode, fullColors, playerVideos, popupData, projects, projectTemplates, projectView, recentFiles, selected, shows, special } from "../../stores"
    import { triggerFunction } from "../../utils/common"
    import { getAccess } from "../../utils/profile"
    import { getActionIcon } from "../actions/actions"
    import { getTimeUntilClock } from "../drawer/timers/timers"
    import { openDrawer } from "../edit/scripts/edit"
    import { clone } from "../helpers/array"
    import { getContrast } from "../helpers/color"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { getExtension, getFileName, getMediaType, removeExtension } from "../helpers/media"
    import T from "../helpers/T.svelte"
    import { joinTimeBig } from "../helpers/time"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import ShowButton from "../inputs/ShowButton.svelte"
    import Autoscroll from "../system/Autoscroll.svelte"
    import Center from "../system/Center.svelte"
    import DropArea from "../system/DropArea.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import { clipboardToProject } from "./project"

    export let tree: Tree[]
    export let recentlyUsedList: any[] = []
    export let isTemplate: boolean = false

    let profile = getAccess("projects")
    let readOnly = profile.global === "read"

    // autoscroll
    let scrollElem: HTMLElement | undefined
    let offset = -1
    $: if (scrollElem) {
        let time = tree.length * 0.5 + 20
        setTimeout(() => {
            if (!scrollElem) return
            const projectElements = [...(scrollElem.querySelectorAll(".listSection") || [])].map((a) => a?.querySelectorAll("button") || [])
            const flattened = projectElements.flatMap((item) => Array.from(item))
            const activeProjectItem = flattened.findLast((a) => a?.classList.contains("isActive"))
            if (!activeProjectItem) return

            offset = Math.max(0, ((activeProjectItem.closest("#show") as HTMLElement)?.offsetTop || 0) + scrollElem.offsetTop - ($drawer.height < 400 ? 120 : 20))
        }, time)
    }

    const dispatch = createEventDispatcher()
    $: if (scrollElem) dispatch("scrollElem", scrollElem)

    $: projectId = isTemplate ? $editingProjectTemplate : $activeProject

    $: currentProject = isTemplate ? $projectTemplates[$editingProjectTemplate] : $activeProject ? $projects[$activeProject] : null

    // close if not existing
    $: if ($activeProject && !currentProject) activeProject.set(null) // projectView.set(true)
    // get pos if clicked in drawer, or position moved
    $: if ($activeProject && $activeShow?.index !== undefined && currentProject?.shows?.[$activeShow.index]?.id !== $activeShow?.id) findShowInProject()

    function findShowInProject() {
        if (!currentProject?.shows) return

        let i = currentProject.shows.findIndex((p) => p.id === $activeShow?.id)
        let pos: number = i > -1 ? i : ($activeShow?.index ?? -1)

        // ($activeShow?.type !== "video" && $activeShow?.type !== "image")
        if (pos < 0 || $activeShow?.index === pos) return

        activeShow.update((a) => {
            a!.index = pos
            return a
        })
    }

    function getContextMenuId(type: ShowType | undefined) {
        if ((type || "show") === "show") return "show"
        if (type === "video" || type === "image") return "media"
        return type
    }

    function addSection() {
        let activeShowIndex = $activeShow?.index !== undefined ? $activeShow?.index + 1 : null
        let index: number = activeShowIndex ?? projectItemsList.length ?? 0
        history({ id: "UPDATE", newData: { key: "shows", index }, oldData: { id: projectId }, location: { page: "show", id: "section" + (isTemplate ? "_template" : "") } })
    }

    $: activeProjectParent = $activeProject ? currentProject?.parent || "" : ""
    $: projectReadOnly = readOnly || profile[activeProjectParent] === "read" || tree.find((a) => a.id === activeProjectParent)?.readOnly

    $: projectItemsList = currentProject?.shows || []

    $: lessVisibleSection = projectItemsList.length > 10 || projectItemsList.length < 1 || projectItemsList.some((a) => a.type === "section")

    let shouldPasteText = false
    $: if (currentProject && !currentProject.shows?.length) checkClipboard()
    function checkClipboard() {
        shouldPasteText = false
        navigator.clipboard
            .readText()
            .then((text) => {
                const lines = text.split("\n")
                if (lines.length > 5 && lines.length <= 30) shouldPasteText = true
            })
            .catch(() => {
                shouldPasteText = false
            })
    }

    let splittedProjectsList: { color: string; items: ProjectShowRef[] }[] = []
    $: if (projectItemsList) splitProjectItemsToSections()
    function splitProjectItemsToSections() {
        splittedProjectsList = []

        projectItemsList.forEach((a, index) => {
            // Cannot create property 'index' on string 'uid'
            if (typeof a !== "object") return

            const previousItem = projectItemsList[index - 1]

            if (!splittedProjectsList.at(-1)) newSection()
            else if (a.type === "section" && (a.color || previousItem?.type === "section")) newSection()
            else if (previousItem?.type !== "section" && a.type !== "section" && a.type !== previousItem?.type) {
                if (splittedProjectsList.at(-1)?.color === "") newSection()
                else splittedProjectsList.at(-1)!.items.push({ type: "DIVIDER", id: "" })
            }

            a.index = index
            splittedProjectsList.at(-1)!.items.push(a)

            function newSection() {
                splittedProjectsList.push({ color: a.color || "", items: [] })
            }
        })
    }

    // function createShow() {
    //     activePopup.set("show")
    //     openDrawer("shows")
    // }
    function openSearch(page: string) {
        openDrawer(page)
        triggerFunction("drawer_search")
    }

    onMount(() => {
        // convert section times in title to actual times
        projects.update((a) => {
            if (!a[$activeProject || ""]?.shows) return a

            a[$activeProject!].shows = a[$activeProject!].shows.map((item) => {
                if (item.type !== "section") return item

                // prefixed clock time, like "12:00 Title"
                const regex = /^(\d{1,2}:\d{2})\s+(.*)$/
                const match = (item.name || "").match(regex)
                if (match) {
                    item.data = { ...(item.data || {}), time: match[1] }
                    item.name = match[2]
                }

                return item
            })

            return a
        })
    })

    // update today
    let today = new Date()
    const interval = setInterval(() => {
        today = new Date()
    }, 1000)
    onDestroy(() => clearInterval(interval))

    let closestTime = 0
    $: {
        closestTime = 0
        projectItemsList?.find((a) => {
            const timeLeft = getTimeUntilClock(a.data?.time, today)
            if (timeLeft > 0 && (!closestTime || timeLeft < closestTime)) closestTime = timeLeft
        })
    }

    // remove files already in project - max 5
    $: recommended = $recentFiles.projectMedia
        .filter((a) => !projectItemsList.find((b) => b.id === a))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 5)

    // "Add to project" button

    let canAddToProject = false
    $: if ($contextActive && $selected) checkCanAddToProject()
    else canAddToProject = false
    const validIds = ["show_drawer", "player", "media", "audio", "overlay"]

    function checkCanAddToProject() {
        canAddToProject = false
        if (readOnly || !projectId || !validIds.includes($selected?.id || "")) return
        canAddToProject = true
    }

    function addSelectedToProject() {
        if (readOnly || !projectId || !validIds.includes($selected.id || "")) return

        let data = clone($selected.data)
        if (!data?.length) return

        if ($selected.id === "overlay") data = data.map((id: string) => ({ id, type: "overlay" }))
        else if ($selected.id === "player") data = data.map((id: string) => ({ id, type: "player", data: { type: $playerVideos[id]?.type, id: $playerVideos[id]?.id, name: $playerVideos[id]?.name } }))
        else if ($selected.id === "audio") data = data.filter((a) => a.path).map(({ path, name }) => ({ id: path, name, type: "audio" }))
        else if ($selected.id === "media")
            data = data
                .filter((a) => a.path)
                .map(({ path, name }) => ({
                    id: path,
                    name,
                    type: getMediaType(path.slice(path.lastIndexOf(".") + 1, path.length))
                }))

        data.forEach(addProjectItem)
        contextActive.set(false)
    }

    let addMenuOpen = false

    function mousedown(e: any) {
        if (!e.target.closest(".addMenu") && !e.target.closest(".addButton")) addMenuOpen = false
    }
</script>

<svelte:window on:mousedown={mousedown} />

<div id="projectArea" class="list {projectReadOnly ? '' : 'context #project'}">
    <Autoscroll {offset} bind:scrollElem timeout={150}>
        <DropArea id="project" selectChildren let:fileOver file>
            {#if projectItemsList.length}
                {#each splittedProjectsList as splittedItemsList}
                    <div class="listSection" style="--border-color: {splittedItemsList.color};">
                        {#each splittedItemsList.items as show, i}
                            {@const index = show.index}
                            {@const triggerAction = show.data?.settings?.triggerAction || $special.sectionTriggerAction}
                            {@const pcoLink = !!$shows[show.id]?.quickAccess?.pcoLink}
                            {@const isFirst = i === 0}
                            {@const isLast = i === splittedItemsList.items.length - 1}
                            {@const borderRadiusStyle = `${isFirst ? "border-top-right-radius: 10px;" : ""}${isLast ? "border-bottom-right-radius: 10px;" : ""}`}
                            {@const sectionTime = show.data?.time ? getTimeUntilClock(show.data.time, today) : 0}
                            {@const isActive = show.type === "section" ? ($focusMode ? $activeFocus.id === show.id : $activeShow?.id === show.id) : false}
                            {@const isLocked = show.type === "section" && currentProject?.sectionsLocked}

                            {#if show.type === "DIVIDER"}
                                <div style="border-top: 1px solid var(--primary-lighter);margin: 5px 0;"></div>
                            {:else}
                                <SelectElem id="show" dropAbove={isFirst} triggerOnHover data={{ ...show, name: show.name || removeExtension(getFileName(show.id)), index }} {fileOver} borders="edges" trigger="column" draggable={!isLocked} selectable={!isLocked}>
                                    {#if show.type === "section"}
                                        <MaterialButton
                                            {isActive}
                                            class="section {projectReadOnly || isLocked ? '' : `context #project_section ${show.color ? 'color-border' : ''}`}"
                                            style="{borderRadiusStyle}justify-content: left;background-color: var(--primary-darkest);border-top: 1px solid var(--primary-lighter);padding: 0.1em 1em;{$fullColors ? `background-color: ${show.color || 'var(--primary-darker)'} !important;color: ${getContrast(show.color || '')};` : `border-bottom: 1px solid ${show.color || 'transparent'} !important;`}"
                                            on:click={(e) => {
                                                if (e.detail.ctrl) return
                                                if ($focusMode) activeFocus.set({ id: show.id, index, type: show.type })
                                                else activeShow.set({ ...show, index })
                                            }}
                                            tab
                                        >
                                            {#if sectionTime}
                                                <span style="font-weight: normal;">
                                                    <span style="opacity: 0.7;">{show.data.time}</span>
                                                    <!-- && sectionTime < 3600 -->
                                                    {#if sectionTime > 0 && closestTime === sectionTime}
                                                        <span style="color: var(--secondary);">{joinTimeBig(sectionTime)}</span>
                                                    {/if}
                                                </span>
                                            {/if}

                                            <p style="min-height: 10px;max-width: 97%;">
                                                {#if show.name?.length}
                                                    {show.name}
                                                {:else}
                                                    <span style="opacity: 0.5;"><T id="main.unnamed" /></span>
                                                {/if}
                                            </p>

                                            {#if show.notes?.length}
                                                <p style="opacity: 0.5;font-weight: normal;font-size: 0.9em;max-width: 50%;">{show.notes}</p>
                                            {/if}

                                            {#if triggerAction && $actions[triggerAction]}
                                                <span style="display: flex;position: absolute;inset-inline-end: 7px;" data-title={$actions[triggerAction].name}>
                                                    <Icon id={getActionIcon(triggerAction)} size={0.8} white />
                                                </span>
                                            {/if}

                                            {#if isActive}
                                                <span class="arrow">
                                                    <Icon id="next" white />
                                                </span>
                                            {/if}
                                        </MaterialButton>
                                    {:else}
                                        <ShowButton id={show.id} {show} {index} class={projectReadOnly ? "" : `context #${pcoLink ? "pco_item__" : ""}project_${getContextMenuId(show.type)}`} style={borderRadiusStyle} icon isProject />
                                    {/if}
                                </SelectElem>
                            {/if}
                        {/each}
                    </div>
                {/each}

                <!-- suggestions -->
                {#if recommended.length}
                    <div class="section" style="margin-top: 50px;border-top: 1px solid var(--primary-lighter);background-color: var(--primary-darkest);padding: 2px 18px;display: flex;justify-content: space-between;align-items: center;">
                        <T id="media.recommended" />

                        <MaterialButton
                            class="show"
                            style="padding: 0.2em;border-radius: 2px;border-left: none;min-height: unset;"
                            on:click={() => {
                                recentFiles.update((a) => {
                                    a.cleared = [...a.cleared, ...recommended]
                                    return a
                                })
                                updateRecentlyAddedFiles()
                            }}
                            title="clear.general"
                            tab
                        >
                            <Icon id="clear" size={0.9} white />
                        </MaterialButton>
                    </div>

                    <div class="listSection">
                        {#each recommended as path, i}
                            {@const name = getFileName(path)}
                            {@const type = getMediaType(getExtension(name))}
                            {@const isFirst = i === 0}
                            {@const isLast = i === recommended.length - 1}
                            {@const borderRadiusStyle = `${isFirst ? "border-top-right-radius: 10px;" : ""}${isLast ? "border-bottom-right-radius: 10px;" : ""}`}
                            {@const icon = type === "audio" ? "music" : type}

                            <MaterialButton class="show context #recent_file__project" style="justify-content: space-between;padding: 0.35em 0.8em;font-weight: normal;{borderRadiusStyle}" on:click={() => addToProject(null, [path])} title="context.addToProject: <b>{name}</b>" tab>
                                <span style="display: flex;align-items: center;gap: 8px;">
                                    <Icon id={icon} size={0.9} white right />
                                    <p style="min-height: 10px;">{removeExtension(name)}</p>
                                </span>
                                <Icon id="add" size={0.9} white right />
                            </MaterialButton>
                        {/each}
                    </div>
                {/if}
            {:else}
                <Center absolute>
                    <span style="opacity: 0.5;"><T id="empty.general" /></span>

                    {#if shouldPasteText}
                        <span style="padding-top: 20px" class="buttons">
                            <MaterialButton variant="outlined" title="actions.import: formats.clipboard" on:click={clipboardToProject}>
                                <Icon id="paste" white />
                                <T id="formats.clipboard" />
                            </MaterialButton>
                        </span>
                    {/if}
                </Center>
            {/if}
        </DropArea>
    </Autoscroll>

    {#if canAddToProject}
        <div class="addToProject" role="none" on:mousedown={addSelectedToProject} transition:fade={{ duration: 50 }}>
            <Icon id="add" size={2} white />
            <T id="context.addToProject" />
        </div>
    {/if}
</div>

{#if projectId && !$projectView && !$focusMode && !recentlyUsedList.length && !projectReadOnly}
    {#if addMenuOpen}
        <!-- new show, new media, new PDF/PPT?, new scripture, new section -->
        <div class="addMenu" transition:slide={{ duration: 100 }} role="none" on:click={() => (addMenuOpen = false)}>
            <!-- createShow -->
            <MaterialButton variant="outlined" icon="slide" title="tooltip.show" on:click={() => openSearch("shows")}>
                <div class="label">
                    <p><T id="formats.show" /></p>
                    <!-- <p class="description" data-title={translateText("tabs.shows_info")}><T id="tabs.shows_info" /></p> -->
                </div>

                <div class="actionType">
                    <Icon id="search" size={0.7} white />
                </div>
            </MaterialButton>

            {#if $drawerTabsData.scripture?.enabled !== false}
                <MaterialButton variant="outlined" icon="scripture" title="new.scripture" on:click={() => openSearch("scripture")} white>
                    <div class="label">
                        <p><T id="tabs.scripture" /></p>
                    </div>

                    <div class="actionType">
                        <Icon id="search" size={0.7} white />
                    </div>
                </MaterialButton>
            {/if}

            <!-- WIP popup -->
            <!-- images/videos, (audio), YouTube, webpages? -->
            <MaterialButton variant="outlined" icon="image" title="guide_description.media" on:click={() => openSearch("media")} white>
                <div class="label">
                    <p><T id="items.media" /></p>
                </div>

                <div class="actionType">
                    <Icon id="search" size={0.7} white />
                </div>
            </MaterialButton>

            <MaterialButton
                variant="outlined"
                icon="import"
                title="popup.import"
                on:click={() => {
                    popupData.set({ mode: "project" })
                    activePopup.set("import")
                }}
                white
            >
                <div class="label">
                    <p><T id="popup.import" /></p>
                </div>
            </MaterialButton>

            <MaterialButton variant="outlined" icon="section" title="new.section" disabled={currentProject?.sectionsLocked} on:click={addSection} white={lessVisibleSection}>
                <div class="label">
                    <p><T id="new.section" /></p>
                    <!-- <p class="description" data-title={translateText("tabs.sections_info")}><T id="tabs.sections_info" /></p> -->
                </div>
            </MaterialButton>
        </div>
    {/if}

    <FloatingInputs gradient style="width: 50px;height: 50px;border: none;">
        <!-- {addMenuOpen ? 'border-color: white;' : ''} -->
        <MaterialButton class="addButton" title="context.addToProject" style="width: 50px;height: 50px;" on:click={() => (addMenuOpen = !addMenuOpen)} on:dblclick={() => (addMenuOpen ? null : addSection())}>
            <Icon id="add" size={1.5} style={addMenuOpen ? "transform: rotate(135deg);" : ""} white />
        </MaterialButton>
    </FloatingInputs>
{/if}

<style>
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

    .listSection {
        display: flex;
        flex-direction: column;

        margin: 8px 0;
        margin-right: 5px;

        background-color: var(--primary-darker);

        --border-color: var(--primary-lighter);
        border: 1px solid var(--border-color);
        border-left: 0;

        border-radius: 10px;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
    }

    .list#projectArea :global(.droparea) {
        /* "new section" button */
        padding-bottom: 57px;
    }

    .listSection :global(button) {
        outline-offset: -2px;
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

    /* #projectArea :global(button.color-border) {
        border-bottom: 2px solid var(--border-color);
        outline-color: var(--border-color);
    } */

    .buttons {
        display: flex;
        flex-direction: column;
        gap: 3px;
    }
    .buttons :global(button) {
        justify-content: start;
        padding: 8px 14px;
        background-color: var(--primary-darker) !important;
    }

    .addToProject {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;

        background-color: rgba(0, 0, 0, 0.3);
        cursor: pointer;

        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;

        z-index: 200;
    }

    .arrow {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);

        opacity: 0.4;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* add menu */

    .addMenu {
        position: absolute;
        bottom: 70px; /* 10px + 50px + 10px */
        right: 12px;

        display: flex;
        flex-direction: column;
        gap: 2px;

        /* background-color: var(--primary);
        padding: 5px;
        border-radius: 24px;
        border: 1px solid var(--primary-lighter);

        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3); */
    }

    .addMenu :global(button) {
        justify-content: start;
        padding: 10px 16px;

        border-radius: 50px;

        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);

        backdrop-filter: blur(10px);
    }

    .addMenu .label {
        display: flex;
        flex-direction: column;
        gap: 2px;

        align-items: flex-start;
    }
    /* .addMenu .description {
        font-size: 0.8em;
        opacity: 0.7;

        max-width: 180px;
    } */

    .actionType {
        position: absolute;
        top: 50%;
        right: 14px;
        transform: translateY(-50%);

        display: flex;
        align-items: center;

        opacity: 0.2;
    }
</style>
