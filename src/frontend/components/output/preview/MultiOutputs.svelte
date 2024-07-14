<script lang="ts">
    import { Resolution } from "../../../../types/Settings"
    import { currentWindow, dictionary, outputs, previewBuffers, styles } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { getActiveOutputs, getResolution } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Output from "../Output.svelte"

    // export let resolution: Resolution
    $: outputList = getActiveOutputs($outputs, false, true)

    let fullscreen: boolean = false
    let fullscreenId = ""
    function toggleFullscreen(e: any) {
        if (!e.target.closest(".multipleOutputs")) return

        if (fullscreen) {
            fullscreen = false
            return
        }

        fullscreen = true
        fullscreenId = e.target.closest(".previewCanvas")?.id
    }

    let updatedList: any[] = []
    let timeout: any = null
    $: if (outputList) updateList()
    function updateList() {
        if (JSON.stringify(updatedList) === JSON.stringify(outputList)) return
        if (timeout) clearTimeout(timeout)

        timeout = setTimeout(() => {
            updatedList = clone(outputList)
            timeout = null
        }, 500)
    }

    let resolution: Resolution = getResolution()
    $: if ($currentWindow === "output") resolution = getResolution(null, { $outputs, $styles }, true)
</script>

<!-- aspect-ratio: {resolution?.width || 1920}/{resolution?.height || 1080}; -->
<div on:click={toggleFullscreen} class="multipleOutputs" class:multiple={updatedList.length > 1} class:fullscreen style={fullscreen ? "width: 100%;height: 100%;" : "width: calc(100% - 6px);"}>
    {#if fullscreen}
        <Button class="hide" on:click={() => (fullscreen = false)} style="z-index: 2;opacity: 1;right: 10px;" title={$dictionary.actions?.close} center>
            <Icon id="close" size={1.5} white />
        </Button>

        <span class="resolution">
            <p><b><T id="screen.width" />:</b> {$previewBuffers[fullscreenId]?.originalSize?.width || 0} <T id="screen.pixels" /></p>
            <p><b><T id="screen.height" />:</b> {$previewBuffers[fullscreenId]?.originalSize?.height || 0} <T id="screen.pixels" /></p>
        </span>
    {/if}

    <!-- TODO: fullscreen height getStyleResolution() -->

    {#each updatedList as outputId}
        {#if !fullscreen || fullscreenId === outputId}
            <Output {outputId} style={getStyleResolution(resolution, 160, 90, "fit")} />
        {/if}
    {/each}
</div>

<style>
    .multipleOutputs {
        display: flex;
        flex-wrap: wrap;
        height: fit-content;
    }
    .multipleOutputs.multiple:not(.fullscreen) :global(.zoomed) {
        /* width: unset !important;
        min-width: 50%; */
        width: 50% !important;
    }

    .fullscreen {
        position: fixed;
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
