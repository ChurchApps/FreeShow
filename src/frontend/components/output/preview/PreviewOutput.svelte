<script lang="ts">
    import { Resolution } from "../../../../types/Settings"
    //import { currentWindow, outputs, styles } from "../../../stores"
    import { getResolution } from "../../helpers/output"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Output from "../Output.svelte"

    export let fullscreen: any = false
    export let disabled: any = false
    export let outputId: string = ""
    export let style: string = ""

    let resolution: Resolution = getResolution()
    let width = 160
    let height = 90

    // $: if ($currentWindow === "output") resolution = getResolution(null, { $outputs, $styles }, true)
    $: console.log("style", style + "; aspect-ratio: " + width / height)
    $: console.log("getStyleResolution", getStyleResolution(resolution, width, height, "fit"))
</script>

<div class="center previewOutput" id={outputId} class:fullscreen class:disabled style={style + "; aspect-ratio: " + width / height} bind:offsetWidth={width} bind:offsetHeight={height}>
    <Output {outputId} style={getStyleResolution(resolution, width, height, "fit")} />
</div>

<style>
    .center {
        display: flex;
        align-items: center;
        justify-content: center;

        height: 100%;
        width: 100%;
    }
    .center.fullscreen {
        width: unset;
        height: 100%;
    }

    .center.disabled {
        opacity: 0.5;
    }
</style>
