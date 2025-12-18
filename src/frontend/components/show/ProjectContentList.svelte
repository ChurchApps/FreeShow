<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { ProjectShowRef, Tree } from "../../../types/Projects"
    import { ShowType } from "../../../types/Show"
    import { actions, activeFocus, activePopup, activeProject, activeShow, drawer, focusMode, fullColors, labelsDisabled, projects, projectView, shows, special } from "../../stores"
    import { getAccess } from "../../utils/profile"
    import { getActionIcon } from "../actions/actions"
    import { getTimeUntilClock } from "../drawer/timers/timers"
    import { openDrawer } from "../edit/scripts/edit"
    import { getContrast } from "../helpers/color"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { getFileName, removeExtension } from "../helpers/media"
    import T from "../helpers/T.svelte"
    import { joinTimeBig } from "../helpers/time"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import ShowButton from "../inputs/ShowButton.svelte"
    import Autoscroll from "../system/Autoscroll.svelte"
    import Center from "../system/Center.svelte"
    import DropArea from "../system/DropArea.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import { triggerFunction } from "../../utils/common"

    export let tree: Tree[]
    export let recentlyUsedList: any[] = []

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

    function getContextMenuId(type: ShowType | undefined) {
        if ((type || "show") === "show") return "show"
        if (type === "video" || type === "image") return "media"
        return type
    }

    function addSection() {
        let activeShowIndex = $activeShow?.index !== undefined ? $activeShow?.index + 1 : null
        let index: number = activeShowIndex ?? projectItemsList.length ?? 0
        history({ id: "UPDATE", newData: { key: "shows", index }, oldData: { id: $activeProject }, location: { page: "show", id: "section" } })
    }

    $: activeProjectParent = $activeProject ? $projects[$activeProject]?.parent : ""
    $: projectReadOnly = readOnly || profile[activeProjectParent] === "read" || tree.find((a) => a.id === activeProjectParent)?.readOnly

    $: projectItemsList = $projects[$activeProject || ""]?.shows || []

    $: lessVisibleSection = projectItemsList.length > 10 || projectItemsList.length < 1 || projectItemsList.some((a) => a.type === "section")

    let splittedProjectsList: { color: string; items: ProjectShowRef[] }[] = []
    $: if (projectItemsList) splitProjectItemsToSections()
    function splitProjectItemsToSections() {
        splittedProjectsList = []

        projectItemsList.forEach((a, index) => {
            // Cannot create property 'index' on string 'uid'
            if (typeof a !== "object") return

            if (a.type === "section" && (a.color || projectItemsList[index - 1]?.type === "section")) splittedProjectsList.push({ color: a.color || "", items: [] })
            if (!splittedProjectsList.at(-1)) splittedProjectsList.push({ color: "", items: [] })

            a.index = index
            splittedProjectsList.at(-1)!.items.push(a)
        })
    }

    function createShow() {
        activePopup.set("show")
        openDrawer("shows")
    }
    function openSearch() {
        openDrawer("shows")
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
</script>

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

                            <SelectElem id="show" dropAbove={isFirst} triggerOnHover data={{ ...show, name: show.name || removeExtension(getFileName(show.id)), index }} {fileOver} borders="edges" trigger="column" draggable>
                                {#if show.type === "section"}
                                    <MaterialButton
                                        isActive={$focusMode ? $activeFocus.id === show.id : $activeShow?.id === show.id}
                                        class="section {projectReadOnly ? '' : `context #project_section__project ${show.color ? 'color-border' : ''}`}"
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

                                        <p style="min-height: 10px;">
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
                                            <span style="display: flex;position: absolute;inset-inline-end: 5px;" data-title={$actions[triggerAction].name}>
                                                <Icon id={getActionIcon(triggerAction)} size={0.8} white />
                                            </span>
                                        {/if}
                                    </MaterialButton>
                                {:else}
                                    <ShowButton id={show.id} {show} {index} class={projectReadOnly ? "" : `context #${pcoLink ? "pco_item__" : ""}project_${getContextMenuId(show.type)}__project`} style={borderRadiusStyle} icon />
                                {/if}
                            </SelectElem>
                        {/each}
                    </div>
                {/each}
            {:else}
                <Center absolute>
                    <span style="opacity: 0.5;"><T id="empty.general" /></span>

                    <span style="padding-top: 20px" class="buttons">
                        <MaterialButton variant="outlined" icon="add" title="tooltip.show [Ctrl+N]" on:click={createShow}>
                            <T id="new.show" />
                        </MaterialButton>

                        <!-- <MaterialButton variant="outlined" title="actions.import [Ctrl+I]" on:click={() => activePopup.set("import")}>
                            <Icon id="import" white />
                            <T id="actions.import" />
                        </MaterialButton> -->

                        {#if Object.keys($shows).length > 10}
                            <MaterialButton variant="outlined" title="tabs.search_tip [Ctrl+F]" on:click={openSearch}>
                                <Icon id="search" white />
                                <T id="main.search" />
                            </MaterialButton>
                        {/if}
                    </span>
                </Center>
            {/if}
        </DropArea>
    </Autoscroll>
</div>

{#if $activeProject && !$projectView && !$focusMode && !recentlyUsedList.length && !projectReadOnly}
    <FloatingInputs onlyOne round={lessVisibleSection}>
        <MaterialButton icon="section" title="new.section" on:click={addSection} white={lessVisibleSection}>
            {#if !lessVisibleSection && !$labelsDisabled}<T id="new.section" />{/if}
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

        margin: 10px 0;
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
        padding-bottom: 50px;
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
</style>
