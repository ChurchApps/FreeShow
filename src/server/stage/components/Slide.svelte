<script lang="ts">
    import Zoomed from "./Zoomed.svelte"
    import Stagebox from "./Stagebox.svelte"
    import { getStyleResolution } from "../../common/util/getStyleResolution"
    import { clone } from "../../common/util/helpers"
    import { stageLayout } from "../util/stores"

    let width: number = 0
    let height: number = 0
    let resolution: any = $stageLayout && $stageLayout.settings.resolution ? $stageLayout.settings.resolution : { width: 1920, height: 1080 } // $screen.resolution

    // $: console.log(show.settings.resolution ? "contain" : "fill")
</script>

<div class="main" bind:offsetWidth={width} bind:offsetHeight={height}>
    <div class="slide">
        {#if $stageLayout}
            <!-- {#key show.settings.autoStretch} -->
            <!-- dynamicResolution={show.settings.autoStretch !== false} -->
            <Zoomed show={$stageLayout} style={getStyleResolution(resolution, width, height) + ";" + `background-color: ${$stageLayout.settings.color || "#000000"};`} dynamicResolution disableStyle>
                {#each Object.entries($stageLayout.items) as [id, item]}
                    {#if item.type || item.enabled !== false}
                        {#key $stageLayout}
                            <Stagebox stageLayout={$stageLayout} {id} item={clone(item)} />
                        {/key}
                    {/if}
                {/each}
            </Zoomed>
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
