<script lang="ts">
    import { activeStage, activeTimers, allOutputs, currentWindow, dictionary, outputs, outputSlideCache, previewBuffers, stageShows, timers, variables } from "../../stores"
    import { sendBackgroundToStage } from "../../utils/stageTalk"
    import autosize from "../edit/scripts/autosize"
    import { keysToID, sortByName } from "../helpers/array"
    import { getActiveOutputs } from "../helpers/output"
    import { getStyles } from "../helpers/style"
    import Media from "../output/layers/Media.svelte"
    import PreviewCanvas from "../output/preview/PreviewCanvas.svelte"
    import SlideProgress from "../slide/views/SlideProgress.svelte"
    import Timer from "../slide/views/Timer.svelte"
    import Variable from "../slide/views/Variable.svelte"
    import Clock from "../system/Clock.svelte"
    import Movebox from "../system/Movebox.svelte"
    import SlideNotes from "./items/SlideNotes.svelte"
    import SlideText from "./items/SlideText.svelte"
    import VideoTime from "./items/VideoTime.svelte"
    import { getCustomStageLabel } from "./stage"

    export let id: string
    export let item: any
    export let show: any = null
    export let ratio: number
    export let edit: boolean = false
    $: currentShow = show === null ? ($activeStage.id ? $stageShows[$activeStage.id] : null) : show
    $: next = id.includes("next")

    export let mouse: any = null
    function mousedown(e: any) {
        if (!edit) return

        console.log(e)
        activeStage.update((ae) => {
            if (e.ctrlKey || e.metaKey) {
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
                height: e.clientY / ratio - target.offsetHeight,
            },
            item: { type: "stage", ...item },
            e: e,
        }
    }

    function keydown(e: any) {
        if (!edit) return

        if ((e.key === "Backspace" || e.key === "Delete") && $activeStage.items.includes(id) && !document.activeElement?.closest(".stage_item") && !document.activeElement?.closest(".edit")) {
            // TODO: history??
            $stageShows[$activeStage.id!].items[id].enabled = false
            activeStage.set({ id: $activeStage.id, items: [] })
        }
    }

    function deselect(e: any) {
        if (e.target.closest(".stageTools")) return

        if ((edit && !e.ctrlKey && !e.metaKey && e.target.closest(".stage_item")?.id !== id && $activeStage.items.includes(id) && !e.target.closest(".stage_item")) || e.target.closest(".panel")) {
            activeStage.update((ae) => {
                ae.items = []
                return ae
            })
        }
    }

    // timer
    let today = new Date()
    setInterval(() => (today = new Date()), 1000)

    $: fontSize = Number(getStyles(item.style, true)?.["font-size"] || 0) || 100 // item.autoFontSize ||

    let alignElem
    let size = 100
    // currentSlide & timeout to update auto size properly if slide notes
    $: if (alignElem && item && currentSlide !== undefined) setTimeout(() => (size = autosize(alignElem, { type: "growToFit", textQuery: ".autoFontSize" })))
    $: autoSize = fontSize !== 100 ? Math.max(fontSize, size) : size

    // SLIDE
    $: stageOutputId = currentShow?.settings?.output || getActiveOutputs($currentWindow === "output" ? $allOutputs : $outputs, false, true, true)[0]
    $: currentOutput = $outputs[stageOutputId] || $allOutputs[stageOutputId] || {}
    $: currentSlide = currentOutput.out?.slide || (next ? $outputSlideCache[stageOutputId] || null : null)

    let timeout: any = null
    $: if (stageOutputId && ($allOutputs || $outputs)) startTimeout()
    function startTimeout() {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(getCurrentBackground, 100)
    }
    let currentBackground: any
    async function getCurrentBackground() {
        if (!id.includes("slide")) return

        let currentOutputs = $currentWindow ? $allOutputs : $outputs
        let bg = await sendBackgroundToStage(stageOutputId, currentOutputs, true)

        currentBackground = bg
    }

    // $: resolution = getResolution(resolution, { $outputs, $styles })

    $: isDisabledVariable = id.includes("variables") && $variables[id.split("#")[1]]?.enabled === false

    let firstTimerId: string = ""
    $: if (id.includes("first_active_timer")) {
        firstTimerId = $activeTimers[0]?.id
        if (!firstTimerId) firstTimerId = sortByName(keysToID($timers)).find((timer) => timer.type !== "counter")?.id || ""
    }

    let itemStyle: string = ""
    let textStyle: string = ""
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

    let video: any
    function loaded() {
        if (!video) return
        video.pause()
        video.currentTime = video.duration / 2
    }
</script>

<svelte:window on:keydown={keydown} on:mousedown={deselect} />

<div
    {id}
    class="stage_item item"
    class:border={currentShow?.settings?.labels}
    class:outline={edit}
    class:selected={edit && $activeStage.items.includes(id)}
    class:isDisabledVariable
    class:isOutput={!!$currentWindow}
    style="{itemStyle}{id.includes('slide') && !id.includes('tracker') ? '' : textStyle}{edit ? `outline: ${3 / ratio}px solid rgb(255 255 255 / 0.2);` : ''}--labelColor: {currentShow?.settings?.labelColor || '#d0a853'};"
    on:mousedown={mousedown}
>
    {#if currentShow?.settings?.labels && id}
        <div class="label">{getCustomStageLabel(id, $dictionary)}</div>
    {/if}
    {#if edit}
        <Movebox {ratio} active={$activeStage.items.includes(id)} />
    {/if}

    {#if id.includes("current_output")}
        <span style="pointer-events: none;">
            {#if id.includes("_alpha") && currentOutput.keyOutput}
                <PreviewCanvas capture={$previewBuffers[currentOutput.keyOutput || ""]} id={currentOutput.keyOutput} fullscreen />
            {:else}
                <PreviewCanvas capture={$previewBuffers[stageOutputId]} id={stageOutputId} fullscreen />
            {/if}
        </span>
    {:else}
        <div bind:this={alignElem} class="align" style="--align: {item.align};--text-align: {item.alignX};">
            <div>
                {#if id.includes("slide_tracker")}
                    <SlideProgress tracker={item.tracker || {}} autoSize={item.auto !== false ? autoSize : fontSize} />
                {:else if id.includes("notes")}
                    <SlideNotes {currentSlide} {next} autoSize={item.auto !== false ? autoSize : fontSize} />
                {:else if id.includes("slide_text")}
                    <!-- refresh auto size if changing stage layout - this made item unmovable -->
                    <!-- {#key item} -->
                    <SlideText {currentSlide} {next} stageItem={item} chords={item.chords} ref={{ type: "stage", id }} autoSize={item.auto !== false} {fontSize} {textStyle} />
                    <!-- {/key} -->
                {:else if id.includes("slide")}
                    <span style="pointer-events: none;">
                        {#if currentBackground}
                            {@const slideBackground = next ? currentBackground.next : currentBackground}
                            {#if slideBackground?.path}
                                <div class="image" style="position: absolute;left: 0;top: 0;width: 100%;height: 100%;">
                                    <Media path={slideBackground.path} path2={slideBackground.filePath} mediaStyle={slideBackground.mediaStyle || {}} mirror bind:video on:loaded={loaded} />
                                </div>
                            {/if}
                        {/if}

                        <!-- refresh to update auto sizes -->
                        {#key currentSlide}
                            <SlideText {currentSlide} {next} stageItem={item} chords={item.chords} ref={{ type: "stage", id }} autoSize={item.auto !== false} {fontSize} {textStyle} style />
                        {/key}
                    </span>
                {:else if id.includes("clock")}
                    <Clock style={false} autoSize={item.auto !== false ? autoSize : fontSize} seconds={item.clock?.seconds ?? true} />
                {:else if id.includes("video")}
                    <VideoTime outputId={stageOutputId} autoSize={item.auto !== false ? autoSize : fontSize} reverse={id.includes("countdown")} />
                {:else if id.includes("first_active_timer")}
                    <Timer {item} id={firstTimerId} {today} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" />
                {:else if id.includes("timers")}
                    {#if $timers[id.split("#")[1]]}
                        <Timer {item} id={id.split("#")[1]} {today} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" />
                    {/if}
                {:else if id.includes("variables")}
                    {#if $variables[id.split("#")[1]]}
                        <Variable id={id.split("#")[1]} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" ref={{ type: "stage", id }} hideText={!!$currentWindow} />
                    {/if}
                {:else}
                    {id}
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .stage_item {
        font-family: Arial, Helvetica, sans-serif;

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
    }

    .align {
        height: 100%;
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

        line-height: normal;
        letter-spacing: normal;
        word-spacing: normal;
    }

    .align :global(.item .align) {
        align-items: var(--align);
    }
    .align :global(.item .align .lines) {
        text-align: var(--text-align);
    }
</style>
