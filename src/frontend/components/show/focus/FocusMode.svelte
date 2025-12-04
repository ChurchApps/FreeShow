<!-- THIS MODE WILL SHOW ALL THE ELEMENTS IN YOUR PROJECT! -->

<script lang="ts">
    import { onMount } from "svelte"
    import type { ProjectShowRef } from "../../../../types/Projects"
    import { activeFocus, activeProject, outputs, projects, resized } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import { getActiveOutputs } from "../../helpers/output"
    import T from "../../helpers/T.svelte"
    import Loader from "../../main/Loader.svelte"
    import Center from "../../system/Center.svelte"
    import { getAllProjectItems } from "./focus"
    import FocusItem from "./FocusItem.svelte"

    $: projectId = $activeProject || ""
    $: project = $projects[projectId]

    let projectUpdating: any = null
    $: if (project?.shows) initScroll()
    function initScroll() {
        if (projectUpdating) clearTimeout(projectUpdating)
        projectUpdating = setTimeout(() => {
            if (isScrolling) clearTimeout(isScrolling)
            isScrolling = null
            projectUpdating = null
            // scrollToActive()
            if ($activeFocus.id) activeFocus.set({ ...active, index: project.shows.findIndex(a => a.id === active.id) })
        }, 100)
    }

    let listElem: HTMLElement | undefined
    let fromTop = 0 // 25px on Windows

    $: outputId = getActiveOutputs($outputs, true, true, true)[0] || ""
    $: output = $outputs[outputId]
    $: outputShowId = output?.out?.slide?.id
    $: outputIndex = output?.out?.slide?.index

    $: active = $activeFocus
    let scrollingToActive: any = null
    // auto scroll to active slide when show or output changes
    $: if (active || outputIndex !== undefined) scrollToActive()
    function scrollToActive() {
        if (!listElem || isScrolling || projectUpdating) return

        let index = active.index
        if (index === undefined) index = project.shows.findIndex(a => a.id === (outputShowId ?? active.id))

        let id = "id_" + getId(outputShowId ?? active.id) + "_" + index
        let elem = listElem.querySelector("#" + id) as HTMLElement
        let elemTop = elem?.offsetTop || 0
        const slide = elem?.querySelector(".grid")?.children[outputIndex || 0] as HTMLElement
        let slideTop = elemTop + (slide?.offsetTop ?? elem?.offsetTop ?? 0)
        if (!slide) return

        // WIP scroll to active slide also if it's outside of view

        // don't scroll if already visible
        const currentScrollPos = listElem.closest(".center")?.scrollTop || 0
        const currentViewHeight = listElem.closest(".center")?.clientHeight || 0
        if (slideTop - currentScrollPos > -250 && slideTop - currentScrollPos < currentViewHeight - 200) return

        // smooth scrolling time
        if (scrollingToActive) clearTimeout(scrollingToActive)
        scrollingToActive = setTimeout(() => {
            scrollingToActive = null
        }, 3000)

        // scroll to active elem!
        const MARGIN = 80
        listElem.closest(".center")?.scrollTo(0, slideTop - fromTop - MARGIN)
    }

    $: if (listElem) setScrollListener()
    function setScrollListener() {
        if (!listElem?.closest(".center")) return

        fromTop = (listElem.children[0] as HTMLElement)?.offsetTop || 0
        if (listElem.closest(".center")) (listElem.closest(".center") as HTMLElement).onscroll = e => scrolling(e)
    }

    $: sidebarClosed = $resized.leftPanel < 5

    let isScrolling: any = null
    function scrolling(e: any) {
        if (scrollingToActive || !listElem || !project?.shows || projectUpdating) return

        if (isScrolling) clearTimeout(isScrolling)
        isScrolling = setTimeout(() => {
            isScrolling = null
        }, 500)

        if (sidebarClosed) return

        let scrollTop = e.target.scrollTop

        let focusedId = ""
        let names = listElem.querySelectorAll(".name")
        ;[...names].forEach(a => {
            let top = (a as HTMLElement).offsetTop - fromTop
            if (top <= scrollTop) focusedId = a.id
        })

        if (!focusedId) return

        // set to activeFocus
        let index = Number(focusedId.split("_")[2])
        let projectItem = project.shows[index]
        if (!projectItem) return

        activeFocus.set({ id: projectItem.id, index, type: projectItem.type })
    }

    function getId(text: string) {
        if (typeof text !== "string") return ""
        return text.replace(/[^a-zA-Z0-9]+/g, "")
    }

    // don't refresh list unless count changes
    let projectsItemsList: ProjectShowRef[] = []
    onMount(updateProjectItemsList)
    $: projectItems = project?.shows?.length || 0
    $: if (projectItems) updateProjectItemsList()
    function updateProjectItemsList() {
        projectsItemsList = project?.shows || []
    }
</script>

{#await getAllProjectItems(projectsItemsList)}
    <Center>
        <Loader />
    </Center>
{:then list}
    {#if list.length}
        <div class="list" bind:this={listElem}>
            {#each list as item, i}
                <div id={"id_" + getId(item.id) + "_" + i}>
                    <div class="name" style={item.color ? `border-bottom: 2px solid ${item.color}` : ""}>
                        <Icon id={item.icon || "noIcon"} custom={(item.type || "show") === "show"} white right />
                        <p>{item.name}</p>
                    </div>
                    <FocusItem show={{ ...item, index: i }} />
                </div>
            {/each}
        </div>
    {:else}
        <Center faded>
            <T id="empty.general" />
        </Center>
    {/if}
{/await}

<style>
    .list {
        display: flex;
        flex-direction: column;
    }

    .name {
        width: 100%;
        background-color: var(--primary-darkest);
        padding: 4px 8px;
        font-weight: 600;

        display: flex;
        align-items: center;
    }
</style>
