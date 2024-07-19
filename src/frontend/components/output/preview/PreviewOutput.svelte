<script lang="ts">
    import { Resolution } from "../../../../types/Settings"
    import { outputs } from "../../../stores"
    //import { currentWindow, outputs, styles } from "../../../stores"
    import { getResolution } from "../../helpers/output"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import StageShow from "../../stage/StageShow.svelte"
    import Output from "../Output.svelte"

    export let fullscreen: any = false
    export let disableTransitions: any = false
    export let disabled: any = false
    export let outputId: string = ""
    export let style: string = ""

    let resolution: Resolution = getResolution()
    let width = 160
    let height = 90

    $: stageOutput = $outputs[outputId]?.stageOutput
</script>

<div class="center previewOutput" id={outputId} class:fullscreen={fullscreen && !stageOutput} class:disabled style={style + (stageOutput ? "" : "; aspect-ratio: " + width / height)} bind:offsetWidth={width} bind:offsetHeight={height}>
    {#if stageOutput}
        <StageShow {outputId} stageId={stageOutput} edit={false} />
    {:else}
        <Output {outputId} style={getStyleResolution(resolution, width, height, "fit")} mirror preview={!disableTransitions} />
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
    .center.fullscreen {
        width: unset;
        height: 100%;
    }

    .center.disabled {
        opacity: 0.5;
    }

    .previewOutput :global(.main) {
        width: 100%;
    }
</style>
