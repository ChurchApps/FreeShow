<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import { ProjectShowRef } from "../../../../types/Projects"
    import { dictionary, media, outLocked, outputs, showsCache, styles } from "../../../stores"
    import Image from "../../drawer/media/Image.svelte"
    import { getMediaStyle } from "../../helpers/media"
    import { getActiveOutputs, getCurrentStyle, setOutput } from "../../helpers/output"
    import HoverButton from "../../inputs/HoverButton.svelte"
    import AudioPreview from "../AudioPreview.svelte"
    import PdfPreview from "../pdf/PdfPreview.svelte"
    import Slides from "../Slides.svelte"
    import VideoShow from "../VideoShow.svelte"

    export let show: ProjectShowRef
    $: type = show.type

    $: outputId = getActiveOutputs($outputs, false, true, true)[0]
    $: outputStyle = getCurrentStyle($styles, $outputs[outputId]?.style)

    let mediaStyle: MediaStyle = {}
    $: if (show) mediaStyle = getMediaStyle($media[show.id], outputStyle)
</script>

{#if type === "video" || type === "image" || type === "player"}
    <div style="display: flex;flex-direction: column;height: 250px;">
        {#if type === "video" || type === "player"}
            <VideoShow {show} {mediaStyle} />
        {:else}
            <div class="media context #media_preview" style="flex: 1;overflow: hidden;">
                <HoverButton
                    icon="play"
                    size={10}
                    on:click={() => {
                        if (!$outLocked) setOutput("background", { path: show?.id, ...mediaStyle })
                    }}
                    title={$dictionary.media?.play}
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
{:else if type === "audio"}
    <AudioPreview active={show} />
{:else if type === "section"}
    {#if show.notes}
        <p class="notes">{show.notes}</p>
    {/if}
{:else if type === "pdf"}
    <PdfPreview {show} />
{:else}
    <Slides showId={show.id} layout={show.layout} />

    <!-- WIP change layout??? -->
    <!-- <Layouts /> -->
    {#if $showsCache[show.id]?.layouts?.[$showsCache[show.id]?.settings?.activeLayout]?.notes}
        <p class="notes">{$showsCache[show.id]?.layouts?.[$showsCache[show.id]?.settings?.activeLayout]?.notes}</p>
    {/if}
{/if}

<style>
    .notes {
        width: 100%;
        padding: 10px 15px;
    }
</style>
