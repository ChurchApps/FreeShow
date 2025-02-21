<script lang="ts">
    import Zoomed from "./Zoomed.svelte"
    import Stagebox from "./Stagebox.svelte"
    import { getStyleResolution } from "../../common/util/getStyleResolution"

    interface Show {
        settings: any
        items: {
            [key: string]: any
        }
    }

    export let show: Show
    export let slides: any
    export let socketId: string = ""
    export let socket: any
    export let stream: any
    export let background: any

    let width: number = 0
    let height: number = 0
    let resolution: any = show && show.settings.resolution ? show.settings.resolution : { width: 1920, height: 1080 } // $screen.resolution

    // $: console.log(show.settings.resolution ? "contain" : "fill")
</script>

<div class="main" bind:offsetWidth={width} bind:offsetHeight={height}>
    <div class="slide">
        <!-- {#key show.settings.autoStretch} -->
        <!-- dynamicResolution={show.settings.autoStretch !== false} -->
        <Zoomed {show} style={getStyleResolution(resolution, width, height) + ";" + `background-color: ${show.settings.color || "#000000"};`} dynamicResolution disableStyle>
            {#each Object.entries(show.items) as [id, item]}
                {#if item.enabled}
                    {#key show}
                        <Stagebox {show} {id} {item} {slides} {socketId} {socket} {stream} {background} />
                    {/key}
                {/if}
            {/each}
        </Zoomed>
        <!-- {/key} -->
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
