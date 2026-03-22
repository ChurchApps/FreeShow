<script lang="ts">
    import { onMount } from "svelte"
    import { getGroupName } from "../../../common/util/show"
    import { activeShow, mediaCache } from "../../util/stores"
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
    export let renderItems: boolean = true

    let ratio = 0
    let isIphone = false

    onMount(() => {
        isIphone = /iPhone/i.test(navigator.userAgent || "")
    })

    $: isCustomRes = resolution.width !== 1920 || resolution.height !== 1080
    // WIP get layout resolution
    // $: slideResolution = slide?.settings?.resolution
    $: newResolution = isCustomRes ? resolution : { width: 1920, height: 1080 }

    $: name = $activeShow ? getGroupName({ show: $activeShow, showId: $activeShow.id || "" }, layoutSlide.id, slide.group, index) || slide.group || "" : ""

    $: backgroundPath = media?.[layoutSlide.background]?.path || ""
    $: backgroundThumb = backgroundPath ? $mediaCache[backgroundPath] : ""
    $: canRenderPath = backgroundPath.startsWith("data:") || backgroundPath.startsWith("http://") || backgroundPath.startsWith("https://") || backgroundPath.startsWith("blob:")
    $: backgroundSrc = backgroundThumb || (canRenderPath ? backgroundPath : "")

    function getLightPreviewLines(items: any[] = []) {
        const lines: string[] = []
        for (const item of items) {
            if ((item?.type || "text") !== "text" || !Array.isArray(item?.lines)) continue
            for (const line of item.lines) {
                const text = (line?.text || [])
                    .map((part: any) => (part?.value || "").replaceAll("\n", " ").trim())
                    .filter(Boolean)
                    .join(" ")
                if (text) lines.push(text)
                if (lines.length >= 6) return lines
            }
        }
        return lines
    }

    $: lightPreviewLines = getLightPreviewLines(slide?.items || [])
    $: shouldRenderItems = renderItems || !isIphone
</script>

<!-- TODO: disabled -->
<!-- https://svelte.dev/repl/3bf15c868aa94743b5f1487369378cf3?version=3.21.0 -->
<!-- animate:flip -->
<!-- class:right={overIndex === index && (!selected.length || index > selected[0])}
class:left={overIndex === index && (!selected.length || index <= selected[0])} -->
<div class="main" style="width: {100 / columns}%">
    <div class="slide context #slide" class:disabled={layoutSlide.disabled} class:active style="background-color: {color};" tabindex={0} data-index={index} on:click>
        {#if shouldRenderItems}
            <Zoomed resolution={newResolution} background={slide.settings?.color || (slide.items.length ? "black" : "transparent")} bind:ratio>
                <!-- class:ghost={!background} -->
                <div class="background" style="zoom: {1 / ratio}">
                    {#if backgroundSrc}
                        <img src={backgroundSrc} alt="" loading="lazy" decoding="async" />
                    {/if}
                </div>
                <!-- TODO: check if showid exists in shows -->
                {#each slide.items as item}
                    <Textbox {item} />
                {/each}
            </Zoomed>
        {:else}
            <div class="light-background">
                {#if backgroundSrc}
                    <img src={backgroundSrc} alt="" loading="lazy" decoding="async" />
                {/if}
                {#if isIphone && lightPreviewLines.length}
                    <div class="light-text">
                        {#each lightPreviewLines as line}
                            <span>{line}</span>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
        <!-- TODO: BG: white, color: black -->
        <!-- style="width: {newResolution.width * zoom}px;" -->

        <div class="label" title={slide.group === null ? "" : name || "—"} style={`color: ${color};border-bottom: 2px solid ${color || "var(--primary-darkest)"};`}>
            <span style="position: absolute;display: contents;">{index + 1}</span>
            <span class="text">{slide.group === null ? "" : name || "—"}</span>
        </div>
    </div>
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

    .light-background {
        width: 100%;
        aspect-ratio: 16 / 9;
        position: relative;
        background: black;
        overflow: hidden;
    }

    .light-background :global(img) {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }

    .light-text {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 2px;
        padding: 6px;
        pointer-events: none;
        text-align: center;
        overflow: hidden;
    }

    .light-text span {
        color: white;
        font-size: 0.52rem;
        font-weight: 700;
        line-height: 1.1;
        text-shadow: 1px 1px 6px #000;
        overflow: hidden;
        white-space: normal;
        overflow-wrap: anywhere;
        width: 100%;
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
