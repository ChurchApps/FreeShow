<script lang="ts">
    import type { ProjectShowRef, Tree } from "../../../types/Projects"
    import { ShowType } from "../../../types/Show"
    import { actions, activeFocus, activeProject, activeShow, drawer, focusMode, fullColors, labelsDisabled, projects, projectView, shows, special } from "../../stores"
    import { getAccess } from "../../utils/profile"
    import { getActionIcon } from "../actions/actions"
    import { getContrast } from "../helpers/color"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import { getFileName, removeExtension } from "../helpers/media"
    import T from "../helpers/T.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import ShowButton from "../inputs/ShowButton.svelte"
    import Autoscroll from "../system/Autoscroll.svelte"
    import Center from "../system/Center.svelte"
    import DropArea from "../system/DropArea.svelte"
    import SelectElem from "../system/SelectElem.svelte"

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

    $: lessVisibleSection = projectItemsList.length > 10 || !!projectItemsList.find((a) => a.type === "section")

    let splittedProjectsList: { color: string; items: ProjectShowRef[] }[] = []
    $: if (projectItemsList) splitProjectItemsToSections()
    function splitProjectItemsToSections() {
        splittedProjectsList = []

        projectItemsList.forEach((a, index) => {
            if (a.type === "section" && (a.color || projectItemsList[index - 1]?.type === "section")) splittedProjectsList.push({ color: a.color || "", items: [] })
            if (!splittedProjectsList.at(-1)) splittedProjectsList.push({ color: "", items: [] })

            a.index = index
            splittedProjectsList.at(-1)!.items.push(a)
        })
    }
</script>

<div id="projectArea" class="list {projectReadOnly ? '' : 'context #project'}">
    <Autoscroll {offset} bind:scrollElem timeout={150}>
        <DropArea id="project" selectChildren let:fileOver file>
            {#if projectItemsList.length}
                {#each splittedProjectsList as projectItemsList}
                    <div class="listSection" style="--border-color: {projectItemsList.color};">
                        {#each projectItemsList.items as show, i}
                            {@const index = show.index}
                            {@const triggerAction = show.data?.settings?.triggerAction || $special.sectionTriggerAction}
                            {@const pcoLink = !!$shows[show.id]?.quickAccess?.pcoLink}
                            {@const isFirst = i === 0}
                            {@const isLast = i === projectItemsList.items.length - 1}
                            {@const borderRadiusStyle = `${isFirst ? "border-top-right-radius: 10px;" : ""}${isLast ? "border-bottom-right-radius: 10px;" : ""}`}

                            <SelectElem id="show" dropAbove={isFirst} triggerOnHover data={{ ...show, name: show.name || removeExtension(getFileName(show.id)), index }} {fileOver} borders="edges" trigger="column" draggable>
                                {#if show.type === "section"}
                                    <MaterialButton
                                        isActive={$focusMode ? $activeFocus.id === show.id : $activeShow?.id === show.id}
                                        class="section {projectReadOnly ? '' : `context #project_section__project ${show.color ? 'color-border' : ''}`}"
                                        style="{borderRadiusStyle}justify-content: center;background-color: var(--primary-darkest);border-top: 1px solid var(--primary-lighter);padding: 0.1em;{$fullColors
                                            ? `background-color: ${show.color || 'var(--primary-darker)'} !important;color: ${getContrast(show.color || '')};`
                                            : `border-bottom: 1px solid ${show.color || 'transparent'} !important;`}"
                                        on:click={(e) => {
                                            if (e.detail.ctrl) return
                                            if ($focusMode) activeFocus.set({ id: show.id, index, type: show.type })
                                            else activeShow.set({ ...show, index })
                                        }}
                                        tab
                                    >
                                        <p style="min-height: 10px;">
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
                                    </MaterialButton>
                                {:else}
                                    <ShowButton id={show.id} {show} {index} class={projectReadOnly ? "" : `context #${pcoLink ? "pco_item__" : ""}project_${getContextMenuId(show.type)}__project`} style={borderRadiusStyle} icon />
                                {/if}
                            </SelectElem>
                        {/each}
                    </div>
                {/each}
            {:else}
                <Center faded>
                    <T id="empty.general" />
                </Center>
            {/if}
        </DropArea>
    </Autoscroll>
</div>

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
</style>
