<script lang="ts">
    import type { Resolution } from "../../../types/Settings"
    import { dictionary, outputs } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import { clone } from "../helpers/array"
    import { getActiveOutputs } from "../helpers/output"
    import Button from "../inputs/Button.svelte"
    import { getStyleResolution } from "../slide/getStyleResolution"
    import Output from "./Output.svelte"

    export let video: any = null
    export let videoData: any = { duration: 0, paused: true, muted: false, loop: false }
    export let videoTime: number = 0
    export let title: string = ""
    export let mirror: boolean = false
    export let preview: boolean = false

    // export let fullscreen: boolean = false
    export let resolution: Resolution

    $: outputList = getActiveOutputs($outputs, false, true)

    let disableTransitions: boolean = false
    let fullscreen: boolean = false
    function toggleFullscreen(e: any) {
        if (!e.target.closest(".zoomed")) return

        if (fullscreen) {
            fullscreen = false
            return
        }

        fullscreen = e.target.closest(".zoomed").id || true
    }

    let updatedList: any[] = []
    $: if (outputList) updateList()
    function updateList() {
        if (JSON.stringify(updatedList) === JSON.stringify(outputList)) {
            updatedList = clone(outputList)
            return
        }

        disableTransitions = true

        setTimeout(() => {
            updatedList = clone(outputList)
            disableTransitions = false
        }, 500)
    }
</script>

<!-- aspect-ratio: {resolution?.width || 1920}/{resolution?.height || 1080}; -->
<div on:click={toggleFullscreen} class="multipleOutputs" class:multiple={updatedList.length > 1} class:fullscreen style={fullscreen ? "width: 100%;height: 100%;" : "width: calc(100% - 6px);"}>
    {#if fullscreen}
        <Button class="hide" on:click={() => (fullscreen = false)} style="z-index: 2;opacity: 1;right: 10px;" title={$dictionary.actions?.close} center>
            <Icon id="close" size={1.5} white />
        </Button>

        <span class="resolution">
            <!-- TODO: get actual resultion ... -->
            <p><b><T id="screen.width" />:</b> {resolution.width} <T id="screen.pixels" /></p>
            <p><b><T id="screen.height" />:</b> {resolution.height} <T id="screen.pixels" /></p>
        </span>
    {/if}

    {#each updatedList as outputId, i}
        <Output
            specificOutput={fullscreen && i === 0 ? fullscreen : outputId}
            outline={!fullscreen && updatedList.length > 1}
            disabled={!fullscreen && !$outputs[outputId]?.active}
            {disableTransitions}
            center={fullscreen}
            style={fullscreen ? getStyleResolution(resolution, window.innerWidth, window.innerHeight, "fit") : ""}
            {mirror}
            {preview}
            bind:video
            bind:videoData
            bind:videoTime
            bind:title
        />
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
        z-index: 90;
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
