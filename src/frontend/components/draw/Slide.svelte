<script lang="ts">
    import { draw, drawSettings, drawTool, outputs, styles } from "../../stores"
    import { getActiveOutputs, getResolution } from "../helpers/output"
    import Output from "../output/Output.svelte"
    import { getStyleResolution } from "../slide/getStyleResolution"

    $: outputId = getActiveOutputs($outputs, true, true, true)[0]
    // $: ref = $activeShow?.id ? _show("active").layouts("active").ref()[0] : null
    // $: currentOutput = $outputs[outputId] || {}
    // $: Slide = currentOutput.out?.slide && ref ? _show("active").slides([ref[currentOutput.out.slide.index!]?.id]).get()[0] : null

    let width: number = 0
    let height: number = 0
    // Slide?.settings?.resolution
    $: resolution = getResolution(null, { $outputs, $styles })
    let ratio: number = 0

    let parent: any
    function onMouseMove(e: any) {
        let slide = e.target.closest(".slide")

        if ((!e.buttons && $drawSettings[$drawTool]?.hold) || e.target.closest(".parent") !== parent || !slide) {
            draw.set(null)
            return
        }

        let centerElem = slide.closest(".parent")?.closest(".center")

        let x = (e.clientX - slide.offsetLeft - (centerElem?.offsetLeft || 0)) / ratio
        let y = (e.clientY - slide.offsetTop - (centerElem?.offsetTop || 0)) / ratio

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
            const previousSize = a[$drawTool].size
            newSize = Math.max(1, Math.min(2000, previousSize - newSize * direction))

            let sizeDiff = newSize - previousSize
            a[$drawTool].size = newSize

            if ($drawTool === "zoom") sizeDiff = 0
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
    <div style="width: 100%;height: 100%;display: flex;flex-direction: column;justify-content: center;" on:mousedown={onMouseMove} on:wheel|passive={wheel}>
        <Output {outputId} style={getStyleResolution(resolution, width, height, "fit")} bind:ratio mirror />
    </div>
</div>

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
