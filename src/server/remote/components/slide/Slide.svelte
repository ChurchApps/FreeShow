<script lang="ts">
    import Textbox from "./Textbox.svelte"
    import { fade } from "svelte/transition"
    import Zoomed from "./Zoomed.svelte"
    import type { Resolution } from "../../../../types/Settings"
    import type { Transition } from "../../../../types/Show"
    import { getStyleResolution } from "../../helpers/getStyleResolution"
    import { GetLayout, getSlide } from "../../helpers/get"

    export let outShow: any
    export let outSlide: any
    export let outLayout: any

    let width: number = 0
    let height: number = 0
    let resolution: Resolution = outShow?.settings.resolution ? outShow.settings.resolution : { width: 1920, height: 1080 }

    export let transition: Transition = { type: "fade", duration: 500 } // text (not background)
    export let ratio = 0

    $: layout = GetLayout(outShow, outLayout)[outSlide]
</script>

<div class="main" bind:offsetWidth={width} bind:offsetHeight={height}>
    <Zoomed center style={getStyleResolution(resolution, width, height)} {resolution} bind:ratio>
        <!-- {#if $outBackground !== null}
    <MediaOutput {...$outBackground} {transition} bind:video bind:videoData />
  {/if} -->
        <div class="background" style="zoom: {1 / ratio}">
            {#if outShow.media?.[layout?.background]}
                <img src={outShow.media[layout.background].path} />
            {/if}
        </div>
        {#if outShow}
            {#key outSlide}
                <span transition:fade|local={transition} style="pointer-events: none;">
                    {#if getSlide(outShow, outSlide, outLayout)}
                        {#each getSlide(outShow, outSlide, outLayout)?.items as item}
                            <Textbox {item} />
                        {/each}
                    {/if}
                </span>
            {/key}
        {/if}
        <!-- {#if $outOverlays.length}
    {#each $outOverlays as id}
      <div style={$overlays[id].style} transition:fade={transition}>
        <div>
          {#each $overlays[id].items as item}
            <Textbox {item} />
          {/each}
        </div>
      </div>
    {/each}
  {/if} -->
    </Zoomed>
</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .background {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
    }
    /* .background.ghost {
    opacity: 0.4;
  } */
    .background :global(img) {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
</style>
