<!-- THIS MODE WILL SHOW ALL THE ELEMENTS IN YOUR PROJECT! -->

<script lang="ts">
    import { activeFocus, activeProject, projects, resized } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Loader from "../../main/Loader.svelte"
    import Center from "../../system/Center.svelte"
    import { getAllProjectItems } from "./focus"
    import FocusItem from "./FocusItem.svelte"

    $: projectId = $activeProject || ""
    $: project = $projects[projectId]

    let projectUpdating: any = null
    $: if (project) initScroll()
    function initScroll() {
        if (projectUpdating) clearTimeout(projectUpdating)
        projectUpdating = setTimeout(() => {
            if (isScrolling) clearTimeout(isScrolling)
            isScrolling = null
            projectUpdating = null
            // scrollToActive()
            if ($activeFocus.id) activeFocus.set({ ...active, index: project.shows.findIndex((a) => a.id === active.id) })
        }, 100)
    }

    let listElem: any = null
    let fromTop: number = 0 // 25px on Windows

    $: active = $activeFocus
    let scrollingToActive: any = null
    $: if (active) scrollToActive()
    function scrollToActive() {
        if (!listElem || isScrolling || projectUpdating) return

        let index = active.index
        if (index === undefined) index = project.shows.findIndex((a) => a.id === active.id)

        let id = "id_" + getId(active.id) + "_" + index
        let elem = listElem.querySelector("#" + id)
        let elemTop = elem?.offsetTop || 0

        // smooth scrolling time
        if (scrollingToActive) clearTimeout(scrollingToActive)
        scrollingToActive = setTimeout(() => {
            scrollingToActive = null
        }, 3000)

        // scroll to active elem!
        listElem.closest(".center")?.scrollTo(0, elemTop - fromTop)
    }

    $: if (listElem) setScrollListener()
    function setScrollListener() {
        if (!listElem.closest(".center")) return

        fromTop = listElem.children[0]?.offsetTop || 0
        listElem.closest(".center").onscroll = (e) => scrolling(e)
    }

    $: sidebarClosed = $resized.leftPanel < 5

    let isScrolling: any = null
    function scrolling(e: any) {
        if (scrollingToActive || !listElem || !project || projectUpdating) return

        if (isScrolling) clearTimeout(isScrolling)
        isScrolling = setTimeout(() => {
            isScrolling = null
        }, 500)

        if (sidebarClosed) return

        let scrollTop = e.target.scrollTop

        let focusedId = ""
        let names = listElem.querySelectorAll(".name")
        ;[...names].forEach((a) => {
            let top = a.offsetTop - fromTop
            if (top <= scrollTop) focusedId = a.id
        })

        if (!focusedId) return

        // set to activeFocus
        let index = Number(focusedId.split("_")[2])
        activeFocus.set({ id: project.shows[index].id, index })
    }

    function getId(text: string) {
        return text.replace(/[^a-zA-Z0-9]+/g, "")
    }
</script>

{#await getAllProjectItems(project.shows)}
    <Center>
        <Loader />
    </Center>
{:then list}
    {#if list.length}
        <div class="list" bind:this={listElem}>
            {#each list as item, i}
                <div class="name" id={"id_" + getId(item.id) + "_" + i}>
                    <Icon id={item.icon || "noIcon"} custom={(item.type || "show") === "show"} white right />
                    <p>{item.name}</p>
                </div>
                <FocusItem show={item} />
            {/each}
        </div>

        <!-- scroll to active if list updates -->
        <!-- <span style="font-size: 0;position: absolute;">{setTimeout(scrollToActive, 100)}</span> -->
        <span style="font-size: 0;position: absolute;">{console.log("LOADED")}</span>
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
