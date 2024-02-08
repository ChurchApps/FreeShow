<script lang="ts">
    import { activeStage, allOutputs, currentWindow, outputs, previewBuffers, showsCache, stageShows, timers, variables } from "../../stores"
    import { sendBackgroundToStage } from "../../utils/stageTalk"
    import { getAutoSize } from "../edit/scripts/autoSize"
    import T from "../helpers/T.svelte"
    import { getActiveOutputs } from "../helpers/output"
    import { _show } from "../helpers/shows"
    import { getStyles } from "../helpers/style"
    import Image from "../media/Image.svelte"
    import PreviewCanvas from "../output/PreviewCanvas.svelte"
    import Timer from "../slide/views/Timer.svelte"
    import Variable from "../slide/views/Variable.svelte"
    import Clock from "../system/Clock.svelte"
    import Movebox from "../system/Movebox.svelte"
    import SlideNotes from "./items/SlideNotes.svelte"
    import SlideText from "./items/SlideText.svelte"
    import VideoTime from "./items/VideoTime.svelte"

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

    let height: number = 0
    let width: number = 0
    $: fontSize = Number(getStyles(item.style, true)?.["font-size"] || 0) || 100 // item.autoFontSize ||

    $: size = getAutoSize(item, { width, height })
    // $: size = Math.min(height, width) / 2
    $: autoSize = fontSize !== 100 ? Math.max(fontSize, size) : size

    // SLIDE
    let slide
    $: stageOutputId = currentShow?.settings?.output || getActiveOutputs($outputs, true, true, true)[0]
    $: currentOutput = $outputs[stageOutputId] || $allOutputs[stageOutputId] || {}
    $: currentSlide = currentOutput.out?.slide
    $: currentBackground = sendBackgroundToStage(stageOutputId, $currentWindow ? $allOutputs : $outputs, true)
    $: index = currentSlide && currentSlide.index !== undefined && currentSlide.id !== "temp" ? currentSlide.index + (next ? 1 : 0) : null
    $: layoutSlide = index !== null && currentSlide ? _show(currentSlide.id).layouts("active").ref()[0][index!] || {} : {}
    $: slideId = layoutSlide.id
    $: slide = currentSlide && slideId ? $showsCache[currentSlide.id].slides[slideId] : null

    // $: resolution = getResolution(resolution, { $outputs, $styles })

    $: isDisabledVariable = id.includes("variables") && $variables[id.split("#")[1]]?.enabled === false
</script>

<svelte:window on:keydown={keydown} on:mousedown={deselect} />

<div
    {id}
    bind:offsetHeight={height}
    bind:offsetWidth={width}
    class="stage_item item"
    class:outline={edit}
    class:selected={edit && $activeStage.items.includes(id)}
    class:isDisabledVariable
    class:isOutput={!!$currentWindow}
    style="{item.style};{edit ? `outline: ${3 / ratio}px solid rgb(255 255 255 / 0.2);` : ''}"
    on:mousedown={mousedown}
>
    {#if currentShow?.settings?.labels && id}
        <div class="label">
            {#key id}
                <T id="stage.{id.split('#')[1]}" />
            {/key}
        </div>
    {/if}
    {#if edit}
        <Movebox {ratio} active={$activeStage.items.includes(id)} />
    {/if}

    {#if id.includes("current_output")}
        {#if slide}
            <span style="pointer-events: none;">
                <!-- <Output specificOutput={stageOutputId} bind:ratio center style={getStyleResolution(resolution, width, height, "fit")} disableTransitions mirror /> -->
                {#if id.includes("_alpha") && currentOutput.keyOutput}
                    <PreviewCanvas capture={$previewBuffers[currentOutput.keyOutput || ""]} id={currentOutput.keyOutput} fullscreen />
                {:else}
                    <PreviewCanvas capture={$previewBuffers[stageOutputId]} id={stageOutputId} fullscreen />
                {/if}
            </span>
        {/if}
    {:else}
        <div class="align" style={item.align}>
            <div>
                {#if id.includes("notes")}
                    <SlideNotes {currentSlide} {next} autoSize={item.auto !== false ? autoSize : fontSize} />
                {:else if id.includes("slide_text")}
                    <SlideText {currentSlide} {next} stageItem={item} chords={item.chords} ref={{ type: "stage", id }} autoSize={item.auto !== false} {fontSize} />
                {:else if id.includes("slide")}
                    <span style="pointer-events: none;">
                        {#if currentBackground}
                            {@const slideBackground = next ? currentBackground.next : currentBackground}
                            {#if slideBackground?.path}
                                <div class="image" style="position: absolute;left: 0;top: 0;width: 100%;height: 100%;">
                                    <Image path={slideBackground.path} mediaStyle={slideBackground.mediaStyle || {}} />
                                </div>
                            {/if}
                        {/if}

                        <SlideText {currentSlide} {next} stageItem={item} chords={item.chords} ref={{ type: "stage", id }} autoSize={item.auto !== false} {fontSize} style />
                    </span>
                {:else if id.includes("clock")}
                    <Clock style={false} autoSize={item.auto !== false ? autoSize : fontSize} />
                {:else if id.includes("video")}
                    <VideoTime autoSize={item.auto !== false ? autoSize : fontSize} reverse={id.includes("countdown")} />
                {:else if id.includes("timers")}
                    {#if $timers[id.split("#")[1]]}
                        <Timer id={id.split("#")[1]} {today} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" />
                    {/if}
                {:else if id.includes("variables")}
                    {#if $variables[id.split("#")[1]]}
                        <Variable id={id.split("#")[1]} style="font-size: {item.auto !== false ? autoSize : fontSize}px;" hideText={!!$currentWindow} />
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
</style>
