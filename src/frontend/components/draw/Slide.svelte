<script lang="ts">
    import { activeShow, draw, drawSettings, drawTool, outputs, styles } from "../../stores"
    import { getActiveOutputs, getResolution } from "../helpers/output"
    import { _show } from "../helpers/shows"
    import Output from "../output/Output.svelte"
    import { getStyleResolution } from "../slide/getStyleResolution"

    $: ref = $activeShow?.id ? _show("active").layouts("active").ref()[0] : null
    $: currentOutput = $outputs[getActiveOutputs()[0]]
    $: Slide = currentOutput.out?.slide && ref ? _show("active").slides([ref[currentOutput.out.slide.index!]?.id]).get()[0] : null

    let width: number = 0
    let height: number = 0
    $: resolution = getResolution(Slide?.settings?.resolution, { $outputs, $styles })
    let ratio: number = 0

    let parent: any
    function onMouseMove(e: any) {
        let slide = e.target.closest(".slide")

        if ((!e.buttons && $drawSettings[$drawTool]?.hold) || e.target.closest(".parent") !== parent || !slide) {
            draw.set(null)
            return
        }

        let x = (e.clientX - slide.offsetLeft - (slide.closest(".parent").offsetLeft || 0)) / ratio
        let y = (e.clientY - slide.offsetTop - (slide.closest(".parent").offsetTop || 0)) / ratio

        if ($drawTool === "pointer" || $drawTool === "focus") {
            let size = $drawSettings[$drawTool]?.size
            x -= size / 2
            y -= size / 2
        }

        draw.set({ x, y })
    }

    const wheel = (e: any) => {
        if (draw === null || !$drawSettings[$drawTool]?.size || e.target.closest(".parent") !== parent || !e.target.closest(".slide")) return

        drawSettings.update((a) => {
            let newSize = 10
            if (e.altKey) newSize = 1
            if (e.ctrlKey || e.metaKey) newSize = 25

            let direction: number = e.deltaY > 0 ? 1 : -1
            newSize = Math.max(1, Math.min(2000, a[$drawTool].size - newSize * direction))

            let sizeDiff = newSize - a[$drawTool].size
            a[$drawTool].size = newSize

            if ($draw) draw.set({ x: $draw.x - sizeDiff / 2, y: $draw.y - sizeDiff / 2 })

            return a
        })
    }
</script>

<svelte:window
    on:mouseup={() => {
        if ($drawSettings[$drawTool]?.hold) draw.set(null)
    }}
    on:mousemove={onMouseMove}
/>

<div class="parent" bind:this={parent} bind:offsetWidth={width} bind:offsetHeight={height}>
    <div style="width: 100%;height: 100%;display: flex;flex-direction: column;justify-content: center;" on:mousedown={onMouseMove} on:wheel={wheel}>
        <!-- TODO: draw get video time! -->
        <!-- transition={{ type: "none", duration: 0, easing: "linear" }} -->
        <Output bind:ratio center style={getStyleResolution(resolution, width, height, "fit")} disableTransitions mirror />
    </div>
</div>

<!-- WIP: using capture is too slow -->
<!-- $: outputId = getActiveOutputs($outputs)[0]

let width: number = 0
let height: number = 0

let parent: any
function onMouseMove(e: any) {
    console.log(e)

    let slide = e.target.closest(".previewCanvas")
    console.log(slide)

    if ((!e.buttons && $drawSettings[$drawTool]?.hold) || e.target.closest(".parent") !== parent || !slide) {
        draw.set(null)
        return
    }

    let x = e.clientX - slide.offsetLeft - (slide.closest(".parent").offsetLeft || 0)
    let y = e.clientY - slide.offsetTop - (slide.closest(".parent").offsetTop || 0)

    if ($drawTool === "pointer" || $drawTool === "focus") {
        let size = $drawSettings[$drawTool]?.size
        x -= size / 2
        y -= size / 2
    }

    draw.set({ x, y })
}

const wheel = (e: any) => {
    if (draw === null || !$drawSettings[$drawTool]?.size || e.target.closest(".parent") !== parent || !e.target.closest(".previewCanvas")) return

    drawSettings.update((a) => {
        let direction: number = e.deltaY > 0 ? -1 : 1
        let newSize = 10
        if (e.altKey) newSize = 1
        if (e.ctrlKey || e.metaKey) newSize = 25
        newSize = Math.max(1, Math.min(2000, a[$drawTool].size - newSize * direction))
        let sizeDiff = newSize - a[$drawTool].size
        a[$drawTool].size = newSize
        if ($draw) draw.set({ x: $draw.x - sizeDiff / 2, y: $draw.y - sizeDiff / 2 })
        return a
    })
}

$: capture = $previewBuffers[outputId]
</script>

<div class="parent" bind:this={parent} bind:offsetWidth={width} bind:offsetHeight={height}>
    <div style="width: 100%;height: 100%;display: flex;flex-direction: column;justify-content: center;" on:mousedown={onMouseMove} on:wheel={wheel}>
        {#if capture}
            <PreviewCanvas style={getStyleResolution(capture.size, width, height, "fit")} {capture} />
        {/if}
    </div>
</div> -->

<style>
    .parent {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        /* padding: 10px; */
        overflow: auto;
    }
</style>
