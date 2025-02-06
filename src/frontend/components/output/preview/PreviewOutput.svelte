<script lang="ts">
    import { outputs, styles } from "../../../stores"
    //import { currentWindow, outputs, styles } from "../../../stores"
    import { getOutputResolution } from "../../helpers/output"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import StageShow from "../../stage/StageShow.svelte"
    import Output from "../Output.svelte"

    export let fullscreen: any = false
    export let disableTransitions: any = false
    export let disabled: any = false
    export let outputId: string = ""
    export let style: string = ""

    $: resolution = getOutputResolution(outputId, $outputs, $styles)
    let width = 0
    let height = 0

    $: stageOutput = $outputs[outputId]?.stageOutput
</script>

<!-- class:fullscreen={fullscreen && !stageOutput} -->
<div class="center previewOutput" id={outputId} class:disabled style={style + ("; aspect-ratio: " + resolution.width + "/" + resolution.height + ";")} bind:offsetWidth={width} bind:offsetHeight={height}>
    {#if stageOutput}
        <StageShow {outputId} stageId={stageOutput} edit={false} />
    {:else}
        <Output {outputId} style={getStyleResolution(resolution, fullscreen ? width : resolution.width, fullscreen ? height : resolution.height, "fit")} mirror preview={!disableTransitions} />
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
        opacity: 0.5;
    }

    .previewOutput :global(.main) {
        width: 100%;

        /* disable e.g. YouTube video controls on hover */
        pointer-events: none;
    }
</style>
