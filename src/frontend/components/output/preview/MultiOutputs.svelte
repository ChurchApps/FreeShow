<script lang="ts">
    import { outputs, toggleOutputEnabled } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { keysToID, sortByName, sortObject } from "../../helpers/array"
    import { getOutputResolution } from "../../helpers/output"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import PreviewOutput from "./PreviewOutput.svelte"

    export let disableTransitions = false

    // export let resolution: Resolution
    $: outs = sortObject(sortByName(keysToID($outputs).filter((a) => a.enabled)), "stageOutput")
    // hide from preview if omre than one output is "enabled", and no non hidden output is "active"
    $: if (outs.length > 1 && !keysToID($outputs).filter((a) => outs.find(({ id }) => a.id === id) && !a.active && !a.hideFromPreview).length) outs = outs.filter((a) => !a.hideFromPreview)

    let fullscreen = false
    let fullscreenId = ""
    function toggleFullscreen(e: any) {
        if (!e.target.closest(".multipleOutputs") || e.target.closest("button")) return

        if (fullscreen) {
            fullscreen = false
            return
        }

        fullscreen = true
        fullscreenId = e.target.closest(".previewOutput")?.id

        currentResolution()
    }

    $: if ($toggleOutputEnabled) {
        disableTransitions = true
        setTimeout(() => {
            toggleOutputEnabled.set(false)
            disableTransitions = false
        }, 500)
    }

    let resolution: any = {}
    function currentResolution() {
        resolution = getOutputResolution(fullscreenId, $outputs, true)
    }

    function toFraction(x: number, tolerance = 0) {
        if (x === 0) return "0/1"
        if (x < 0) x = -x
        if (!tolerance) tolerance = 0.0001
        let num = 1
        let den = 1

        iterate()
        return `${num}/${den}`

        function iterate() {
            var R = num / den
            if (Math.abs((R - x) / x) < tolerance) return

            if (R < x) num++
            else den++
            iterate()
        }
    }

    // function handleKeydown(e: KeyboardEvent) {
    //     if (e.key === "Enter" || e.key === " ") {
    //         e.preventDefault()
    //         toggleFullscreen(e)
    //     } else if (e.key === "Escape" && fullscreen) {
    //         e.preventDefault()
    //         fullscreen = false
    //     }
    // }
</script>

<!-- aspect-ratio: {resolution?.width || 1920}/{resolution?.height || 1080}; -->
<!-- on:keydown={handleKeydown} -->
<!-- role="button"
tabindex="0"
aria-label={fullscreen ? "Exit fullscreen preview" : "Toggle fullscreen preview"} -->
<div on:click={toggleFullscreen} class="multipleOutputs" class:multiple={outs.length > 1} class:fullscreen style={fullscreen ? "width: 100%;height: 100%;" : "width: calc(100% - 6px);"} role="none">
    {#if fullscreen}
        <MaterialButton class="hide" style="z-index: 2;opacity: 1;inset-inline-end: 10px;" title="actions.close" on:click={() => (fullscreen = false)}>
            <Icon id="close" size={1.2} white />
        </MaterialButton>

        <span class="resolution">
            <p><b><T id="screen.width" />:</b> {resolution?.width || 0} <T id="screen.pixels" /></p>
            <p><b><T id="screen.height" />:</b> {resolution?.height || 0} <T id="screen.pixels" /></p>
            {#if resolution?.width && resolution?.height}
                <p><b><T id="settings.aspect_ratio" />:</b> {Number((resolution.width / resolution.height).toFixed(2))} ({toFraction(resolution.width / resolution.height)})</p>
            {/if}
        </span>
    {/if}

    {#each outs as output}
        <div
            id={output.id}
            class="outputPreview output_button context #output_preview"
            style={fullscreen ? (fullscreenId === output.id ? "display: contents;" : "opacity: 0;position: absolute;") : outs.length > 1 ? `border: 2px solid ${output?.color};width: 50%;` : "display: contents;"}
        >
            <PreviewOutput outputId={output.id} {disableTransitions} disabled={outs.length > 1 && !fullscreen && !output?.active} {fullscreen} />
        </div>
    {/each}
</div>

<style>
    .multipleOutputs {
        display: flex;
        flex-wrap: wrap;
        /* this is changed in electron v31 (chromium) */
        height: fit-content;
        /* height: 100%; */

        /* width: calc(50% - 0.5px); */
        /* margin-top: 1px;
        gap: 1px; */
    }
    /*
    .multipleOutputs.multiple:not(.fullscreen) :global(.zoomed) {
        width: 50% !important;
    }
    */

    .fullscreen {
        position: fixed;
        justify-content: center;
        background-color: var(--primary-darkest);
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        /* border: 4px solid var(--secondary); */
        z-index: 5500;
    }

    .resolution {
        position: absolute;
        bottom: 10px;
        inset-inline-end: 10px;

        color: var(--text);
        font-size: 0.85em;
        line-height: 1.1em;
        text-align: end;
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 10px 12px;
        transition: opacity ease-in-out 0.2s;

        border-radius: 6px;
        border: 2px solid var(--primary-lighter);
        background-color: var(--primary-darker);
        opacity: 0.7;

        z-index: 30;
    }
    .resolution:hover {
        opacity: 0;
    }
    .resolution p {
        display: flex;
        gap: 5px;
        justify-content: space-between;
    }
</style>
