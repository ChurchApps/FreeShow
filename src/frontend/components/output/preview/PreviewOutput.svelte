<script lang="ts">
    import { onDestroy } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import { capturedOutputs, livePrepare, outputs, styles } from "../../../stores"
    import { onStreamFrame } from "../../../utils/streamPort"
    import { send } from "../../../utils/request"
    import { StreamCanvasRenderer } from "../../drawer/live/streamCanvas"
    import Icon from "../../helpers/Icon.svelte"
    //import { currentWindow, outputs, styles } from "../../../stores"
    import { getResolution } from "../../helpers/output"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import StageLayout from "../../stage/StageLayout.svelte"
    import Output from "../Output.svelte"

    export let fullscreen = false
    export let disableTransitions = false
    export let disabled = false
    export let outputId = ""
    export let style = ""

    $: sceneStyleId = $outputs[outputId]?.out?.scene?.style

    $: resolution = getResolution(null, [$outputs, $styles], false, outputId, sceneStyleId)
    let width = 0
    let height = 0

    $: stageOutput = $outputs[outputId]?.stageOutput

    // a captured output's preview is its downscaled readback, so it never decodes the media again
    $: output = $outputs[outputId]
    $: captured = !!output && !!$capturedOutputs[outputId]

    let previewCanvas: HTMLCanvasElement | null = null
    const renderer = new StreamCanvasRenderer()
    let subscribedId = ""
    let unlisten: (() => void) | null = null
    // main sizes the frame to the widest preview drawn
    const subscriber = "p" + Math.random().toString(36).slice(2, 10)
    $: drawnWidth = Math.round(width * (window.devicePixelRatio || 1))
    $: if (subscribedId && drawnWidth) send(OUTPUT, ["PREVIEW_SIZE"], { id: subscribedId, subscriber, width: drawnWidth })

    // the mirror shows until the first capture frame; after that the canvas is never taken away
    let hadFrame = false
    function noteFrame() {
        hadFrame = true
    }
    function resetLive() {
        hadFrame = false
    }

    $: subscribePreview(captured && !stageOutput ? outputId : "")
    function subscribePreview(id: string) {
        if (id === subscribedId) return
        if (subscribedId) {
            send(OUTPUT, ["PREVIEW_UNSUBSCRIBE"], { id: subscribedId, subscriber })
            unlisten?.()
            unlisten = null
        }
        subscribedId = id
        resetLive()
        if (!id) return
        send(OUTPUT, ["PREVIEW_SUBSCRIBE"], { id, subscriber, width: drawnWidth })
        unlisten = onStreamFrame("PREVIEW", (data) => {
            if (data.id !== id) return
            noteFrame()
            if (previewCanvas) renderer.draw(previewCanvas, data.frame)
        })
    }
    onDestroy(() => {
        subscribePreview("")
        renderer.destroy()
    })

    // mounted by hand so removal does not wait on out-transitions inside an if-block
    function mirrorOutput(node: HTMLElement, props: { outputId: string; style: string; preview: boolean }) {
        const mirror = new Output({ target: node, props: { ...props, mirror: true } })
        return {
            update: (next: typeof props) => mirror.$set(next),
            destroy: () => mirror.$destroy()
        }
    }
</script>

<!-- class:fullscreen={fullscreen && !stageOutput} -->
<div class="center previewOutput" id={outputId} class:disabled style={style + ("; aspect-ratio: " + resolution.width + "/" + resolution.height + ";")} bind:offsetWidth={width} bind:offsetHeight={height}>
    {#if stageOutput}
        <StageLayout {outputId} stageId={stageOutput} preview={!disableTransitions} edit={false} />
    {:else}
        {#if captured}
            <canvas class="capturePreview" class:hidden={!hadFrame} bind:this={previewCanvas} />
        {/if}
        {#if !captured || !hadFrame}
            <div class="mirror" use:mirrorOutput={{ outputId, style: getStyleResolution(resolution, fullscreen ? width : resolution.width, fullscreen ? height : resolution.height, "fit"), preview: !disableTransitions }} />
        {/if}
    {/if}

    {#if !fullscreen && $livePrepare[outputId]}
        <div class="blackOverlay">
            <Icon id="hide" size={2.5} white />
        </div>
    {/if}
</div>

<style>
    .center {
        display: flex;
        align-items: center;
        justify-content: center;

        height: 100%;
        width: 100%;

        /* max-height: 50vh; */
    }
    /* .center.fullscreen {
        width: 100%;
        height: 100%;
    } */

    .center.disabled {
        opacity: 0.4;
    }

    .capturePreview {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background-color: black;
    }
    .capturePreview.hidden {
        display: none;
    }
    /* lays the mirror out as if it were a direct child */
    .mirror {
        display: contents;
    }

    .previewOutput :global(.main) {
        width: 100%;

        /* disable e.g. YouTube video controls on hover */
        pointer-events: none;
    }

    .blackOverlay {
        position: absolute;
        width: 100%;
        height: 100%;

        display: flex;
        align-items: center;
        justify-content: center;

        background-color: black;
        opacity: 0.3;
    }
</style>
