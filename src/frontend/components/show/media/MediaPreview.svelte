<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import { activeShow, dictionary, media, outLocked, outputs, styles } from "../../../stores"
    import Image from "../../drawer/media/Image.svelte"
    import { getMediaStyle } from "../../helpers/media"
    import { getActiveOutputs, getCurrentStyle, setOutput } from "../../helpers/output"
    import HoverButton from "../../inputs/HoverButton.svelte"
    import VideoShow from "../VideoShow.svelte"

    $: show = $activeShow

    $: outputId = getActiveOutputs($outputs)[0]
    $: currentOutput = $outputs[outputId] || {}
    $: currentStyle = getCurrentStyle($styles, currentOutput.style)

    let mediaStyle: MediaStyle = {}
    $: if (show) mediaStyle = getMediaStyle($media[show.id], currentStyle)
</script>

{#if show}
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
{/if}
