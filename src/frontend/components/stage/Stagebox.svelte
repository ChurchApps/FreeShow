<script lang="ts">
    import { onDestroy } from "svelte"
    import type { StageItem, StageLayout } from "../../../types/Stage"
    import { activePopup, activeStage, activeTimers, allOutputs, currentWindow, dictionary, outputs, outputSlideCache, previewBuffers, refreshEditSlide, special, stageShows, timers, variables } from "../../stores"
    import { sendBackgroundToStage } from "../../utils/stageTalk"
    import EditboxLines from "../edit/editbox/EditboxLines.svelte"
    import autosize from "../edit/scripts/autosize"
    import { clone, keysToID, sortByName } from "../helpers/array"
    import Icon from "../helpers/Icon.svelte"
    import { getActiveOutputs, getStageResolution, percentageStylePos } from "../helpers/output"
    import { getStyles } from "../helpers/style"
    import Button from "../inputs/Button.svelte"
    import Media from "../output/layers/Media.svelte"
    import PreviewCanvas from "../output/preview/PreviewCanvas.svelte"
    import SlideItems from "../slide/SlideItems.svelte"
    import Textbox from "../slide/Textbox.svelte"
    import SlideProgress from "../slide/views/SlideProgress.svelte"
    import Timer from "../slide/views/Timer.svelte"
    import Variable from "../slide/views/Variable.svelte"
    import Clock from "../system/Clock.svelte"
    import Movebox from "../system/Movebox.svelte"
    import SlideNotes from "./items/SlideNotes.svelte"
    import SlideText from "./items/SlideText.svelte"
    import VideoTime from "./items/VideoTime.svelte"
    import { getCustomStageLabel, stageItemToItem } from "./stage"
    import { isConditionMet } from "../edit/scripts/itemHelpers"
    import { getItemText } from "../edit/scripts/textStyle"

    export let id: string
    export let item: StageItem
    export let stageLayout: StageLayout | null = null
    export let ratio: number
    export let preview = false
    export let edit = false

    $: currentShow = stageLayout === null ? ($activeStage.id ? $stageShows[$activeStage.id] : null) : stageLayout

    $: slideOffset = item.type ? Number(item.slideOffset || 0) : id.includes("next") ? 1 : 0

    export let mouse: any = null
    function mousedown(e: any) {
        if (!edit) return

        console.log(e)
        activeStage.update((ae) => {
            if (e.shiftKey) {
                if (ae.items.includes(id)) {
                    if (e.target.closest(".line")) ae.items.splice(ae.items.indexOf(id), 1)
                } else ae.items.push(id)
            } else ae.items = [id]

            return ae
        })

        let target = e.target.closest(".stage_item")

        mouse = {
            x: e.clientX,
            y: e.clientY,
            width: target.offsetWidth,
            height: target.offsetHeight,
            top: target.offsetTop,
            left: target.offsetLeft,
            offset: {
                x: (e.clientX - e.target.closest(".slide").offsetLeft) / ratio - target.offsetLeft,
                y: (e.clientY - e.target.closest(".slide").offsetTop) / ratio - target.offsetTop,
                width: e.clientX / ratio - target.offsetWidth,
                height: e.clientY / ratio - target.offsetHeight
            },
            item: { type: "stage", ...item },
            e: e
        }
    }

    function keydown(e: KeyboardEvent) {
        if (!edit) return

        if ((e.key === "Backspace" || e.key === "Delete") && $activeStage.items.includes(id) && !document.activeElement?.closest(".stage_item") && !document.activeElement?.closest(".edit")) {
            // TODO: history??
            stageShows.update((a) => {
                delete a[$activeStage.id!].items[id]
                return a
            })
            activeStage.set({ ...$activeStage, items: [] })
        }
    }

    function deselect(e: any) {
        if (e.target.closest(".stageTools") || e.target.closest(".contextMenu") || $activePopup) return

        if ((edit && !e.shiftKey && e.target.closest(".stage_item")?.id !== id && $activeStage.items.includes(id) && !e.target.closest(".stage_item")) || e.target.closest(".panel")) {
            activeStage.update((ae) => {
                ae.items = []
                return ae
            })
        }
    }

    // timer
    let today = new Date()
    const dateInterval = setInterval(() => (today = new Date()), 1000)

    onDestroy(() => clearInterval(dateInterval))

    $: fontSize = Number(getStyles(item.style, true)?.["font-size"] || 0) || 100 // item.autoFontSize ||

    let alignElem
    let size = 100
    // currentSlide & timeout to update auto size properly if slide notes
    $: if (alignElem && item && currentSlide !== undefined) setTimeout(() => (size = autosize(alignElem, { type: "growToFit", textQuery: ".autoFontSize" })))
    $: autoSize = fontSize !== 100 ? Math.max(fontSize, size) : size

    // SLIDE
    $: stageOutputId = currentShow?.settings?.output || getActiveOutputs($currentWindow === "output" ? $allOutputs : $outputs, false, true, true)[0]
    $: currentOutput = $outputs[stageOutputId] || $allOutputs[stageOutputId] || {}
    $: currentSlide = currentOutput.out?.slide || (slideOffset !== 0 ? $outputSlideCache[stageOutputId] || null : null)

    let timeout: NodeJS.Timeout | null = null
    $: if (stageOutputId && ($allOutputs || $outputs)) startTimeout()
    function startTimeout() {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(getCurrentBackground, 100)
    }
    let currentBackground: any
    async function getCurrentBackground() {
        if (item.type ? !item.includeMedia : !id.includes("slide")) return

        let currentOutputs = $currentWindow ? $allOutputs : $outputs
        let bg = await sendBackgroundToStage(stageOutputId, currentOutputs, true)

        currentBackground = bg
    }

    // $: resolution = getResolution(resolution, { $outputs, $styles })

    $: isDisabledVariable = id.includes("variables") && $variables[id.split("#")[1]]?.enabled === false

    let firstTimerId = ""
    $: if (!item.timer?.id || id.includes("first_active_timer")) {
        firstTimerId = $activeTimers[0]?.id
        if (!firstTimerId) firstTimerId = sortByName(keysToID($timers)).find((timer) => timer.type !== "counter")?.id || ""
    } else firstTimerId = ""

    let itemStyle = ""
    let textStyle = ""
    $: if (item.style) updateStyles()
    function updateStyles() {
        const styles = getStyles(item.style)
        const textStyleKeys = ["line-height", "text-decoration"]

        itemStyle = ""
        textStyle = ""

        Object.entries(styles).forEach(([key, value]) => {
            if (textStyleKeys.includes(key)) textStyle += `${key}: ${value};`
            else itemStyle += `${key}: ${value};`
        })
    }

    function getCustomStyle(style: string) {
        let outputResolution = getStageResolution()
        style = percentageStylePos(style, outputResolution)
        return style
    }

    let video: HTMLVideoElement | undefined
    function loaded() {
        if (!video) return
        video.pause()
        video.currentTime = video.duration / 2
    }

    $: if ($refreshEditSlide) {
        setTimeout(() => {
            refreshEditSlide.set(false)
        }, 100)
    }

    $: newItem = clone({ ...item, timer: { ...(item.timer || {}), id: firstTimerId || item.timer?.id } })

    // ACTIONS

    // conditions
    function removeConditions() {
        stageShows.update((a) => {
            if (!a[$activeStage.id!]?.items?.[id]?.conditions) return a
            delete a[$activeStage.id!].items[id].conditions
            return a
        })
    }

    $: contextId = item.type === "text" ? "stage_text_item" : item.type === "current_output" ? "stage_item_output" : "stage_item"

    let updater = 0
    const updaterInterval = setInterval(() => updater++, 3000)
    onDestroy(() => clearInterval(updaterInterval))

    $: showItemState = isConditionMet(item?.conditions?.showItem, getItemText(stageItemToItem(item)), "stage", updater)
</script>

<svelte:window on:keydown={keydown} on:mousedown={deselect} />

<div
    {id}
    class="stage_item item {edit ? `context #${contextId}` : ''}"
    class:border={currentShow?.settings?.labels}
    class:outline={edit}
    class:selected={edit && $activeStage.items.includes(id)}
    class:isDisabledVariable
    class:isOutput={!!$currentWindow}
    style="{getCustomStyle(itemStyle)}{id.includes('slide') && !id.includes('tracker') ? '' : textStyle}{edit ? `outline: ${3 / ratio}px solid rgb(255 255 255 / 0.2);` : ''}--labelColor: {currentShow?.settings?.labelColor || '#d0a853'};"
    on:mousedown={mousedown}
>
    {#if currentShow?.settings?.labels && id}
        <div class="label">{getCustomStageLabel(item.type || id, item, $dictionary)}</div>
    {/if}
    {#if edit}
        <Movebox {ratio} itemStyle={item.style} active={$activeStage.items.includes(id)} />

        <!-- ACTIONS -->
        <div class="actions">
            <!-- button -->
            {#if item?.button?.press || item?.button?.release}
                <div data-title={$dictionary.popup?.action} class="actionButton" style="zoom: {1 / ratio};inset-inline-start: 0;inset-inline-end: unset;">
                    <span style="padding: 5px;z-index: 3;font-size: 0;">
                        <Icon id="button" white />
                    </span>
                </div>
            {/if}

            <!-- conditions -->
            {#if Object.values(item?.conditions || {}).length}
                <div data-title={$dictionary.actions?.conditions} class="actionButton" style="zoom: {1 / ratio};inset-inline-start: 0;inset-inline-end: unset;background-color: var(--{showItemState ? '' : 'dis'}connected);">
                    <Button on:click={removeConditions} redHover>
                        <Icon id="light" white />
                    </Button>
                </div>
            {/if}
        </div>
    {/if}

    <div bind:this={alignElem} class="align" style="--align: {item.align};--text-align: {item.alignX};{item.type !== 'slide_text' || item.keepStyle ? 'height: 100%;' : ''}">
        <span style="pointer-events: none;width: 100%;height: 100%;">
            {#if item.type === "current_output" || id.includes("current_output")}
                {#if !$special.optimizedMode}
                    {#if id.includes("_alpha") && currentOutput.keyOutput}
                        <PreviewCanvas capture={$previewBuffers[currentOutput.keyOutput || ""]} id={currentOutput.keyOutput} fullscreen />
                    {:else}
                        <PreviewCanvas capture={$previewBuffers[stageOutputId]} id={stageOutputId} fullscreen />
                    {/if}
                {/if}
            {:else if item.type === "slide_text" || id.includes("slide")}
                {#if (item.type ? item.includeMedia : !id.includes("_text")) && currentBackground}
                    {@const slideBackground = slideOffset === 0 ? currentBackground : slideOffset === 1 ? currentBackground.next : null}
                    <!-- WIP this only includes "next" slide background -->
                    {#if typeof slideBackground?.path === "string"}
                        <div class="image" style="position: absolute;inset-inline-start: 0;top: 0;width: 100%;height: 100%;">
                            <Media path={slideBackground.path} path2={slideBackground.filePath} mediaStyle={slideBackground.mediaStyle || {}} mirror bind:video on:loaded={loaded} />
                        </div>
                    {/if}
                {/if}

                <!-- refresh to update auto sizes -->
                <!-- refresh auto size if changing stage layout with #key made item unmovable .. -->
                {#key currentSlide?.id || currentSlide?.index}
                    <SlideText
                        {currentSlide}
                        {slideOffset}
                        stageItem={item}
                        chords={typeof item.chords === "boolean" ? item.chords : item.chords?.enabled}
                        ref={{ type: "stage", id }}
                        autoSize={item.auto !== false}
                        {fontSize}
                        {textStyle}
                        style={item.type ? item.keepStyle : false}
                    />
                {/key}
            {:else if item.type === "slide_notes" || id.includes("notes")}
                <SlideNotes {currentSlide} {slideOffset} autoSize={item.auto !== false ? autoSize : fontSize} />
            {:else if item.type === "text"}
                {#if edit}
                    {#key $refreshEditSlide}
                        <span class="edit_item" style="pointer-events: initial;--font-size: {fontSize}px;">
                            <EditboxLines item={stageItemToItem(item)} ref={{ type: "stage", id }} index={-1} />
                        </span>
                    {/key}
                {:else}
                    <Textbox item={stageItemToItem(item)} ref={{ type: "stage", id }} {fontSize} stageAutoSize={item.auto} isStage />
                {/if}
            {:else if item.type}
                <SlideItems item={stageItemToItem(newItem)} ref={{ type: "stage", id }} fontSize={item.auto !== false ? autoSize : fontSize} {preview} />
            {:else}
                <!-- OLD CODE -->
                <div>
                    {#if id.includes("slide_tracker")}
                        <SlideProgress tracker={item.tracker || {}} autoSize={item.auto !== false ? autoSize : fontSize} />
                    {:else if id.includes("clock")}
                        <Clock style={false} autoSize={item.auto !== false ? autoSize : fontSize} seconds={item.clock?.seconds ?? true} dateFormat={item.clock?.show_date ? "DD/MM/YYYY" : "none"} />
                    {:else if id.includes("video")}
                        <VideoTime outputId={stageOutputId} autoSize={item.auto !== false ? autoSize : fontSize} reverse={id.includes("countdown")} />
                    {:else if id.includes("first_active_timer")}
                        <Timer item={stageItemToItem(item)} id={firstTimerId} {today} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" />
                    {:else if id.includes("timers")}
                        {#if $timers[id.split("#")[1]]}
                            <Timer item={stageItemToItem(item)} id={id.split("#")[1]} {today} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" />
                        {/if}
                    {:else if id.includes("variables")}
                        {#if $variables[id.split("#")[1]]}
                            <Variable id={id.split("#")[1]} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" ref={{ type: "stage", id }} hideText={!!$currentWindow} />
                        {/if}
                    {:else}
                        {id}
                    {/if}
                </div>
            {/if}
        </span>
    </div>
</div>

<style>
    .stage_item {
        /* inital values */
        font-family: Arial, Helvetica, sans-serif;
        text-shadow: 2px 2px 10px #000000;

        /* overflow is not hidden on stage display */
        /* overflow: hidden; */

        border-width: 0;
        border-style: solid;
    }

    .item.border {
        outline: 3px solid var(--labelColor) !important;
        outline-offset: 0;
    }

    .stage_item.outline {
        outline: 5px solid rgb(255 255 255 / 0.2);
    }
    .stage_item.selected {
        outline: 5px solid var(--secondary);
        overflow: visible;
        z-index: 4;
    }
    .stage_item.selected :global(.item),
    .stage_item.selected :global(.item .align) {
        overflow: visible;
    }

    .align {
        /* height: 100%; */
        display: flex;
        text-align: center;
        align-items: center;
    }

    .align div,
    .align :global(.item) {
        width: 100%;
        height: 100%;
        color: unset;
        /* overflow-wrap: break-word; */
    }

    .isDisabledVariable {
        opacity: 0.5;
    }
    .isDisabledVariable.isOutput {
        display: none;
    }

    .label {
        position: absolute;
        top: 0;
        transform: translateY(calc(-100% - 3px));
        width: 100%;

        background: rgb(0 0 0 / 0.4);
        color: var(--labelColor);

        /* RESET LABEL STYLE */
        font-family: sans-serif;
        font-size: 42px;
        -webkit-text-stroke-width: 0;
        text-shadow: none;

        font-weight: normal;
        font-style: normal;
        text-align: center;
        text-transform: none;

        line-height: normal;
        letter-spacing: normal;
        word-spacing: normal;
    }

    .align :global(.item .align) {
        align-items: var(--align);
    }
    .align .edit_item {
        height: 100%;
        display: flex;
        align-items: var(--align);
    }
    .align .edit_item :global(.align) {
        height: auto;
        width: 100%;
    }

    .align :global(.item .align .lines),
    .align .edit_item :global(.align .edit) {
        text-align: var(--text-align);
    }

    .align .edit_item :global(.align .edit span) {
        font-size: var(--font-size);
    }

    /* ACTIONS */

    .actions {
        position: absolute;
        top: 0;
        inset-inline-start: 0;

        display: flex;
        flex-direction: column;
    }
    .actionButton {
        display: flex;
        align-items: center;
        background-color: var(--focus);
        color: var(--text);
    }
    .actionButton :global(button) {
        padding: 5px !important;
        z-index: 3;
    }
</style>
