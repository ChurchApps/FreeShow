<script lang="ts">
    import { onDestroy, onMount } from "svelte"
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
    let scrollRaf: number | null = null
    let userScrolled = false
    let scrollTimeout: number | null = null
    let lastSlideNumber = -1
    let lastAutoScrollTime = 0
    
    // Detect manual scrolling - disable auto-scroll temporarily
    function handleScroll() {
        if (!scrollElem || slideView !== "lyrics") return
        
        // If scroll happens more than 300ms after auto-scroll, it's user scroll
        if (Date.now() - lastAutoScrollTime > 300) {
            userScrolled = true
            if (scrollTimeout !== null) clearTimeout(scrollTimeout)
            // Re-enable auto-scroll after 4 seconds
            scrollTimeout = setTimeout(() => {
                userScrolled = false
                scrollTimeout = null
            }, 4000) as unknown as number
        }
    }
    
    // Auto-scroll to current slide
    $: {
        if (scrollElem && outNumber !== null && slideView === "lyrics" && scrollRaf === null && outNumber !== lastSlideNumber) {
            // Reset flag when slide changes
            if (lastSlideNumber !== -1) {
                userScrolled = false
                if (scrollTimeout !== null) {
                    clearTimeout(scrollTimeout)
                    scrollTimeout = null
                }
            }
            
            // Auto-scroll if user hasn't manually scrolled
            if (!userScrolled) {
                const elem = scrollElem
                const targetSlide = outNumber
                lastSlideNumber = targetSlide
                
                scrollRaf = requestAnimationFrame(() => {
                    if (!elem || userScrolled) {
                        scrollRaf = null
                        return
                    }
                    const offset = (elem.children[targetSlide] as HTMLElement)?.offsetTop - elem.offsetTop - 5
                    elem.scrollTo({ top: offset - 50, behavior: 'smooth' })
                    lastAutoScrollTime = Date.now()
                    scrollRaf = null
                }) as unknown as number
            } else {
                lastSlideNumber = outNumber
            }
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
            requestAnimationFrame(() => {
                activeTab = "scripture"
            })
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
    const snapThreshold = 30 // pixels to snap - larger for easier touch interaction

    function clampPersistedWidths() {
        const total = window.innerWidth
        const resizers = 24 // increased for larger touch targets
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
        const resizers = 24 // two resizers with larger touch targets
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

    // Cleanup
    onDestroy(() => {
        if (scrollTimeout !== null) clearTimeout(scrollTimeout)
        if (scrollRaf !== null) cancelAnimationFrame(scrollRaf)
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

        <Tabs {tabs} bind:active={activeTab} disabled={tabsDisabled} on:double={double} icons noTopRadius />
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

                <div class="buttons edit-buttons" style="position: relative; z-index: 2;">
                    {#if groupsOpened && !addGroups}
                        <Button on:click={() => (addGroups = true)} variant="outlined" style="width: 100%;" center>
                            <Icon id="add" right />
                            {translate("settings.add", $dictionary)}
                        </Button>
                    {/if}

                    <Button on:click={done} dark style="width: 100%;" center class="done-button">
                        <Icon id={addGroups ? "back" : "check"} right />
                        {translate(`actions.${addGroups ? "back" : "done"}`, $dictionary)}
                    </Button>
                </div>
            {:else}
                <div bind:this={scrollElem} on:scroll={handleScroll} class="scroll" style="flex: 1;min-height: 0;overflow-y: auto;background-color: var(--primary-darkest);scroll-behavior: smooth;display: flex;flex-direction: column;">
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
                            <Button class="context #slideViews" on:click={() => (slideView = slidesViews[slideView])} variant="outlined">
                                <Icon size={1.3} id={slideView} white />
                            </Button>

                            <Button on:click={() => (groupsOpened = true)} variant="outlined" center class="toolButton">
                                <Icon id="groups" right />
                                {translate("tools.groups", $dictionary)}
                            </Button>

                            <Button on:click={() => (editOpened = true)} variant="outlined" center class="toolButton">
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
                    <div class="controls">
                        <Button on:click={() => send("API:previous_slide")} disabled={outNumber <= 0} variant="outlined" center compact>
                            <Icon id="previous" size={1.5} />
                        </Button>
                        <span class="counter">{outNumber + 1}/{totalSlides}</span>
                        <Button on:click={() => send("API:next_slide")} disabled={outNumber + 1 >= totalSlides} variant="outlined" center compact>
                            <Icon id="next" size={1.5} />
                        </Button>
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

    /* Ensure left panel tabs and center panel layouts align at bottom */
    .left {
        justify-content: space-between;
    }

    .center {
        justify-content: space-between;
    }

    .left,
    .right {
        width: 290px;
        max-width: 35vw; /* prevent side panels from forcing horizontal scroll on tablets */
        overflow: hidden;
    }

    .left {
        border-inline-end: 0;
    }
    .right {
        border-inline-start: 0;
    }

    .center {
        flex: 1;
        min-width: 0; /* allow flexbox to shrink center to available width */
        overflow: hidden; /* prevent inner content from creating page-wide overflow */
        background-color: var(--primary-darkest);
    }

    /* Resizers - touch-friendly for tablets */
    .resizer {
        position: relative;
        z-index: 10;
        width: 12px;
        background: transparent;
        cursor: col-resize;
        transition: background 0.2s ease;
        user-select: none;
        touch-action: none;
        /* Large touch target for tablets */
        padding: 0 8px;
        margin: 0 -8px;
        -webkit-tap-highlight-color: transparent;
    }

    .resizer::before {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        width: 3px;
        transform: translateX(-50%);
        background-color: var(--primary-lighter);
        border-radius: 2px;
        transition:
            background-color 0.2s ease,
            width 0.2s ease,
            opacity 0.2s ease;
        opacity: 0.6;
    }

    .resizer:hover,
    .resizer:active,
    .resizer:focus {
        background: rgba(255, 255, 255, 0.05);
        outline: none;
    }

    .resizer:hover::before,
    .resizer:active::before {
        background-color: var(--secondary);
        width: 4px;
        opacity: 1;
    }

    .resizer:focus {
        box-shadow: 0 0 0 2px var(--primary);
    }

    .resizer.snapping::before {
        background-color: var(--secondary);
        width: 5px;
        opacity: 1;
    }

    /* Larger touch target on tablets */
    @media (pointer: coarse) {
        .resizer {
            width: 20px;
            padding: 0 12px;
            margin: 0 -12px;
        }

        .resizer::before {
            width: 4px;
        }

        .resizer:active::before {
            width: 6px;
        }
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

    /* lyric spacing inside scroll */
    .scroll .lyric {
        line-height: 1.5;
        margin: 0.4rem 0; /* gap between lyric blocks */
    }
    .scroll .lyric .break {
        margin-bottom: 0.25rem; /* gap between lines inside a block */
    }

    /* ///// */

    .layouts {
        display: flex;
        justify-content: space-between;

        background-color: var(--primary-darkest);
        border-radius: 0;
        padding: 4px;
        margin: 0;
        gap: 4px;
        min-height: 60px;

        font-size: 0.95em;
        /* Align with tabs bar at bottom - no margin to match tabs */
        margin-top: auto;
    }

    .layouts .buttons {
        display: flex;
        gap: 4px;
    }

    /* Better spacing for layout buttons */
    .layouts :global(button) {
        border-radius: 8px;
        padding: 0.6em 1em !important;
        min-height: auto !important;
    }

    /* ///// */

    .outSlides {
        display: flex;
        width: 100%;
    }

    .controls {
        display: flex;
        align-items: center;
        justify-content: space-around;
        gap: 6px;
        padding: 0.5rem 0.75rem;
        background-color: var(--primary-darkest);
        border-radius: 12px;
        margin-top: 8px;
        min-height: auto;
    }

    .controls :global(button) {
        min-height: auto !important;
        padding: 0.4rem 0.6rem !important;
    }

    .counter {
        flex: 1;
        text-align: center;
        opacity: 0.8;
        font-size: 1em;
        font-weight: 500;
    }

    /* svelte-ignore css-unused-selector */
    /* This class is used via component props, not directly in template */
    :global(.toolButton) {
        padding: 0.75rem 1.25rem !important;
        font-size: 0.95em !important;
    }

    .edit-buttons :global(.done-button) {
        border-radius: 8px 8px 0 0 !important;
    }

    /* Tablet/iPad specific safeguards */
    @media (max-width: 1180px) {
        .left,
        .right {
            max-width: 32vw;
        }
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

        background-color: var(--primary-darker);
        color: var(--text);
        border: 1px solid var(--primary-lighter);
        border-radius: 16px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

        padding: 10px;
        transition: all 0.2s ease;
        cursor: pointer;
    }
    .fullscreen button:hover {
        background-color: var(--primary-lighter);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
        transform: translateY(-2px);
    }
    .fullscreen button:active {
        transform: translateY(0);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
</style>
