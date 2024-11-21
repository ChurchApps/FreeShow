<script lang="ts">
    import { fade } from "svelte/transition"
    import type { Resolution } from "../../../../types/Settings"
    import Textbox from "./Textbox.svelte"
    import Zoomed from "./Zoomed.svelte"
    import { GetLayout } from "../../util/output"
    import { getStyleResolution } from "../../../common/util/getStyleResolution"
    import { outLayout, outShow, styleRes } from "../../util/stores"

    export let outSlide: number
    export let preview: boolean = false

    let width: number = 0
    let height: number = 0
    let resolution: Resolution = $styleRes || { width: 1920, height: 1080 }

    export let transition = { type: "fade", duration: 500 } // text (not background)
    export let ratio = 0

    $: layout = GetLayout($outShow, $outLayout)[outSlide]

    $: showSlide = $outShow?.slides?.[layout?.id] || null

    $: isCustomRes = resolution.width !== 1920 || resolution.height !== 1080
    $: slideResolution = showSlide?.settings?.resolution
    $: newResolution = isCustomRes ? resolution : slideResolution || { width: 1920, height: 1080 }
</script>

<div class="main" style={preview ? "width: 100%;" : ""} bind:offsetWidth={width} bind:offsetHeight={height}>
    <Zoomed center style={preview ? "width: 100%;" : getStyleResolution(newResolution, width, height)} resolution={newResolution} bind:ratio>
        <!-- {#if $outBackground !== null}
    <MediaOutput {...$outBackground} {transition} bind:video bind:videoData />
  {/if} -->
        <div class="background" style="zoom: {1 / ratio}">
            {#if $outShow.media?.[layout?.background || ""]}
                <img src={$outShow.media[layout.background || ""].path} />
            {/if}
        </div>
        {#if $outShow}
            {#key outSlide}
                <span transition:fade|local={transition} style="pointer-events: none;">
                    {#if showSlide}
                        {#each showSlide?.items as item}
                            <Textbox {item} />
                        {/each}
                    {/if}
                </span>
            {/key}
        {/if}

        <!-- WIP show overlays / layers... -->
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
