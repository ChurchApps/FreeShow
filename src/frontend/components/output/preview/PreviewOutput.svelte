<script lang="ts">
    import { livePrepare, outputs, styles } from "../../../stores"
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
    export let outOverride: any = null
    export let badge: string = ""

    $: resolution = getResolution(null, [$outputs, $styles], false, outputId)
    let width = 0
    let height = 0

    $: stageOutput = $outputs[outputId]?.stageOutput
</script>

<!-- class:fullscreen={fullscreen && !stageOutput} -->
<div class="center previewOutput" id={outputId} class:disabled style={style + ("; aspect-ratio: " + resolution.width + "/" + resolution.height + ";")} bind:offsetWidth={width} bind:offsetHeight={height}>
    {#if stageOutput}
        <StageLayout {outputId} stageId={stageOutput} preview={!disableTransitions} edit={false} />
    {:else}
        <Output {outputId} {outOverride} style={getStyleResolution(resolution, fullscreen ? width : resolution.width, fullscreen ? height : resolution.height, "fit")} mirror preview={!disableTransitions} />
    {/if}

    {#if badge}
        <div class="badge" class:live={badge.includes("LIVE")}>
            <span>{badge}</span>
        </div>
    {/if}

    {#if !fullscreen && $livePrepare[outputId]}
        <div class="blackOverlay">
            <Icon id="hide" size={2.5} white />
        </div>
    {/if}
</div>

<style>
    .badge {
        position: absolute;
        top: 6px;
        left: 6px;
        padding: 2px 8px;
        border-radius: 4px;
        background-color: rgba(30, 30, 45, 0.85);
        color: #48cbe9;
        font-size: 0.75em;
        font-weight: 700;
        letter-spacing: 0.5px;
        border: 1px solid rgba(72, 203, 233, 0.3);
        pointer-events: none;
        z-index: 5;
    }
    .badge.live {
        color: #ff4757;
        border-color: rgba(255, 71, 87, 0.4);
        background-color: rgba(40, 10, 15, 0.85);
    }
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
