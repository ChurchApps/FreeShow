<script lang="ts">
    import { onMount } from "svelte"
    import { slide } from "svelte/transition"
    import type { MediaStyle } from "../../../../types/Main"
    import { activeEdit, activePopup, activeShow, activeTriggerFunction, alertMessage, dictionary, driveData, focusMode, labelsDisabled, media, outputs, overlays, refreshEditSlide, showsCache, special, styles, textEditActive } from "../../../stores"
    import { slideHasAction } from "../../actions/actions"
    import MediaLoader from "../../drawer/media/MediaLoader.svelte"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { history } from "../../helpers/history"
    import { getMediaStyle, loadThumbnail, mediaSize } from "../../helpers/media"
    import { getActiveOutputs, getResolution, getSlideFilter } from "../../helpers/output"
    import { _show } from "../../helpers/shows"
    import { getStyles } from "../../helpers/style"
    import Button from "../../inputs/Button.svelte"
    import Textbox from "../../slide/Textbox.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Center from "../../system/Center.svelte"
    import DropArea from "../../system/DropArea.svelte"
    import Snaplines from "../../system/Snaplines.svelte"
    import Editbox from "../editbox/Editbox.svelte"
    import { getUsedChords } from "../scripts/chords"
    import { setCaretAtEnd } from "../scripts/textStyle"
    import { getLayoutRef } from "../../helpers/show"

    $: currentShowId = $activeShow?.id || $activeEdit.showId || ""
    $: currentShow = $showsCache[currentShowId]
    $: if (currentShowId && currentShow && $activeEdit.slide === null && _show(currentShowId).slides().get().length) activeEdit.set({ slide: 0, items: [], showId: currentShowId })
    $: ref = currentShowId && currentShow ? getLayoutRef(currentShowId) : []
    $: Slide = $activeEdit.slide !== null && ref?.[$activeEdit.slide!] ? _show(currentShowId).slides([ref[$activeEdit.slide!]?.id]).get()[0] : null

    let lines: [string, number][] = []
    let mouse: any = null
    let newStyles: { [key: string]: string | number } = {}
    $: active = $activeEdit.items

    let width = 0
    let height = 0
    // Slide?.settings?.resolution
    $: resolution = getResolution(null, { $outputs, $styles })

    let ratio = 1

    $: layoutSlide = ref?.[$activeEdit.slide!]?.data || {}
    // get backgruond
    $: bgId = layoutSlide.background || null
    let loadFullImage = false // true

    // get ghost background
    $: if (!bgId) {
        ref?.forEach((a, i) => {
            if (i <= $activeEdit.slide! && !a.data.disabled) {
                if (slideHasAction(a.data?.actions, "clear_background")) bgId = null
                else if (a.data.background) bgId = a.data.background
                if (a.data.background && currentShowId && currentShow?.media[a.data.background]?.loop === false) bgId = null
            }
        })
    }

    $: background = bgId && currentShowId ? currentShow?.media[bgId] : null
    $: cloudId = $driveData.mediaId
    $: backgroundPath = cloudId && cloudId !== "default" && background ? background.cloud?.[cloudId] || background.path || "" : background?.path || ""
    // $: slideOverlays = layoutSlide.overlays || []

    // LOAD BACKGROUND
    $: bgPath = backgroundPath || background?.id || ""
    $: if (bgPath) loadBackground()
    let thumbnailPath = ""
    async function loadBackground() {
        let newPath = await loadThumbnail(bgPath, mediaSize.big)
        if (newPath) thumbnailPath = newPath
    }

    $: currentOutput = $outputs[getActiveOutputs()[0]]
    $: transparentOutput = !!currentOutput?.transparent
    $: currentStyle = $styles[currentOutput?.style || ""] || {}

    let mediaStyle: MediaStyle = {}
    $: if (bgPath) mediaStyle = getMediaStyle($media[bgPath], currentStyle)

    $: {
        if (active.length) updateStyles()
        else newStyles = {}
    }

    // const CHANGE_POS_TIME = 2000
    // let changePosTimeout = null
    let updateTimeout: NodeJS.Timeout | null = null
    function updateStyles() {
        // || changePosTimeout
        if (!Object.keys(newStyles).length) return

        // WIP nice to timeout here to reduce lag (but textbox position need to update!!)
        // changePosTimeout = setTimeout(() => {
        //     changePosTimeout = null
        //     updateStyles()
        // }, CHANGE_POS_TIME)

        let items = currentShow?.slides[ref[$activeEdit.slide!]?.id].items
        let values: string[] = []
        active.forEach((id) => {
            let item = items[id]
            if (item) {
                let styles = getStyles(item.style)
                let textStyles = ""

                Object.entries(newStyles).forEach(([key, value]) => (styles[key] = value.toString()))
                Object.entries(styles).forEach((obj) => (textStyles += obj[0] + ":" + obj[1] + ";"))

                values.push(textStyles)
            }
        })

        let slideId = ref[$activeEdit.slide!].id
        let activeItems = [...active]

        let historyShow = $activeShow
        // focus mode
        if (!historyShow && currentShowId) historyShow = { type: "show", id: currentShowId, index: $activeEdit.slide || 0 }
        else if (!historyShow) return

        history({
            id: "setStyle",
            newData: { style: { key: "style", values } },
            location: { page: "edit", show: historyShow, slide: slideId, items: activeItems }
        })

        if (!items[0]?.auto) return
        // recalculate auto size
        if (updateTimeout) clearTimeout(updateTimeout)
        updateTimeout = setTimeout(resetAutoSize, 3000)

        function resetAutoSize() {
            showsCache.update((a) => {
                if (!a[currentShowId]?.slides?.[slideId]?.items?.[activeItems[0] || 0]?.autoFontSize) return a

                delete a[currentShowId].slides[slideId].items[activeItems[0] || 0].autoFontSize
                return a
            })

            refreshEditSlide.set(true)
        }
    }

    let altKeyPressed = false
    function keydown(e: KeyboardEvent) {
        if (e.altKey) {
            e.preventDefault()
            altKeyPressed = true
        }
    }
    function keyup() {
        altKeyPressed = false
    }

    // ZOOM
    let scrollElem: HTMLDivElement | undefined
    let zoom = 1

    // shortcut
    let nextScrollTimeout: NodeJS.Timeout | null = null
    function wheel(e: any) {
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return
        if (!e.target.closest(".editArea")) return

        zoom = Number(Math.max(0.2, Math.min(4, zoom + (e.deltaY < 0 ? -0.1 : 0.1))).toFixed(2))

        // always center scroll when zooming
        if (zoom < 1) {
            // allow elem to update after zooming
            setTimeout(() => {
                const elem = scrollElem?.querySelector(".droparea")
                if (!elem) return

                const centerX = (elem.scrollWidth - elem.clientWidth) / 2
                const centerY = (elem.scrollHeight - elem.clientHeight) / 2

                elem.scrollTo({ left: centerX, top: centerY })
            })
        }

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    // menu
    let zoomOpened = false
    function mousedown(e: any) {
        keyup()
        if (e.target.closest(".zoom_container") || e.target.closest("button")) return

        zoomOpened = false
    }

    // CHORDS
    let usedChords: string[] = []
    $: slideChords = Slide ? getUsedChords(Slide) : []
    $: allChords = Object.values(currentShow?.slides || {})
        .map(getUsedChords)
        .flat()
    // combine and remove duplicates
    $: usedChords = slideChords.length + allChords.length ? [...new Set([...slideChords, ...allChords])] : []

    let chordsAction = ""
    function setDefaultChordsAction() {
        if (chordsAction === "") {
            alertMessage.set("actions.chord_info")
            activePopup.set("alert")
        } else {
            chordsAction = ""
        }
    }

    let chordsMode = false
    function toggleChords() {
        chordsMode = !chordsMode
    }

    $: slideFilter = getSlideFilter(layoutSlide)

    onMount(() =>
        // timeout to prevent number 2 from getting typed if changing with shortcuts
        setTimeout(() => {
            // set focus to textbox if only one
            if (Slide?.items.length === 1 && !$activeEdit.items.length && $activeTriggerFunction !== "slide_notes") {
                activeEdit.update((a) => ({ ...(a || {}), items: [0] }))
                const elem = document.querySelector(".editItem")?.querySelector(".edit")
                if (elem) {
                    elem.addEventListener("focus", () => setCaretAtEnd(elem))
                    ;(elem as HTMLElement).focus()
                }
            }
        })
    )

    // remove overflow if scrollbars are flickering over 25 times per second
    let hideOverflow = false
    // let changedTimes: number = 0
    // $: if (ratio) changedTimes++
    // $: if (!ratioTimeout && changedTimes > 2) startTimeout()
    // $: if (ratio && hideOverflow && !ratioTimeout && changedTimes > 1) hideOverflow = false

    // let ratioTimeout = null
    // function startTimeout() {
    //     ratioTimeout = setTimeout(() => {
    //         if (changedTimes > 5) hideOverflow = true
    //         changedTimes = 0
    //         setTimeout(() => {
    //             ratioTimeout = null
    //         }, 10)
    //     }, 200)
    // }

    // $: styleTemplate = getStyleTemplate(null, currentStyle)
    // || styleTemplate.settings?.backgroundColor

    $: checkered = (transparentOutput || $special.transparentSlides) && !background
</script>

<svelte:window on:keydown={keydown} on:keyup={keyup} on:mousedown={mousedown} on:wheel={wheel} />

<div class="editArea">
    <!-- zoom: {1 / zoom}; -->
    <!-- width: {100 / zoom}%;height: {100 / zoom}%; -->
    <div class="parent" class:noOverflow={zoom >= 1} bind:this={scrollElem} bind:offsetWidth={width} bind:offsetHeight={height}>
        {#if Slide}
            <DropArea id="edit">
                <Zoomed
                    background={(transparentOutput || $special.transparentSlides) && !background ? "transparent" : Slide?.settings?.color || currentStyle.background || "black"}
                    {checkered}
                    border={checkered}
                    {resolution}
                    style={getStyleResolution(resolution, width, height, "fit", { zoom })}
                    bind:ratio
                    {hideOverflow}
                    center={zoom >= 1}
                >
                    <!-- <div class="chordsButton" style="zoom: {1 / ratio};">
                        <Button on:click={toggleChords}>
                            <Icon id="chords" white={!chordsMode} />
                        </Button>
                    </div> -->

                    <!-- background -->
                    {#if !altKeyPressed && background}
                        <div class="background" style="zoom: {1 / ratio};opacity: 0.5;{slideFilter};height: 100%;width: 100%;">
                            <MediaLoader path={bgPath} {thumbnailPath} {loadFullImage} type={background.type !== "player" ? background.type : null} {mediaStyle} />
                        </div>
                    {/if}

                    <!-- overlays -->
                    <div class="overlays preview" style="opacity: 0.5;">
                        {#if !altKeyPressed && layoutSlide.overlays?.length}
                            {#each layoutSlide.overlays as id}
                                {#if $overlays[id]}
                                    {#each $overlays[id].items as item}
                                        <Textbox {item} ref={{ type: "overlay", id }} />
                                    {/each}
                                {/if}
                            {/each}
                        {/if}
                    </div>

                    <!-- edit -->
                    {#if !$showsCache[currentShowId || ""]?.locked}
                        <Snaplines bind:lines bind:newStyles bind:mouse {ratio} {active} />
                    {/if}

                    {#key $activeEdit.slide || $activeEdit.id}
                        {#each Slide.items as item, index}
                            <!-- filter={layoutSlide.filterEnabled?.includes("foreground") ? layoutSlide.filter : ""} -->
                            <!-- backdropFilter={layoutSlide.filterEnabled?.includes("foreground") ? layoutSlide["backdrop-filter"] : ""} -->
                            <Editbox backdropFilter={layoutSlide["backdrop-filter"] || ""} {item} {chordsMode} {chordsAction} ref={{ showId: currentShowId, id: Slide.id }} {index} {ratio} bind:mouse />
                        {/each}
                    {/key}
                </Zoomed>
            </DropArea>
        {:else}
            <Center size={2} faded>
                <T id="empty.slide" />
            </Center>
        {/if}
    </div>

    {#if !$focusMode}
        <div class="actions" style="width: 100%;gap: 10px;">
            <div class="leftActions">
                {#if !chordsMode}
                    <div class="notes" style="font-size: 0.8em;">{currentShow?.name || ""}</div>
                {/if}
                {#if chordsMode && Slide}
                    <Button outline={!chordsAction} on:click={setDefaultChordsAction}>
                        <p><T id="popup.choose_chord" /></p>
                    </Button>

                    {#each usedChords as chord}
                        <Button outline={chordsAction === chord} on:click={() => (chordsAction = chord)}>
                            {chord}
                        </Button>
                    {/each}
                {:else if Slide?.notes}
                    <div class="notes" style="opacity: 0.8;">
                        <Icon id="notes" right white />
                        <div style="list-style: inside;">
                            {@html Slide.notes.replaceAll("\n", "&nbsp;")}
                        </div>
                    </div>
                {/if}
            </div>

            <div class="actions" style="height: 100%;justify-content: end;">
                <!-- no need to add chords on scripture/events -->
                {#if !currentShow?.reference?.type && Slide}
                    <Button class={chordsMode ? "chordsActive" : ""} on:click={toggleChords} title={$dictionary.edit?.chords}>
                        <Icon id="chords" white={!slideChords.length} right={!$labelsDisabled} />
                        {#if !$labelsDisabled}<T id="edit.chords" />{/if}
                    </Button>
                {/if}

                {#if !$focusMode}
                    {#if Slide}
                        <div class="seperator" />
                    {/if}

                    <Button on:click={() => textEditActive.set(true)}>
                        <Icon id="text" right={!$labelsDisabled} />
                        {#if !$labelsDisabled}<p><T id="show.text" /></p>{/if}
                    </Button>
                {/if}

                <div class="seperator" />

                <Button on:click={() => (zoomOpened = !zoomOpened)} title={$dictionary.actions?.zoom}>
                    <Icon size={1.3} id="zoomIn" white />
                </Button>
                {#if zoomOpened}
                    <div class="zoom_container" transition:slide={{ duration: 150 }}>
                        <Button style="padding: 0 !important;width: 100%;" on:click={() => (zoom = 1)} bold={false} center>
                            <p class="text" title={$dictionary.actions?.resetZoom}>{(100 / zoom).toFixed()}%</p>
                        </Button>
                        <Button disabled={zoom <= 0.2} on:click={() => (zoom = Number((zoom - 0.1).toFixed(2)))} title={$dictionary.actions?.zoomIn}>
                            <Icon size={1.3} id="add" white />
                        </Button>
                        <Button disabled={zoom >= 4} on:click={() => (zoom = Number((zoom + 0.1).toFixed(2)))} title={$dictionary.actions?.zoomOut}>
                            <Icon size={1.3} id="remove" white />
                        </Button>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .editArea {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .parent {
        width: 100%;
        height: 100%;
        display: flex;
        overflow: auto;
        /* justify-content: center;
        align-items: center; */
        /* padding: 10px; */

        /* WIP try to fix scrollbar content flickering */
        /* setting .slide elem to overflow: hidden; works... */
        /* overflow: overlay;
        z-index: 1; */
        /* scrollbar-gutter: stable both-edges; */
    }

    /* disable "glitchy" scroll bars */
    .parent.noOverflow :global(.droparea) {
        overflow: hidden;
    }

    /* .chordsButton {
        position: absolute;
        top: 0;
        right: 0;
        background-color: var(--focus);
    }
    .chordsButton :global(button) {
        padding: 10px !important;
        z-index: 3;
    } */

    .actions {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background-color: var(--primary-darkest);
        /* border-top: 3px solid var(--primary-lighter); */
    }

    .actions :global(button.chordsActive) {
        background-color: var(--focus);
    }

    .leftActions {
        display: flex;
        overflow-x: auto;
        width: 100%;
    }

    .notes {
        padding: 0 8px;
        display: flex;
        align-items: center;

        white-space: nowrap;
    }

    /* fixed height for consistent heights */
    .actions :global(button) {
        min-height: 28px;
        padding: 0 0.8em !important;
    }

    .seperator {
        width: 1px;
        height: 100%;
        background-color: var(--primary);
        /* margin: 0 10px; */
    }

    .text {
        opacity: 0.8;
        text-align: center;
        padding: 0.5em 0;
    }

    .zoom_container {
        position: absolute;
        inset-inline-end: 0;
        top: 0;
        transform: translateY(-100%);
        overflow: hidden;
        z-index: 30;

        flex-direction: column;
        width: auto;
        /* border-left: 3px solid var(--primary-lighter);
        border-top: 3px solid var(--primary-lighter); */
        background-color: inherit;
    }
</style>
