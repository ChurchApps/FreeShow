<script lang="ts">
    import type { MediaStyle } from "../../../types/Main"
    import { activeShow, dictionary, media, outLocked, outputs, styles } from "../../stores"
    import Image from "../drawer/media/Image.svelte"
    import { createGlobalTimerFromLocalTimer } from "../drawer/timers/timers"
    import { getMediaStyle } from "../helpers/media"
    import { getActiveOutputs, getCurrentStyle, setOutput } from "../helpers/output"
    import HoverButton from "../inputs/HoverButton.svelte"
    import Splash from "../main/Splash.svelte"
    import Layouts from "../slide/Layouts.svelte"
    import AudioPreview from "./AudioPreview.svelte"
    import PdfPreview from "./pdf/PdfPreview.svelte"
    import PowerPointPreview from "./ppt/PowerPointPreview.svelte"
    import Section from "./Section.svelte"
    import Slides from "./Slides.svelte"
    import VideoShow from "./VideoShow.svelte"

    $: show = $activeShow

    $: outputId = getActiveOutputs($outputs)[0]
    $: currentOutput = $outputs[outputId] || {}
    $: currentStyle = getCurrentStyle($styles, currentOutput.style)

    let mediaStyle: MediaStyle = {}
    $: if (show) mediaStyle = getMediaStyle($media[show.id], currentStyle)

    // check for timer & create global
    $: if (show?.id) createGlobalTimerFromLocalTimer(show?.id)
</script>

<div id="showArea" class="main">
    {#if show}
        {#if show.type === "video" || show.type === "image" || show.type === "player"}
            <!-- WIP indicate that this does not loop when played! -->
            <div style="display: flex;flex-direction: column;height: 100%;">
                {#if show.type === "video" || show.type === "player"}
                    <VideoShow {show} {mediaStyle} />
                {:else}
                    <div class="media context #media_preview" style="flex: 1;overflow: hidden;">
                        <HoverButton
                            icon="play"
                            size={10}
                            on:click={() => {
                                if (!$outLocked) setOutput("background", { path: show?.id, ...mediaStyle })
                            }}
                            title={$dictionary.media?.show}
                        >
                            <Image
                                style="width: 100%;height: 100%;object-fit: {mediaStyle.fit || 'contain'};filter: {mediaStyle.filter || ''};transform: scale({mediaStyle.flipped ? '-1' : '1'}, {mediaStyle.flippedY ? '-1' : '1'});"
                                src={show.id}
                                alt={show.name || ""}
                            />
                        </HoverButton>
                    </div>
                {/if}
            </div>
        {:else if show.type === "audio"}
            <AudioPreview active={$activeShow} />
        {:else if show.type === "section"}
            <Section section={show} />
        {:else if show.type === "pdf"}
            <PdfPreview {show} />
        {:else if show.type === "ppt"}
            <PowerPointPreview {show} />
        {:else}
            <Slides showId={$activeShow?.id || ""} />
            <Layouts />
        {/if}
    {:else}
        <Splash />
    {/if}
</div>

<style>
    .main {
        height: 100%;
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }
</style>
