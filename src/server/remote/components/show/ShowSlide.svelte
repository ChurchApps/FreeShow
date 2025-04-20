<script lang="ts">
    import { getGroupName } from "../../../common/util/show"
    import { activeShow } from "../../util/stores"
    import Textbox from "./Textbox.svelte"
    import Zoomed from "./Zoomed.svelte"

    export let slide: any
    export let media: any
    export let layoutSlide: any
    export let color: string | null = slide.color
    export let index: number
    export let columns: number = 1
    export let active: boolean = false
    export let resolution: any

    let ratio = 0

    $: isCustomRes = resolution.width !== 1920 || resolution.height !== 1080
    // WIP get layout resolution
    // $: slideResolution = slide?.settings?.resolution
    $: newResolution = isCustomRes ? resolution : { width: 1920, height: 1080 }

    $: name = $activeShow ? getGroupName({ show: $activeShow, showId: $activeShow.id || "" }, layoutSlide.id, slide.group, index) || slide.group || "" : ""
</script>

<!-- TODO: disabled -->
<!-- https://svelte.dev/repl/3bf15c868aa94743b5f1487369378cf3?version=3.21.0 -->
<!-- animate:flip -->
<!-- class:right={overIndex === index && (!selected.length || index > selected[0])}
class:left={overIndex === index && (!selected.length || index <= selected[0])} -->
<div class="main" style="width: {100 / columns}%">
    <button type="button" class="slide context #slide" class:disabled={layoutSlide.disabled} class:active style="background-color: {color};" data-index={index} aria-disabled={layoutSlide.disabled}>
        <Zoomed resolution={newResolution} background={slide.items.length ? "black" : "transparent"} bind:ratio>
            <!-- class:ghost={!background} -->
            <div class="background" style="zoom: {1 / ratio}">
                {#if media[layoutSlide.background]?.path && !media[layoutSlide.background].path.includes("freeshow-cache")}
                    <img src={media[layoutSlide.background].path} alt="Slide background" />
                {/if}
            </div>
            <!-- TODO: check if showid exists in shows -->
            {#each slide.items as item}
                <Textbox {item} />
            {/each}
        </Zoomed>
        <!-- TODO: BG: white, color: black -->
        <!-- style="width: {newResolution.width * zoom}px;" -->

        <div class="label" title={slide.group === null ? "" : name || "—"} style={`color: ${color};border-bottom: 2px solid ${color || "var(--primary-darkest)"};`}>
            <span style="position: absolute;display: contents;">{index + 1}</span>
            <span class="text">{slide.group === null ? "" : name || "—"}</span>
        </div>
    </button>
</div>

<style>
    .main {
        display: flex;
        position: relative;
        padding: 2px;
    }

    .slide {
        /* padding: 3px; */
        background-color: var(--primary);
        z-index: 0;
        outline-offset: 0;
        width: 100%;
        /* height: fit-content; */
        /* border: 2px solid var(--primary-lighter); */
    }
    .slide.active {
        /* outline: 2px solid var(--secondary);
    outline-offset: 4px; */
        outline: 3px solid var(--secondary);
        outline-offset: -1px;

        z-index: 2;
    }
    .slide.disabled {
        opacity: 0.2;
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

    .label {
        position: relative;
        background-color: var(--primary-darkest);
        display: flex;
        padding: 5px;
        padding-bottom: 3px;
        font-size: 0.8em;
        font-weight: bold;
        align-items: center;
        /* opacity: 0.8; */
    }

    .label .text {
        width: 100%;
        margin: 0 15px;
        text-align: center;
        overflow-x: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
