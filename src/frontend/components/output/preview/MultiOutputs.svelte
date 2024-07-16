<script lang="ts">
    import { dictionary, outputs } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone, keysToID, sortByName } from "../../helpers/array"
    import { getResolution } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import PreviewOutput from "./PreviewOutput.svelte"

    export let disableTransitions: boolean = false

    // export let resolution: Resolution
    $: outs = sortByName(keysToID($outputs).filter((a) => a.enabled && !a.isKeyOutput))

    let fullscreen: boolean = false
    let fullscreenId = ""
    function toggleFullscreen(e: any) {
        if (!e.target.closest(".multipleOutputs")) return

        if (fullscreen) {
            fullscreen = false
            return
        }

        fullscreen = true
        fullscreenId = e.target.closest(".previewOutput")?.id

        currentResolution()
    }

    // this is to prevent transitions when adding/removing outputs (but it does not work at the moment)
    // let disableTransitions: boolean = false
    let updatedList: any[] = []
    let timeout: any = null
    $: if (outs) updateList()
    function updateList() {
        if (JSON.stringify(updatedList) === JSON.stringify(outs)) return
        if (timeout) clearTimeout(timeout)

        disableTransitions = true

        timeout = setTimeout(() => {
            updatedList = clone(outs)
            timeout = null
            disableTransitions = false
        }) // 500
    }

    let resolution: any = {}
    function currentResolution() {
        resolution = getResolution(null, null, true)
    }
</script>

<!-- aspect-ratio: {resolution?.width || 1920}/{resolution?.height || 1080}; -->
<div on:click={toggleFullscreen} class="multipleOutputs" class:multiple={updatedList.length > 1} class:fullscreen style={fullscreen ? "width: 100%;height: 100%;" : "width: calc(100% - 6px);"}>
    {#if fullscreen}
        <Button class="hide" on:click={() => (fullscreen = false)} style="z-index: 2;opacity: 1;right: 10px;" title={$dictionary.actions?.close} center>
            <Icon id="close" size={1.5} white />
        </Button>

        <span class="resolution">
            <p><b><T id="screen.width" />:</b> {resolution?.width || 0} <T id="screen.pixels" /></p>
            <p><b><T id="screen.height" />:</b> {resolution?.height || 0} <T id="screen.pixels" /></p>
        </span>
    {/if}

    <!-- TODO: fullscreen height getStyleResolution() -->

    {#each updatedList as output}
        <div class="outputPreview" style={!fullscreen || fullscreenId === output.id ? "display: contents;" : "opacity: 0;position: absolute;"}>
            <PreviewOutput outputId={output.id} {disableTransitions} style={outs.length > 1 && !fullscreen ? `border: 2px solid ${output?.color};width:50%` : ""} disabled={outs.length > 1 && !fullscreen && !output?.active} {fullscreen} />
        </div>
    {/each}
</div>

<style>
    .multipleOutputs {
        display: flex;
        flex-wrap: wrap;
        height: fit-content;
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
        bottom: 0;
        right: 0;

        color: var(--secondary-text);
        /* background-color: var(--primary);
    background-color: black; */
        text-align: right;
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 10px 12px;
        opacity: 0.8;
        transition: opacity ease-in-out 0.2s;

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
