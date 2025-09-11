<script lang="ts">
    import { colorbars, dictionary, outputs, toggleOutputEnabled } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { keysToID, sortByName, sortObject } from "../../helpers/array"
    import { getOutputResolution } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import PreviewOutput from "./PreviewOutput.svelte"

    export let disableTransitions = false

    // export let resolution: Resolution
    $: outs = sortObject(sortByName(keysToID($outputs).filter((a) => a.enabled && !a.isKeyOutput)), "stageOutput")
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
        <Button class="hide" on:click={() => (fullscreen = false)} style="z-index: 2;opacity: 1;inset-inline-end: 10px;" title={$dictionary.actions?.close} center>
            <Icon id="close" size={1.5} white />
        </Button>

        <span class="resolution">
            <p><b><T id="screen.width" />:</b> {resolution?.width || 0} <T id="screen.pixels" /></p>
            <p><b><T id="screen.height" />:</b> {resolution?.height || 0} <T id="screen.pixels" /></p>

            <Button style="background-color: var(--primary-darkest);" on:click={() => colorbars.set($colorbars ? "" : "colorbars.png")} outline={!!$colorbars} center>
                <Icon id="test" white={!$colorbars} right />
                <T id="preview.test_pattern" />
            </Button>
        </span>
    {/if}

    {#each outs as output}
        <div id={output.id} class="outputPreview output_button context #output_preview" style={!fullscreen || fullscreenId === output.id ? "display: contents;" : "opacity: 0;position: absolute;"}>
            <PreviewOutput outputId={output.id} {disableTransitions} style={outs.length > 1 && !fullscreen ? `border: 2px solid ${output?.color};width:50%` : ""} disabled={outs.length > 1 && !fullscreen && !output?.active} {fullscreen} />
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
        inset-inline-start: 50%;
        transform: translate(-50%, -50%);
        /* border: 4px solid var(--secondary); */
        z-index: 5500;
    }

    .resolution {
        position: absolute;
        bottom: 0;
        inset-inline-end: 0;

        color: var(--text);
        /* background-color: var(--primary);
    background-color: black; */
        text-align: end;
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 10px 12px;
        transition: opacity ease-in-out 0.2s;

        z-index: 30;
    }
    /* .resolution:hover {
        opacity: 0;
    } */
    .resolution p {
        display: flex;
        gap: 5px;
        justify-content: space-between;
        opacity: 0.8;
    }
</style>
