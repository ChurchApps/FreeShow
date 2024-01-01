<script lang="ts">
    import { OUTPUT } from "../types/Channels"
    import type { Resolution } from "../types/Settings"
    import { getResolution } from "./components/helpers/output"
    import Output from "./components/output/Output.svelte"
    import { getStyleResolution } from "./components/slide/getStyleResolution"
    import StageShow from "./components/stage/StageShow.svelte"
    import { currentWindow, outputs, special, styles } from "./stores"
    import { hideDisplay } from "./utils/common"

    // get output resolution
    let width: number = 0
    let height: number = 0
    let resolution: Resolution = getResolution()
    $: if ($currentWindow === "output") resolution = getResolution(null, { $outputs, $styles }, true)

    // enable output window dragging
    let enableOutputMove: boolean = false
    function mousemoveOutput(e: any) {
        if (e.ctrlKey || e.metaKey || e.target.closest(".dragger")) enableOutputMove = true
        else enableOutputMove = false
    }
    $: if ($currentWindow === "output") window.api.send(OUTPUT, { channel: "MOVE", data: { enabled: enableOutputMove } })
</script>

<div
    class="fill context #output_window"
    style="flex-direction: {getStyleResolution(resolution, width, height, 'fit').includes('width') && !Object.values($outputs)[0].stageOutput ? 'row' : 'column'}"
    class:hideCursor={$special.hideCursor}
    on:mousemove={mousemoveOutput}
    bind:offsetWidth={width}
    bind:offsetHeight={height}
    on:dblclick={() => hideDisplay()}
>
    {#if enableOutputMove}
        <div class="dragger">
            <p>Drag window</p>
        </div>
    {/if}
    {#if Object.values($outputs)[0].stageOutput}
        <StageShow stageId={Object.values($outputs)[0].stageOutput} edit={false} />
    {:else}
        <Output style={getStyleResolution(resolution, width, height, "fit")} center />
    {/if}
</div>

<style>
    .dragger {
        -webkit-app-region: drag;
        position: absolute;
        top: 0;
        left: 0;
        height: 5vh;
        width: 100%;
        z-index: 10;

        display: flex;
        justify-content: center;
        align-items: center;

        background-color: rgb(255 255 255 / 0.2);
    }

    .fill {
        height: 100%;
        width: 100%;
        overflow: hidden;

        display: flex;
        /* enable this to see the actual output window cropped size */
        /* background: var(--primary-darkest); */
    }

    .fill.hideCursor {
        cursor: none;
    }
</style>
