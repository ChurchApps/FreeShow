<script lang="ts">
    import { onMount } from "svelte"
    import type { TabsObj } from "../../../../types/Tabs"
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import Tabs from "../../../common/components/Tabs.svelte"
    import { getGroupName } from "../../../common/util/show"
    import { translate } from "../../util/helpers"
    import { GetLayout, getNextSlide, nextSlide } from "../../util/output"
    import { send } from "../../util/socket"
    import { _set, active, activeProject, activeShow, dictionary, isCleared, outLayout, outShow, outSlide, projects, projectsOpened, scriptures, shows, textCache } from "../../util/stores"
    import AddGroups from "../pages/AddGroups.svelte"
    import GroupsEdit from "../pages/GroupsEdit.svelte"
    import Project from "../pages/Project.svelte"
    import Scripture from "../pages/Scripture.svelte"
    import ShowContent from "../pages/ShowContent.svelte"
    import Shows from "../pages/Shows.svelte"
    import TextEdit from "../pages/TextEdit.svelte"
    import Clear from "../show/Clear.svelte"
    import Slide from "../show/Slide.svelte"
    import Slides from "../show/Slides.svelte"

    $: outNumber = $outSlide ?? -1

    let transition: any = { type: "fade", duration: 500 }

    $: layout = $outShow ? GetLayout($outShow, $outLayout) : null
    $: _set("layout", layout)

    $: totalSlides = layout ? layout.length : 0

    ///////

    let activeTab: string = "project"

    // TABS

    let tabs: TabsObj = {}
    $: tabs = {
        shows: { name: translate("remote.shows", $dictionary), icon: "search" },
        scripture: { name: translate("tabs.scripture", $dictionary), icon: "scripture" },
        project: { name: translate("remote.project", $dictionary), icon: "project" }
    }
    $: tabsDisabled = {
        shows: $shows.length,
        scripture: Object.keys($scriptures).length,
        project: $projects.length || $activeProject
    }

    // SHOW

    let scrollElem: HTMLElement | undefined
    // auto scroll
    $: {
        if (scrollElem && outNumber !== null && slideView === "lyrics") {
            let offset = (scrollElem.children[outNumber] as HTMLElement)?.offsetTop - scrollElem.offsetTop - 5
            scrollElem.scrollTo(0, offset - 50)
        }
    }

    const slidesViews: any = { grid: "lyrics", lyrics: "grid" }
    let slideView: string = "grid"

    // keyboard shortcuts
    let triggerScriptureSearch = false
    function keydown(e: KeyboardEvent) {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === "f") {
                e.preventDefault()
                if (activeTab !== "scripture") {
                    activeTab = "shows"
                    double({ detail: "shows" })
                } else {
                    triggerScriptureSearch = true
                }
                return
            }
        }
    }

    // click when focused
    function double(e: any) {
        let id = e.detail
        if (id === "shows") {
            ;(document.querySelector("#showSearch") as any)?.select()
        } else if (id === "project") {
            _set("projectsOpened", !$projectsOpened)
        } else if (id === "scripture") {
            activeTab = ""
            setTimeout(() => (activeTab = "scripture"))
        }
    }

    function changeLayout(layoutId: string) {
        send("API:change_layout", { showId: $activeShow?.id, layoutId })
    }

    $: previousId = ""
    $: if ($activeShow?.id !== previousId) {
        groupsOpened = false
        addGroups = false
        previousId = $activeShow?.id || ""
    }

    // GROUPS EDIT

    let groupsOpened: boolean = false
    let addGroups: boolean = false

    // TEXT EDIT

    let editOpened: boolean = false
    let textValue = ""
    $: if (editOpened && $textCache[$activeShow?.id || ""]) setText()
    else reset()
    function reset() {
        textValue = ""
    }
    function setText() {
        textValue = $textCache[$activeShow?.id || ""]
    }
    function done() {
        if (addGroups) {
            addGroups = false
            return
        }

        if (groupsOpened) {
            groupsOpened = false
            addGroups = false
            return
        }

        editOpened = false
        if ($textCache[$activeShow?.id || ""] === textValue) return

        send("API:set_plain_text", { id: $activeShow?.id, value: textValue })
    }

    function getName(group: string, layoutSlideId: string, index: number) {
        const name = $activeShow ? getGroupName({ show: $activeShow, showId: $activeShow?.id || "" }, layoutSlideId, group, index, true) : ""
        return name || "—"
    }

    // FULLSCREEN

    let isFullscreen: boolean = false
    function toggleFullscreen() {
        isFullscreen = !isFullscreen
    }

    function playSlide(index: number) {
        if (!$activeShow) return

        const showId = $activeShow.id
        const layoutId = $activeShow.settings.activeLayout

        if ($outShow && showId === $outShow.id && layoutId === $outShow.settings.activeLayout && index === outNumber) {
            // reveal lines if it exists
            const ref = GetLayout($activeShow, $activeShow?.settings?.activeLayout)
            const revealExists = $activeShow.slides[ref[index]?.id]?.items?.find((item) => item.lineReveal || item.clickReveal)
            if (revealExists) {
                send("API:next_slide")
            }
            return
        }

        send("API:index_select_slide", { showId, layoutId, index })
        _set("outShow", $activeShow)
        // _set("outSlide", index) // ??
        // send("API:get_cleared") // ??
    }

    // RESIZERS
    let leftWidth: number = parseInt(localStorage.getItem("tablet.leftWidth") || "290", 10) || 290
    let rightWidth: number = parseInt(localStorage.getItem("tablet.rightWidth") || "290", 10) || 290
    const minPanel = 200
    const minCenter = 300
    const defaultWidth = 290
    const snapThreshold = 20 // pixels to snap

    function clampPersistedWidths() {
        const total = window.innerWidth
        const resizers = 12
        // Re-read in case values changed outside
        const storedLeft = parseInt(localStorage.getItem("tablet.leftWidth") || String(leftWidth), 10)
        const storedRight = parseInt(localStorage.getItem("tablet.rightWidth") || String(rightWidth), 10)
        if (!Number.isNaN(storedLeft)) leftWidth = storedLeft
        if (!Number.isNaN(storedRight)) rightWidth = storedRight
        // Clamp to available space and minimums
        leftWidth = Math.max(minPanel, Math.min(leftWidth, Math.max(minPanel, total - rightWidth - resizers - minCenter)))
        rightWidth = Math.max(minPanel, Math.min(rightWidth, Math.max(minPanel, total - leftWidth - resizers - minCenter)))
    }

    function persistWidths() {
        localStorage.setItem("tablet.leftWidth", String(leftWidth))
        localStorage.setItem("tablet.rightWidth", String(rightWidth))
    }

    let initializedWidths = false
    $: if (!initializedWidths) {
        clampPersistedWidths()
        initializedWidths = true
    }

    let dragging: "left" | "right" | null = null
    let startX = 0
    let startLeft = 0
    let startRight = 0
    let isSnapping = false

    function onPointerDownLeft(e: PointerEvent) {
        e.preventDefault()
        dragging = "left"
        isSnapping = false
        startX = e.clientX
        startLeft = leftWidth
        window.addEventListener("pointermove", onPointerMove)
        window.addEventListener("pointerup", onPointerUp, { once: true })
        window.addEventListener("pointercancel", onPointerUp, { once: true })
    }

    function onPointerDownRight(e: PointerEvent) {
        e.preventDefault()
        dragging = "right"
        isSnapping = false
        startX = e.clientX
        startRight = rightWidth
        window.addEventListener("pointermove", onPointerMove)
        window.addEventListener("pointerup", onPointerUp, { once: true })
        window.addEventListener("pointercancel", onPointerUp, { once: true })
    }
    function onPointerMove(e: PointerEvent) {
        if (!dragging) return
        e.preventDefault()

        const total = window.innerWidth
        const resizers = 12 // two resizers of 6px each
        const delta = e.clientX - startX

        if (dragging === "left") {
            let proposed = startLeft + delta
            const maxLeft = total - rightWidth - resizers - minCenter

            // Snap to default position
            if (Math.abs(proposed - defaultWidth) < snapThreshold) {
                proposed = defaultWidth
                isSnapping = true
            } else {
                isSnapping = false
            }

            leftWidth = Math.max(minPanel, Math.min(proposed, Math.max(minPanel, maxLeft)))
        } else if (dragging === "right") {
            let proposed = startRight - delta
            const maxRight = total - leftWidth - resizers - minCenter

            // Snap to default position
            if (Math.abs(proposed - defaultWidth) < snapThreshold) {
                proposed = defaultWidth
                isSnapping = true
            } else {
                isSnapping = false
            }

            rightWidth = Math.max(minPanel, Math.min(proposed, Math.max(minPanel, maxRight)))
        }
    }
    function onPointerUp() {
        dragging = null
        window.removeEventListener("pointermove", onPointerMove)
        persistWidths()
    }

    function onWindowResize() {
        // Recalculate panel widths when window resizes
        if (initializedWidths) {
            clampPersistedWidths()
        }
    }

    onMount(() => {
        window.addEventListener("resize", onWindowResize)
        return () => {
            window.removeEventListener("resize", onWindowResize)
            window.removeEventListener("pointermove", onPointerMove)
        }
    })
</script>

<svelte:window on:keydown={keydown} on:resize={clampPersistedWidths} />

{#if !isFullscreen}
    <div class="left" style={`width:${leftWidth}px`}>
        <div class="flex">
            {#if activeTab === "shows"}
                <Shows tablet />
            {:else if activeTab === "scripture"}
                <Scripture tablet bind:triggerScriptureSearch />
            {:else if activeTab === "project"}
                <Project />
            {/if}
        </div>

        <Tabs {tabs} bind:active={activeTab} disabled={tabsDisabled} on:double={double} icons />
    </div>
{/if}

{#if !isFullscreen}
    <div class="resizer" role="separator" aria-orientation="vertical" on:pointerdown={onPointerDownLeft} class:snapping={dragging === "left" && isSnapping}></div>
{/if}

<div class="center">
    {#if ($active.type || "show") === "show"}
        {#if $activeShow}
            <!-- <h2>{activeShow.name}</h2> -->

            {#if groupsOpened || editOpened}
                {#if groupsOpened}
                    {#if addGroups}
                        <AddGroups show={$activeShow} on:added={() => (addGroups = false)} />
                    {:else}
                        <GroupsEdit show={$activeShow} />
                    {/if}
                {:else}
                    <TextEdit bind:value={textValue} />
                {/if}

                <div class="buttons">
                    {#if groupsOpened && !addGroups}
                        <Button on:click={() => (addGroups = true)} style="width: 100%;" center dark>
                            <Icon id="add" right />
                            {translate("settings.add", $dictionary)}
                        </Button>
                    {/if}

                    <Button on:click={done} style="width: 100%;" center dark>
                        <Icon id={addGroups ? "back" : "check"} right />
                        {translate(`actions.${addGroups ? "back" : "done"}`, $dictionary)}
                    </Button>
                </div>
            {:else}
                <div bind:this={scrollElem} class="scroll" style="height: 100%;overflow-y: auto;background-color: var(--primary-darker);scroll-behavior: smooth;display: flex;flex-direction: column;">
                    {#if slideView === "lyrics"}
                        {#each GetLayout($activeShow, $activeShow?.settings?.activeLayout) as layoutSlide, i}
                            {#if !layoutSlide.disabled}
                                <span
                                    style="padding: 5px;{$outShow?.id === $activeShow.id && outNumber === i ? 'background-color: rgba(0 0 0 / 0.6);' : ''}"
                                    role="button"
                                    tabindex="0"
                                    on:click={() => playSlide(i)}
                                    on:keydown={(e) => (e.key === "Enter" ? playSlide(i) : null)}
                                >
                                    <span class="group" style="opacity: 0.6;font-size: 0.8em;display: flex;justify-content: center;position: relative;">
                                        <span style="left: 0;position: absolute;">{i + 1}</span>
                                        <span>{$activeShow.slides[layoutSlide.id].group === null ? "" : getName($activeShow.slides[layoutSlide.id].group || "", layoutSlide.id, i)}</span>
                                    </span>
                                    {#each $activeShow.slides[layoutSlide.id].items as item}
                                        {#if item.lines}
                                            <div class="lyric" style="font-size: 1.1em;text-align: center;">
                                                {#each item.lines as line}
                                                    <div class="break">
                                                        {#each line.text || [] as text}
                                                            <span>{@html text.value}</span>
                                                        {/each}
                                                    </div>
                                                {/each}
                                            </div>
                                        {:else}
                                            <span style="opacity: 0.5;">—</span>
                                        {/if}
                                    {/each}
                                </span>
                            {/if}
                        {/each}
                    {:else}
                        <Slides {dictionary} {scrollElem} on:click={(e) => playSlide(e.detail)} outSlide={outNumber} columns={3} />
                    {/if}
                </div>

                {#if !isFullscreen}
                    <!-- TODO: change layout -->
                    <div class="layouts">
                        <div style="display: flex;">
                            {#each Object.keys($activeShow.layouts || {}) as id}
                                {@const layout = $activeShow.layouts[id]}
                                <Button on:click={() => changeLayout(id)} active={$activeShow.settings?.activeLayout === id}>
                                    {layout.name}
                                </Button>
                            {/each}
                        </div>

                        <div class="buttons">
                            <Button class="context #slideViews" on:click={() => (slideView = slidesViews[slideView])}>
                                <Icon size={1.3} id={slideView} white />
                            </Button>

                            <Button on:click={() => (groupsOpened = true)} center dark>
                                <Icon id="groups" right />
                                {translate("tools.groups", $dictionary)}
                            </Button>

                            <Button on:click={() => (editOpened = true)} center dark>
                                <Icon id="edit" right />
                                {translate("titlebar.edit", $dictionary)}
                            </Button>
                        </div>
                    </div>
                {/if}
            {/if}
        {:else}
            <Center faded>{translate("empty.show", $dictionary)}</Center>
        {/if}
    {:else}
        <ShowContent tablet />
    {/if}
</div>

{#if !isFullscreen}
    <div class="resizer" role="separator" aria-orientation="vertical" on:pointerdown={onPointerDownRight} class:snapping={dragging === "right" && isSnapping}></div>
{/if}

{#if !isFullscreen}
    <div class="right" style={`justify-content: space-between; width:${rightWidth}px`}>
        {#if !$isCleared.all}
            <div class="top flex">
                {#if $outShow && layout}
                    <!-- <h2>{$outShow.name}</h2> -->
                    <div class="outSlides">
                        <Slide outSlide={outNumber} {transition} preview />
                    </div>
                {/if}

                <div class="buttons">
                    {#key outNumber}
                        <Clear outSlide={outNumber} tablet />
                    {/key}
                </div>

                {#if $outShow && layout}
                    <div class="buttons" style="display: flex;width: 100%;">
                        <!-- <Button style="flex: 1;" center><Icon id="previousFull" /></Button> -->
                        <Button style="flex: 1;" on:click={() => send("API:previous_slide")} disabled={outNumber <= 0} center><Icon size={1.8} id="previous" /></Button>
                        <span style="flex: 3;align-self: center;text-align: center;opacity: 0.8;font-size: 0.8em;">{outNumber + 1}/{totalSlides}</span>
                        <Button style="flex: 1;" on:click={() => send("API:next_slide")} disabled={outNumber + 1 >= totalSlides} center><Icon size={1.8} id="next" /></Button>
                        <!-- <Button style="flex: 1;" center><Icon id="nextFull" /></Button> -->
                    </div>
                {/if}
            </div>

            {#if $outShow && layout}
                <div class="outSlides">
                    {#if $outShow && $outLayout && nextSlide(layout, outNumber) && getNextSlide($outShow, outNumber, $outLayout)}
                        <Slide outSlide={nextSlide(layout, outNumber) || 0} {transition} preview />
                    {:else}
                        <div style="display: flex;align-items: center;justify-content: center;flex: 1;opacity: 0.5;padding: 20px 0;">{translate("remote.end", $dictionary)}</div>
                    {/if}
                </div>
            {/if}
        {:else}
            <Center faded>{translate("remote.no_output", $dictionary)}</Center>
        {/if}
    </div>
{/if}

<div class="fullscreen">
    <button on:click={toggleFullscreen}>
        <Icon id={isFullscreen ? "exitFullscreen" : "fullscreen"} size={2.2} white />
    </button>
</div>

<style>
    .left,
    .center,
    .right {
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .left,
    .right {
        width: 290px;
    }

    .left {
        border-inline-end: 0;
    }
    .right {
        border-inline-start: 0;
    }

    .center {
        flex: 1;
    }

    /* Resizers */
    .resizer {
        position: relative;
        z-index: 1;
        width: 6px;
        background: var(--primary-darker);
        cursor: col-resize;
        transition: background 0.2s ease;
        user-select: none;
        /* Expand touch area */
        padding: 0 2px;
        margin: 0 -2px;
    }

    .resizer::before {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        width: 2px; /* single visual line */
        transform: translateX(-50%);
        background-color: var(--primary-lighter);
        transition:
            background-color 0.2s ease,
            width 0.2s ease;
    }

    .resizer:hover,
    .resizer:focus {
        background: var(--primary-darkest);
        outline: none;
    }

    .resizer:hover::before {
        background-color: var(--primary-darkest);
    }

    .resizer:focus {
        box-shadow: 0 0 0 2px var(--primary);
    }

    .resizer.snapping::before {
        background-color: var(--primary);
        width: 4px;
    }

    /* ///// */

    .flex {
        position: relative;

        display: flex;
        flex-direction: column;
        flex: 1;

        overflow-y: auto;
    }

    /* Center panel scroll (slides list) */
    .scroll {
        scrollbar-width: thin; /* Firefox */
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

    /* ///// */

    .layouts {
        display: flex;
        justify-content: space-between;

        background-color: var(--primary-darkest);

        font-size: 0.9em;
    }

    .layouts .buttons {
        display: flex;
    }

    /* ///// */

    .outSlides {
        display: flex;
        width: 100%;
    }

    /* fullscreen */
    .fullscreen {
        position: absolute;
        right: 20px;
        bottom: 20px;
    }

    .fullscreen button {
        width: 60px;
        height: 60px;

        display: flex;
        justify-content: center;
        align-items: center;

        /* background-color: white; */
        background-color: rgb(255 255 255 / 0.2);
        color: var(--text);

        padding: 10px;
        border-radius: 50%;
        border: 2px solid black;
    }
    .fullscreen button:hover,
    .fullscreen button:active {
        background-color: var(--primary-lighter);
    }
</style>
