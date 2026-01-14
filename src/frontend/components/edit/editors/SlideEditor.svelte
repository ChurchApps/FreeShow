<script lang="ts">
    import { onMount } from "svelte"
    import type { MediaStyle } from "../../../../types/Main"
    import type { ItemType } from "../../../../types/Show"
    import { activeEdit, activePage, activePopup, activeShow, activeTriggerFunction, alertMessage, driveData, focusMode, labelsDisabled, media, outputs, overlays, refreshEditSlide, showsCache, special, styles, templates, textEditActive } from "../../../stores"
    import { transposeText } from "../../../utils/chordTranspose"
    import { triggerFunction } from "../../../utils/common"
    import { translateText } from "../../../utils/language"
    import { getAccess } from "../../../utils/profile"
    import { slideHasAction } from "../../actions/actions"
    import MediaLoader from "../../drawer/media/MediaLoader.svelte"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { history } from "../../helpers/history"
    import { getMedia, getMediaFileFromClipboard, getMediaStyle, getThumbnailPath, mediaSize } from "../../helpers/media"
    import { getFirstActiveOutput, getResolution, getSlideFilter } from "../../helpers/output"
    import { getLayoutRef } from "../../helpers/show"
    import { _show } from "../../helpers/shows"
    import { getStyles } from "../../helpers/style"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialZoom from "../../inputs/MaterialZoom.svelte"
    import { formatText } from "../../show/formatTextEditor"
    import { getPlainEditorText } from "../../show/getTextEditor"
    import Textbox from "../../slide/Textbox.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Center from "../../system/Center.svelte"
    import DropArea from "../../system/DropArea.svelte"
    import Snaplines from "../../system/Snaplines.svelte"
    import Editbox from "../editbox/Editbox.svelte"
    import { getUsedChords } from "../scripts/chords"
    import { addItem } from "../scripts/itemHelpers"
    import { getSlideText, setCaretAtEnd } from "../scripts/textStyle"

    $: currentShowId = $activeShow?.id || $activeEdit.showId || ""
    $: currentShow = $showsCache[currentShowId]
    $: if (currentShowId && currentShow && $activeEdit.slide === null && _show(currentShowId).slides().get().length) activeEdit.set({ slide: 0, items: [], showId: currentShowId })
    $: ref = currentShowId && currentShow ? getLayoutRef(currentShowId) : []
    $: Slide = $activeEdit.slide !== null && ref?.[$activeEdit.slide!] ? _show(currentShowId).slides([ref[$activeEdit.slide!]?.id]).get()?.[0] : null

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

                const mediaData = a.data.background && currentShow?.media[a.data.background]
                if (mediaData && (mediaData?.loop === false || $media[mediaData?.path || ""]?.videoType === "foreground")) bgId = null
            }
        })
    }

    $: background = bgId && currentShowId ? currentShow?.media[bgId] : null
    $: cloudId = $driveData.mediaId
    $: backgroundPath = cloudId && cloudId !== "default" && background ? background.cloud?.[cloudId] || background.path || "" : background?.path || ""
    // $: slideOverlays = layoutSlide.overlays || []

    // LOAD BACKGROUND

    let mediaPath = ""
    let thumbnailPath = ""

    $: bgPath = backgroundPath || background?.id || ""
    $: if (bgPath) loadBackground()
    async function loadBackground() {
        mediaPath = bgPath
        thumbnailPath = getThumbnailPath(mediaPath, mediaSize.slideSize)

        const media = await getMedia(bgPath)
        if (!media) return

        mediaPath = media.path
        thumbnailPath = media.thumbnail
    }

    $: currentOutput = getFirstActiveOutput($outputs)
    $: transparentOutput = !!currentOutput?.transparent
    $: currentStyle = $styles[currentOutput?.style || ""] || {}

    let mediaStyle: MediaStyle = {}
    $: if (mediaPath) mediaStyle = getMediaStyle($media[mediaPath], currentStyle)

    $: {
        if (active.length) setTimeout(updateStyles)
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

        let items = currentShow?.slides[ref[$activeEdit.slide || 0]?.id].items
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

        let slideId = ref[$activeEdit.slide || 0]?.id
        if (!slideId) return

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

    let altTimeout: NodeJS.Timeout | null = null
    let altTemp = false
    let altKeyPressed = false
    function keydown(e: KeyboardEvent) {
        if (!e.altKey && altTimeout) clearTimeout(altTimeout)

        if (e.altKey) {
            if (altTemp) return
            altTemp = true
            // e.preventDefault()

            // only activate alt preview hide after a little time (still works instantly)
            altTimeout = setTimeout(() => {
                if (altTemp && document.hasFocus()) altKeyPressed = true
            }, 300)
        }
    }
    function keyup(e) {
        if (e.altKey) return

        altTemp = false
        altKeyPressed = false
    }
    function blurred() {
        altTemp = false
        altKeyPressed = false
    }

    // paste any images in clipboard
    async function paste(e: ClipboardEvent) {
        const mediaData = await getMediaFileFromClipboard(e)
        if (mediaData) addItem("media", null, { src: mediaData })
    }

    // ZOOM
    let scrollElem: HTMLDivElement | undefined
    let zoom = 1
    function updateZoom(e: any) {
        zoom = e.detail
        centerZoom()
    }

    function centerZoom() {
        // always center scroll when zooming
        if (zoom >= 1) return

        // allow elem to update after zooming
        setTimeout(() => {
            const elem = scrollElem?.querySelector(".droparea")
            if (!elem) return

            const centerX = (elem.scrollWidth - elem.clientWidth) / 2
            const centerY = (elem.scrollHeight - elem.clientHeight) / 2

            elem.scrollTo({ left: centerX, top: centerY })
        })
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

    // transpose chords - same as TextEditor
    function transposeUp() {
        const text = getPlainEditorText("", false)
        formatText(transposeText(text, 1), currentShowId)
    }
    function transposeDown() {
        const text = getPlainEditorText("", false)
        formatText(transposeText(text, -1), currentShowId)
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

    let profile = getAccess("shows")
    $: isLocked = currentShow?.locked || profile.global === "read" || profile[currentShow?.category || ""] === "read"

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

    // NOTES

    let bottomHeight = 40

    $: notes = Slide?.notes?.replaceAll("\n", "&nbsp;")
    $: notesVisible = !!notes // && !chordsMode

    const shortcutItems: { id: ItemType; icon?: string }[] = [{ id: "text" }, { id: "media", icon: "image" }, { id: "timer" }]

    $: widthOrHeight = getStyleResolution(resolution, width, height, "fit", { zoom })

    $: hasTextContent = getSlideText(Slide)?.length

    $: template = Slide?.settings?.template || currentShow?.settings?.template || ""
</script>

<svelte:window on:keydown={keydown} on:keyup={keyup} on:blur={blurred} on:paste={paste} />

{#if template && !chordsMode && !widthOrHeight.includes("height") && !$focusMode && !isLocked}
    <div class="default" data-title={translateText(`info.template: ${$templates[template]?.name || "—"}`)}>
        <MaterialButton
            style="border-radius: 50%;"
            on:click={() => {
                activeEdit.set({ type: "template", id: template, items: [] })
                activePage.set("edit")
            }}
        >
            <Icon id="templates" white />
        </MaterialButton>
    </div>
{/if}

<div class="editArea">
    <div class="parent" class:noOverflow={zoom >= 1} bind:this={scrollElem} bind:offsetWidth={width} bind:offsetHeight={height}>
        {#if Slide}
            <DropArea id="edit" file>
                <Zoomed background={(transparentOutput || $special.transparentSlides) && !background ? "transparent" : background ? "black" : Slide?.settings?.color || currentStyle.background || "black"} {checkered} border={checkered} {resolution} style={widthOrHeight} bind:ratio {hideOverflow} center={zoom >= 1}>
                    <!-- <div class="chordsButton" style="zoom: {1 / ratio};">
                        <Button on:click={toggleChords}>
                            <Icon id="chords" white={!chordsMode} />
                        </Button>
                    </div> -->

                    <!-- background -->
                    {#if !altKeyPressed && background}
                        <div class="background" style="zoom: {1 / ratio};opacity: 0.5;{slideFilter};height: 100%;width: 100%;">
                            <MediaLoader path={mediaPath} {thumbnailPath} {loadFullImage} type={background.type !== "player" ? background.type : null} {mediaStyle} />
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
                    {#if !isLocked}
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

    {#if notesVisible}
        <div class="notes" role="none" on:click={() => triggerFunction("slide_notes")}>
            <Icon id="notes" right white />
            <p>{@html notes}</p>
        </div>
    {/if}

    {#if !$focusMode && !isLocked}
        <!-- && Slide?.items?.length -->
        {#if !chordsMode && !widthOrHeight.includes("height")}
            <FloatingInputs bottom={notesVisible ? bottomHeight : 10} side="center">
                {#each shortcutItems as item}
                    <MaterialButton title="settings.add: items.{item.id}" on:click={() => addItem(item.id)}>
                        <Icon id={item.icon || item.id} size={1.3} white />
                    </MaterialButton>
                {/each}
            </FloatingInputs>
        {/if}

        <FloatingInputs bottom={notesVisible ? bottomHeight : 10} arrow let:open>
            <MaterialZoom hidden={!open} columns={zoom} min={0.2} max={4} defaultValue={1} addValue={0.1} on:change={updateZoom} />

            {#if open}
                <div class="divider"></div>

                <!-- open slide notes -->
                <MaterialButton icon="notes" title="items.slide_notes" on:click={() => triggerFunction("slide_notes")} />

                <div class="divider"></div>

                {#if hasTextContent}
                    <MaterialButton title="edit.insert_virtual_break" on:click={() => triggerFunction("insert_virtual_break")}>
                        <Icon id="add" white />
                        {#if !$labelsDisabled}<T id="edit.insert_virtual_break" />{/if}
                    </MaterialButton>

                    <div class="divider"></div>
                {/if}
            {/if}

            <!-- no need to add chords on scripture/events -->
            {#if !currentShow?.reference?.type && Slide && !isLocked && hasTextContent}
                <!-- {#if open || slideChords.length} -->
                <MaterialButton isActive={chordsMode} on:click={toggleChords} title="edit.chords">
                    <Icon id="chords" white={!slideChords.length} />
                    <!-- {#if open && !$labelsDisabled}<T id="edit.chords" />{/if} -->
                </MaterialButton>
                <!-- {/if} -->

                {#if open}
                    <div class="divider"></div>
                {/if}
            {/if}

            <MaterialButton title="show.text [Ctrl+Shift+T]" on:click={() => textEditActive.set(true)}>
                <Icon id="text_edit" white />
                <!-- {#if open && !$labelsDisabled}<p><T id="show.text" /></p>{/if} -->
            </MaterialButton>
        </FloatingInputs>

        {#if chordsMode}
            <FloatingInputs side="left" bottom={notesVisible ? bottomHeight : 10} arrow let:open>
                <div slot="menu">
                    <MaterialButton on:click={transposeUp} title="edit.transpose_up">
                        <Icon id="arrow_up" size={1.3} white />
                    </MaterialButton>
                    <MaterialButton on:click={transposeDown} title="edit.transpose_down">
                        <Icon id="arrow_down" size={1.3} white />
                    </MaterialButton>
                </div>

                {#if open}
                    <div class="divider"></div>
                {/if}

                <MaterialButton isActive={!chordsAction} on:click={setDefaultChordsAction}>
                    <p><T id="popup.choose_chord" /></p>
                </MaterialButton>

                {#each usedChords as chord}
                    <MaterialButton isActive={chordsAction === chord} on:click={() => (chordsAction = chord)}>
                        {chord}
                    </MaterialButton>
                {/each}
            </FloatingInputs>
        {/if}
    {/if}
</div>

<style>
    .default {
        position: absolute;
        top: 10px;
        left: 10px;

        width: 42px;
        height: 42px;

        display: flex;
        align-items: center;
        justify-content: center;

        background-color: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);

        padding: 10px;
        border-radius: 50%;

        z-index: 999;
    }

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

    .notes {
        background-color: var(--primary-darkest);
        border-top: 1px solid var(--primary-lighter);
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
        /* position: absolute;bottom: 0;transform: translateY(-100%); */
        padding: 0 8px;
        min-height: 30px;

        display: flex;
        align-items: center;
        justify-content: start;
        /* justify-content: center; */
    }

    .notes p :global(*) {
        display: inline;
    }
</style>
