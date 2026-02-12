<script lang="ts">
    import { getStyleResolution } from "../../common/util/getStyleResolution"
    import { clone } from "../../common/util/helpers"
    import { getSlideTextItems, shouldItemBeShown } from "../util/itemHelpers"
    import { output, stageLayout } from "../util/stores"
    import Stagebox from "./Stagebox.svelte"
    import Zoomed from "./Zoomed.svelte"

    import { onDestroy, onMount } from "svelte"

    let width: number = 0
    let height: number = 0
    let resolution: any = $stageLayout && $stageLayout.settings.resolution ? $stageLayout.settings.resolution : { width: 1920, height: 1080 } // $screen.resolution

    // debounce remounting when resizing to avoid rapid remounts causing lag
    let resizeKey: string = `${width}-${height}-${Date.now()}`
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null
    $: if (width !== 0 || height !== 0) {
        clearResizeTimeout()
        resizeTimeout = setTimeout(() => {
            resizeKey = `${width}-${height}-${Date.now()}`
        }, 200)
    }

    onDestroy(() => clearResizeTimeout())
    function clearResizeTimeout() {
        if (resizeTimeout) clearTimeout(resizeTimeout)
    }

    let conditionsUpdater = 0
    onMount(() => {
        const interval = setInterval(() => {
            if (Object.values($stageLayout?.items || {}).find((a) => a?.conditions)) conditionsUpdater++
        }, 3000)

        return () => {
            clearInterval(interval)
        }
    })
</script>

<div class="main" bind:offsetWidth={width} bind:offsetHeight={height}>
    <div class="slide">
        {#if $stageLayout}
            <!-- {#key show.settings.autoStretch} -->
            <!-- dynamicResolution={show.settings.autoStretch !== false} -->
            {#key resizeKey}
                <Zoomed show={$stageLayout} style={getStyleResolution(resolution, width, height) + ";" + `background-color: ${$stageLayout.settings.color || "#000000"};`} dynamicResolution disableStyle>
                    {#each Object.entries($stageLayout.items) as [id, item]}
                        {#if (item.type || item.enabled !== false) && shouldItemBeShown(item, item.type === "slide_text" ? getSlideTextItems($stageLayout, item, $output) : [], { type: "stage" }, conditionsUpdater)}
                            {#key $stageLayout}
                                <Stagebox stageLayout={$stageLayout} {id} item={clone(item)} />
                            {/key}
                        {/if}
                    {/each}
                </Zoomed>
            {/key}
            <!-- {/key} -->
        {/if}
    </div>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--primary-darkest);
        /* background: black; */
    }

    .slide {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        /* padding: 10px; */
        overflow: hidden;
    }
</style>
