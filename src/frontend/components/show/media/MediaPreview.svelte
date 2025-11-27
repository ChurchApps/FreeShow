<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import { activeShow, media, outLocked, outputs, styles } from "../../../stores"
    import Image from "../../drawer/media/Image.svelte"
    import { downloadOnlineMedia, getMediaStyle } from "../../helpers/media"
    import { getActiveOutputs, getCurrentStyle, setOutput } from "../../helpers/output"
    import HoverButton from "../../inputs/HoverButton.svelte"
    import { clearSlide } from "../../output/clear"
    import VideoShow from "../VideoShow.svelte"

    $: show = $activeShow

    $: if (show?.id?.includes("http")) download()
    async function download() {
        show!.id = await downloadOnlineMedia(show!.id)
    }

    $: outputId = getActiveOutputs($outputs)[0]
    $: currentOutput = $outputs[outputId] || {}
    $: currentStyle = getCurrentStyle($styles, currentOutput.style)

    let mediaStyle: MediaStyle = {}
    $: mediaData = $media[show?.id || ""] || {}
    $: if (show) mediaStyle = getMediaStyle(mediaData, currentStyle)

    $: mediaStyleString = `width: 100%;height: 100%;object-fit: ${mediaStyle.fit === "blur" ? "contain" : mediaStyle.fit || "contain"};filter: ${mediaStyle.filter || ""};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`
    $: mediaStyleBlurString = `position: absolute;filter: ${mediaStyle.filter || ""} blur(${mediaStyle.fitOptions?.blurAmount ?? 6}px) opacity(${mediaStyle.fitOptions?.blurOpacity || 0.3});object-fit: cover;width: 100%;height: 100%;transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`
</script>

{#if show}
    <!-- WIP indicate that this does not loop when played! -->
    <div style="display: flex;flex-direction: column;height: 100%;">
        {#if show.type === "video" || show.type === "player"}
            <VideoShow {show} {mediaStyle} />
        {:else}
            <div id={show.id} class="media context #media_preview" style="flex: 1;overflow: hidden;">
                <HoverButton
                    icon="play"
                    size={10}
                    on:click={() => {
                        if ($outLocked) return

                        const type = mediaData.videoType
                        if (type === "foreground" || type !== "background") clearSlide()

                        setOutput("background", { path: show?.id, ...mediaStyle })
                    }}
                >
                    {#if mediaStyle.fit === "blur"}
                        <Image style={mediaStyleBlurString} src={show.id} alt="" />
                    {/if}
                    <Image style={mediaStyleString} src={show.id} alt={show.name || ""} />
                </HoverButton>
            </div>
        {/if}
    </div>
{/if}
