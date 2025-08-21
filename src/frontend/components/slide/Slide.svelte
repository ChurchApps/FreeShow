<script lang="ts">
    import { onMount } from "svelte"
    import { Main } from "../../../types/IPC/Main"
    import type { MediaStyle } from "../../../types/Main"
    import type { Item, Media, Show, Slide, SlideData } from "../../../types/Show"
    import { sendMain } from "../../IPC/main"
    import {
        activeEdit,
        activePage,
        activeTimers,
        activeTriggerFunction,
        audioFolders,
        checkedFiles,
        dictionary,
        driveData,
        effects,
        focusMode,
        fullColors,
        groups,
        media,
        mediaFolders,
        outputs,
        overlays,
        refreshListBoxes,
        refreshSlideThumbnails,
        showsCache,
        slidesOptions,
        special,
        styles,
        textEditActive
    } from "../../stores"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"
    import { wait } from "../../utils/common"
    import { getAccess } from "../../utils/profile"
    import { slideHasAction } from "../actions/actions"
    import { removeTagsAndContent } from "../drawer/bible/scripture"
    import MediaLoader from "../drawer/media/MediaLoader.svelte"
    import Editbox from "../edit/editbox/Editbox.svelte"
    import { getItemText } from "../edit/scripts/textStyle"
    import { clone } from "../helpers/array"
    import { getContrast, hexToRgb, splitRgb } from "../helpers/color"
    import Icon from "../helpers/Icon.svelte"
    import { checkMedia, downloadOnlineMedia, getFileName, getMediaStyle, getThumbnailPath, loadThumbnail, mediaSize, splitPath } from "../helpers/media"
    import { getActiveOutputs, getResolution, getSlideFilter } from "../helpers/output"
    import { getGroupName } from "../helpers/show"
    import Effect from "../output/effects/Effect.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import Actions from "./Actions.svelte"
    import Icons from "./Icons.svelte"
    import Textbox from "./Textbox.svelte"
    import Zoomed from "./Zoomed.svelte"

    export let showId: string
    export let slide: Slide
    export let layoutSlide: SlideData
    export let layoutSlides: SlideData[] = []
    export let show: Show
    export let color: string | null = slide.color
    export let index: number
    export let columns = 1
    export let output: { color: string; line: number; maxLines: number; cached: boolean; clickRevealed?: boolean } | null = null
    export let active = false
    export let focused = false
    export let list = false
    export let endIndex: null | number = null
    export let icons = false
    export let noQuickEdit = false
    export let altKeyPressed = false
    export let disableThumbnails = false
    export let centerPreview = false

    $: isLessons = show?.reference?.type === "lessons"

    $: viewMode = isLessons ? "grid" : $slidesOptions.mode || "grid"
    $: background = layoutSlide.background ? show.media[layoutSlide.background] : null

    let ghostBackground: Media | null = null
    let bgIndex = -1
    let isFirstGhost = false
    // don't show ghost backgrounds if over slide 60 (because of loading/performance!)
    // $: capped = ghostBackground && !background && index >= 60
    $: if (!background && index < 60 && !$special.optimizedMode) {
        ghostBackground = null
        layoutSlides.forEach((a, i) => {
            if (i > index) return

            if (slideHasAction(a.actions, "clear_background") && (!a.disabled || i === index)) ghostBackground = null
            else if (a.background && !a.disabled) {
                ghostBackground = show.media[a.background]
                bgIndex = i
            }
            if (a.background && show.media[a.background]?.loop === false) ghostBackground = null

            if (ghostBackground && i === index && bgIndex === i - 1) isFirstGhost = true
        })
    }

    // show loop icon if many backgruounds
    $: backgroundCount = layoutSlides.reduce((count, layoutRef) => (count += layoutRef.background ? 1 : 0), 0)

    // auto find media
    $: bg = clone(background || ghostBackground)
    $: cloudId = $driveData.mediaId
    $: if (bg) locateBackground()
    function locateBackground() {
        if (!background || !bg?.path) return

        let mediaId = layoutSlide.background!
        let folders = Object.values($mediaFolders).map((a) => a.path!)
        locateFile(mediaId, bg.path, folders, bg)
    }

    // auto find audio
    $: audioIds = clone(layoutSlide.audio || [])
    $: if (audioIds.length) locateAudio()
    function locateAudio() {
        let showMedia = $showsCache[showId]?.media
        let folders = Object.values($audioFolders).map((a) => a.path!)

        audioIds.forEach((audioId) => {
            let audio = showMedia[audioId]
            if (!audio?.path) return
            locateFile(audioId, audio.path, folders, audio)
        })
    }

    async function locateFile(fileId: string, path: string, folders: string[], mediaObj: Media) {
        if (!path) return

        if (checkCloud) {
            let cloudBg = mediaObj.cloud?.[cloudId]
            if (cloudBg) path = cloudBg
        }

        let id = `${path}_${fileId}`
        if ($checkedFiles.includes(id)) return

        checkedFiles.set([...$checkedFiles, id])
        let exists = await checkMedia(path)

        // check for other potentially mathing mediaFolders
        if (!exists) {
            let fileName = getFileName(path)
            sendMain(Main.LOCATE_MEDIA_FILE, { fileName, splittedPath: splitPath(path), folders, ref: { showId, mediaId: fileId, cloudId: checkCloud ? cloudId : "" } })
            return
        }

        if (!checkCloud || !$showsCache[showId]?.media?.[fileId] || $showsCache[showId].media[fileId].cloud?.[cloudId] === path) return

        // set cloud path to path
        showsCache.update((a) => {
            let media = a[showId].media[fileId]
            if (!media.cloud) a[showId].media[fileId].cloud = {}
            a[showId].media[fileId].cloud![cloudId] = path

            return a
        })
    }

    let duration = 0

    // CLOUD BG
    let cloudBg = ""
    $: checkCloud = cloudId && cloudId !== "default"
    $: if (checkCloud) cloudBg = bg?.cloud?.[cloudId] || ""

    // LOAD BACKGROUND
    $: bgPath = cloudBg || bg?.path || bg?.id || ""
    $: if (bgPath && !disableThumbnails) loadBackground()
    let thumbnailPath = ""
    async function loadBackground() {
        if (bgPath.includes("http")) return download()

        if (isLessons) {
            thumbnailPath = getThumbnailPath(bgPath, mediaSize.slideSize)
            // cache after it's downloaded
            setTimeout(() => loadThumbnail(bgPath, mediaSize.slideSize), 1000)
            return
        }

        if (ghostBackground) {
            if (isFirstGhost) {
                // create image (if not created) when it's first slide after actual background
                thumbnailPath = await loadThumbnail(bgPath, mediaSize.drawerSize)
                // WIP refresh all ghost thumbnails after created
            } else {
                await wait(200)

                // load ghost thumbnails (wait a bit to reduce loading lag)
                thumbnailPath = getThumbnailPath(bgPath, mediaSize.drawerSize)
            }
            return
        }

        // when zoomed in show the full res image
        // if (columns < 3 && $activePage !== "edit") {
        //     backgroundPath = bgPath
        //     return
        // }

        let newPath = await loadThumbnail(bgPath, mediaSize.slideSize)
        if (newPath) thumbnailPath = newPath
    }
    async function download() {
        thumbnailPath = await downloadOnlineMedia(bgPath)
    }

    let mediaStyle: MediaStyle = {}
    $: if (bg?.path) mediaStyle = getMediaStyle($media[bg.path], currentStyle)

    $: group = slide.group
    $: if (slide.globalGroup && $groups[slide.globalGroup]) {
        group = slide.globalGroup === "none" ? "." : $groups[slide.globalGroup].default ? $dictionary.groups?.[$groups[slide.globalGroup].name] || "" : $groups[slide.globalGroup].name
        color = $groups[slide.globalGroup].color
        // history({ id: "UPDATE", save: false, newData: { data: group, key: "slides", keys: [layoutSlide.id], subkey: "group" }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
        // history({ id: "UPDATE", save: false, newData: { data: color, key: "slides", keys: [layoutSlide.id], subkey: "color" }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
    }

    $: name = getGroupName({ show, showId }, layoutSlide.id, group, index, true)

    // quick edit
    let html = ""
    let previousHTML = ""
    let longest: number | null = null

    onMount(() => {
        let texts = slide.items?.map((item) => getItemText(item))
        if (!texts) return
        let prev: number | null = null
        texts.forEach((a, i) => {
            if (!prev || a.length > prev) {
                prev = a.length
                longest = i
            }
        })
        update()
    })

    function update() {
        if (longest === null) return

        // html = `<div class="align" style="${item.align}">`
        html = ""
        slide.items[longest]?.lines?.forEach((line) => {
            line.text?.forEach((a) => {
                html += a.value
            })
        })
        previousHTML = html
    }

    // || $showsCache[active].slides
    let textElem: HTMLElement | undefined
    $: if (textElem && html !== previousHTML) {
        previousHTML = html
        setTimeout(() => {
            showsCache.update((a) => {
                let lines = a[showId].slides[layoutSlide.id].items[longest ?? -1]?.lines || []
                let textItems = getItems(textElem.children)
                if (textItems.length) {
                    lines.forEach((line) => {
                        line.text?.forEach((a, i) => (a.value = textItems[i]))
                    })
                }
                return a
            })
        }, 10)
    }

    function getItems(children: HTMLCollection) {
        let textItems: string[] = []
        new Array(...children).forEach((child) => {
            if (child.innerHTML) textItems.push(child.innerHTML)
        })
        return textItems
    }

    let timer: number[] = []
    $: if ($activeTimers) {
        timer = []
        if (Array.isArray(slide.items)) slide.items.forEach(checkItem)
    }
    function checkItem(item: Item) {
        if (item?.type !== "timer") return

        $activeTimers.forEach((a, i) => {
            if (a.showId === showId && a.slideId === layoutSlide.id && a.id === item.timer?.id) timer.push(i)
        })
    }

    // slide?.settings?.resolution
    $: resolution = getResolution(null, { $outputs, $styles })

    $: currentOutput = $outputs[getActiveOutputs()[0]]
    $: transparentOutput = !!currentOutput?.transparent
    $: currentStyle = $styles[currentOutput?.style || ""] || {}
    $: layers = Array.isArray(currentStyle.layers) ? currentStyle.layers : ["background"]

    let colorStyle = ""
    let style = ""
    $: {
        colorStyle = ""
        style = ""
        // $fullColors &&
        if (viewMode !== "lyrics" || noQuickEdit) colorStyle += `background-color: ${color};`
        if (!$fullColors && (viewMode !== "lyrics" || noQuickEdit)) colorStyle += `color: ${color};`
        if (viewMode === "lyrics" && !noQuickEdit) colorStyle += "background-color: transparent;"
        if (viewMode !== "grid" && viewMode !== "simple" && viewMode !== "groups" && !noQuickEdit && viewMode !== "lyrics") style += `width: calc(${100 / columns}% - 6px)`
    }

    $: slideFilter = getSlideFilter(layoutSlide)

    function getOutputColor(color: string) {
        if (output?.cached) {
            let rgb = color.includes("rgb") ? splitRgb(color) : hexToRgb(color)
            return "rgb(" + [rgb.r, rgb.g, rgb.b].join(" ") + " / 0.5);"
        }

        return color
    }

    function openNotes() {
        if ($textEditActive) textEditActive.set(false)
        activeTriggerFunction.set("slide_notes")

        activeEdit.set({ slide: index, items: [], showId })
        activePage.set("edit")
    }

    $: if ($refreshListBoxes >= 0) {
        setTimeout(() => {
            refreshListBoxes.set(-1)
        }, 100)
    }

    let profile = getAccess("shows")
    $: isLocked = show?.locked || profile.global === "read" || profile[show?.category || ""] === "read"

    // correct view order based on arranged order in Items.svelte (?.reverse())
    $: itemsList = clone(slide.items) || []

    // $: styleTemplate = getStyleTemplate(null, currentStyle)
    // || styleTemplate.settings?.backgroundColor

    function handleOpenInBrowserClick() {
        // The props showId and layoutSlide are available in this component's scope.
        if (!showId || !layoutSlide || !layoutSlide.id) {
            console.error("Missing showId or slideId for opening in browser")
            return
        }
        const slideId = layoutSlide.id
        const url = `http://localhost:5511/show/${showId}/${slideId}`
        console.log(`Requesting to open URL: ${url}`) // For debugging
        sendMain(Main.URL, url)
    }
</script>

<div
    class="main"
    class:active
    class:focused
    style="{output?.color ? 'outline: 2px solid ' + getOutputColor(output.color) + ';' : ''}width: {viewMode === 'grid' || viewMode === 'simple' || viewMode === 'groups' || noQuickEdit ? 100 / columns : 100}%;"
>
    <!-- group box -->
    {#if $fullColors}
        <div class="group_box" style="background-color: {color};" />
    {/if}
    <!-- icons -->
    {#if icons && !altKeyPressed && viewMode !== "simple" && !$focusMode}
        <Icons {slide} {timer} {layoutSlide} {background} {backgroundCount} {duration} {columns} {index} style={viewMode === "lyrics" ? "padding-top: 23px;" : ""} />
        <Actions {columns} {index} actions={layoutSlide.actions || {}} />
    {/if}
    <!-- content -->
    <div
        class="slide context #{isLocked ? 'default' : $focusMode ? 'slideFocus' : name === null ? 'slideChild' : 'slide'}"
        class:disabled={layoutSlide.disabled}
        class:afterEnd={endIndex !== null && index > endIndex}
        {style}
        tabindex={0}
        role="button"
        on:click
        on:keydown={triggerClickOnEnterSpace}
    >
        <div class="hover overlay" />
        <!-- <DropArea id="slide" hoverTimeout={0} file> -->
        <div style="width: 100%;height: 100%;">
            <SelectElem
                style={colorStyle}
                id="slide"
                data={{ index, showId }}
                draggable={!$focusMode && !isLocked}
                shiftRange={layoutSlides.map((_, index) => ({ index, showId }))}
                onlyRightClickSelect={$focusMode}
                selectable={!isLocked}
                trigger={list ? "column" : "row"}
            >
                <!-- TODO: tab select on enter -->
                {#if viewMode === "lyrics" && !noQuickEdit}
                    <!-- border-bottom: 1px dashed {color}; -->
                    <div class="label" data-title={removeTagsAndContent(name || "")} style="color: {color};margin-bottom: 5px;">
                        <span style="color: var(--text);opacity: 0.85;font-size: 0.9em;">{index + 1}</span>
                        <span class="text">{@html name === null ? "" : name === "." ? "" : name || "—"}</span>
                    </div>
                {/if}
                <Zoomed
                    background={slide.items?.length && (viewMode !== "lyrics" || noQuickEdit)
                        ? transparentOutput || $special.transparentSlides
                            ? "var(--primary);"
                            : slide.settings.color || currentStyle.background || "black"
                        : (viewMode !== "lyrics" || noQuickEdit ? color : "") || "transparent"}
                    checkered={viewMode !== "lyrics" && slide.items?.length > 0 && (transparentOutput || $special.transparentSlides) && !bg}
                    let:ratio
                    {resolution}
                    zoom={viewMode !== "lyrics" || noQuickEdit}
                    aspectRatio={viewMode !== "lyrics" || noQuickEdit}
                    disableStyle={viewMode === "lyrics" && !noQuickEdit}
                    relative={viewMode === "lyrics" && !noQuickEdit}
                >
                    <!-- backgrounds -->
                    {#if !altKeyPressed && bg && (viewMode !== "lyrics" || noQuickEdit) && (background || layers.includes("background"))}
                        {#key $refreshSlideThumbnails}
                            <div class="background" style="zoom: {1 / ratio};{slideFilter}" class:ghost={!background}>
                                <MediaLoader name={$dictionary.error?.load} ghost={!background} path={bgPath} {thumbnailPath} cameraGroup={bg.cameraGroup || ""} type={bg.type !== "player" ? bg.type : null} {mediaStyle} bind:duration getDuration />
                                <!-- loadFullImage={!!(bg.path || bg.id)} -->
                            </div>
                        {/key}
                    {/if}

                    <!-- effects -->
                    {#if !altKeyPressed && layoutSlide.effects?.length && (viewMode !== "lyrics" || noQuickEdit)}
                        {#each layoutSlide.effects as id}
                            {#if $effects[id]?.placeUnderSlide === true}
                                <Effect effect={{ id, ...$effects[id] }} preview />
                            {/if}
                        {/each}
                    {/if}

                    <!-- "underlays" -->
                    {#if !altKeyPressed && layoutSlide.overlays?.length && (viewMode !== "lyrics" || noQuickEdit)}
                        {#each layoutSlide.overlays as id}
                            {#if $overlays[id]?.placeUnderSlide === true}
                                {#each $overlays[id].items as item}
                                    <Textbox {item} ref={{ type: "overlay", id }} />
                                {/each}
                            {/if}
                        {/each}
                    {/if}

                    <!-- text content -->
                    {#if slide.items}
                        {#each itemsList as item, i}
                            {#if item && (viewMode !== "lyrics" || item.type === undefined || ["text", "events", "list"].includes(item.type))}
                                <!-- filter={layoutSlide.filterEnabled?.includes("foreground") ? layoutSlide.filter : ""} -->
                                <!-- backdropFilter={layoutSlide.filterEnabled?.includes("foreground") ? layoutSlide["backdrop-filter"] : ""} -->
                                <Textbox
                                    backdropFilter={layoutSlide["backdrop-filter"] || ""}
                                    disableListTransition
                                    {item}
                                    revealed={output?.line ?? -1}
                                    itemIndex={i}
                                    {ratio}
                                    slideIndex={index}
                                    ref={{
                                        showId,
                                        slideId: layoutSlide.id,
                                        id: layoutSlide.id
                                    }}
                                    style={viewMode !== "lyrics" || noQuickEdit}
                                    smallFontSize={viewMode === "lyrics" && !noQuickEdit}
                                    clickRevealed={!!output?.clickRevealed}
                                    {centerPreview}
                                    chords={item.chords?.enabled}
                                />
                            {/if}
                        {/each}
                    {/if}

                    <!-- effects -->
                    {#if !altKeyPressed && layoutSlide.effects?.length && (viewMode !== "lyrics" || noQuickEdit)}
                        {#each layoutSlide.effects as id}
                            {#if $effects[id] && !$effects[id]?.placeUnderSlide}
                                <Effect effect={{ id, ...$effects[id] }} preview />
                            {/if}
                        {/each}
                    {/if}

                    <!-- overlays -->
                    {#if !altKeyPressed && layoutSlide.overlays?.length && (viewMode !== "lyrics" || noQuickEdit)}
                        {#each layoutSlide.overlays as id}
                            {#if $overlays[id] && !$overlays[id]?.placeUnderSlide}
                                {#each $overlays[id].items as item}
                                    <Textbox {item} ref={{ type: "overlay", id }} />
                                {/each}
                            {/if}
                        {/each}
                    {/if}
                </Zoomed>

                <!-- {#if viewMode === "grid" && capped}Max limit reached{/if} -->

                {#if viewMode === "simple"}
                    <!-- WIP get any enabled output with maxLines, not just first one... -->
                    <!-- Object.values($outputs).find((a) => $styles[a.style || ""]?.lines) -->
                    {#if output?.maxLines}
                        <div class="lineProgress">
                            <!-- WIP line custom cleared slide cache color does not work -->
                            <div class="fill" style="width: {((output.line + 1) / output.maxLines) * 100}%;background-color: {getOutputColor(output.color)};" />
                        </div>
                    {/if}

                    <div data-title={name || ""} style="height: 2px;" />
                {:else if viewMode !== "lyrics" || noQuickEdit}
                    <!-- style="width: {resolution.width * zoom}px;" -->
                    <div class="label" data-title={removeTagsAndContent(name || "")} style={$fullColors ? `background-color: ${color};color: ${getContrast(color || "")};` : `border-bottom: 2px solid ${color || "var(--primary-darkest)"};`}>
                        {#if name === null && $fullColors && $activePage === "show"}
                            <!-- WIP this works fine without full colors, but is it neccesary? (UI vs UX) -->
                            <div class="childLink" style="background-color: {color};" class:full={$fullColors} />
                        {/if}
                        {#if output?.maxLines}
                            <div class="lineProgress">
                                <div class="fill" style="width: {((output.line + 1) / output.maxLines) * 100}%;background-color: {getOutputColor(output.color)};" />
                            </div>
                        {/if}
                        {#if slide.notes && icons}
                            <button class="notes" data-title={slide.notes} on:click={openNotes}>
                                <Icon id="notes" white right />
                                <span>{slide.notes}</span>
                            </button>
                        {/if}

                        <!-- <div class="label" title={name || ""} style="border-bottom: 2px solid {color};"> -->
                        <!-- font-size: 0.8em; -->
                        <span style="color: var(--text);opacity: 0.85;font-size: 0.9em;">{index + 1}</span>
                        <span class="text" style={name === null ? "opacity: 0;" : ""}>{@html name === null ? "-" : name === "." ? "" : name || "—"}</span>
                        <!--HTML SHOW
                        <button class="open-in-browser-btn" title="Open slide in browser" on:click={handleOpenInBrowserClick}>
                            <Icon id="open_in_new" />
                        </button>
                        -->
                    </div>
                {/if}
            </SelectElem>
        </div>
        <!-- </DropArea> -->
    </div>
    {#if viewMode === "list" && !noQuickEdit}
        <hr />
        <!-- <div bind:this={textElem} class="quickEdit edit" tabindex={0} contenteditable bind:innerHTML={html}>
      {@html html}
    </div> -->
        <div class="quickEdit" style="font-size: {(-1.1 * $slidesOptions.columns + 12) / 6}em;" data-index={index}>
            {#key $refreshListBoxes >= 0 && $refreshListBoxes !== index}
                {#if slide.items}
                    {#each itemsList as item, itemIndex}
                        {#if item.lines}
                            <Editbox {item} ref={{ showId, id: layoutSlide.id }} editIndex={index} index={itemIndex} plain />
                        {/if}
                    {/each}
                {/if}
            {/key}
        </div>
    {/if}
</div>

<style>
    .main {
        display: flex;
        position: relative;
        padding: 2px;
        /* height: fit-content; */
    }

    .slide {
        /* padding: 3px; */
        background-color: var(--primary-darkest);
        z-index: 0;
        outline-offset: 0;
        width: 100%;

        position: relative;
        display: flex;

        /* height: fit-content; */
        /* border: 2px solid var(--primary-lighter); */

        /* border-radius: 4px; */
    }

    /* .slide :global(.selectElem#slide) {
        border-radius: 4px;
    }
    .slide :global(.zoomed .slide) {
        border-top-left-radius: 4px;
        border-top-right-radius: 4px;
    } */

    .slide :global(.isSelected) {
        outline: 5px solid var(--text) !important;
    }

    .main.focused {
        outline: 2px solid var(--secondary-opacity);
        outline-offset: -1px;
        z-index: 2;
    }
    .main.active {
        /* outline: 3px solid var(--secondary); */
        outline: 2px solid var(--secondary);
        outline-offset: -1px;
        /* this z-index causes the button title to show behind! */
        /* z-index: 2; */
    }

    .group_box {
        position: absolute;
        width: 100%;
        height: 100%;
        top: 0;
        inset-inline-start: 0;

        opacity: 0.25;
    }

    .slide.afterEnd {
        opacity: 0.7;
    }
    .slide.disabled {
        opacity: 0.2;
    }

    .slide:hover > .hover {
        /* background-color: var(--primary-lighter); */
        /* filter: brightness(1.1); */
        opacity: 1;
    }
    .hover {
        pointer-events: none;
        width: 100%;
        height: 100%;
        opacity: 0;
        background-color: rgb(255 255 255 / 0.05);
        position: absolute;
        top: 0;
        inset-inline-start: 0;
        z-index: 1;
    }

    .background {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
    }
    .background.ghost {
        opacity: 0.4;
    }
    .background :global(img) {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }

    .label {
        position: relative;
        background-color: var(--primary-darkest);
        display: flex;
        padding: 5px;
        padding-bottom: 3px;
        font-size: 0.8em;
        font-weight: bold;
        align-items: center;
        /* opacity: 0.8; */

        /* border-bottom-left-radius: 4px;
        border-bottom-right-radius: 4px; */
    }

    .label .text {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
    }

    .label .text :global(.group_count) {
        color: var(--text);
        opacity: 0.3;
        /* opacity: 0.8; */
        font-size: 0.8em;
    }

    .childLink {
        position: absolute;
        inset-inline-start: 0;
        bottom: 0;
        transform: translate(-100%, 100%);
        width: 8px;
        height: 2px;
    }
    .childLink.full {
        transform: translate(-100%, 0);
        height: 24px;
    }

    .lineProgress {
        position: absolute;
        top: 0;
        inset-inline-start: 0;
        transform: translateY(-100%);
        width: 100%;
        height: 2px;
        z-index: 2;
        background-color: var(--primary-darkest);
    }
    .lineProgress .fill {
        width: 0;
        height: 100%;
        background-color: var(--secondary);
    }

    .notes {
        display: flex;
        align-items: center;

        position: absolute;
        top: 0;
        inset-inline-start: 0;
        transform: translateY(-100%);
        width: 100%;
        padding: 4px 8px;
        background-color: rgb(0 0 0 / 0.5);
        border: none;
        color: white;
        font-weight: normal;

        cursor: pointer;
        transition: 0.2s background-color;
    }
    .notes:hover {
        background-color: rgb(255 255 255 / 0.2);
    }

    .label .text {
        flex-grow: 1; /* Allow text to take available space */
        margin-inline: 15px 5px; /* Keep existing left margin if needed | Space between text and button */
        /* width: 100%; */ /* Potentially remove or adjust this if flex-grow is used */
        margin-inline-end: 15px; /* Keep existing right margin if needed, or adjust for button */
        text-align: center;
        overflow-x: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* .open-in-browser-btn {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 0 4px;
        margin-inline-start: auto;
        display: flex;
        align-items: center;
    }
    .open-in-browser-btn:hover {
        opacity: 0.7;
    } */

    hr {
        height: 100%;
        width: 3px;
        border: none;
        margin: 0 10px;
        background-color: var(--primary-lighter);
    }

    .quickEdit {
        display: flex;
        flex-direction: column;
        gap: 10px;
        justify-content: space-between;

        background-color: rgb(0 0 0 / 0.8);
        color: white;
        padding: 10px;
        flex: 1;

        overflow: auto;
        z-index: 2;
    }
    .quickEdit :global(.editItem) {
        height: 100%;
    }

    .quickEdit :global(.placeholder) {
        top: 0;
        height: 100%;
        padding: 15px 0;
        width: unset !important;
        /* font-size: 1.5em; */
    }
</style>
