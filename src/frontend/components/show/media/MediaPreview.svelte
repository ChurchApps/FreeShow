<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import { ProjectShowRef } from "../../../../types/Projects"
    import { activeShow, media, outLocked, outputs, styles } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Image from "../../drawer/media/Image.svelte"
    import Icon from "../../helpers/Icon.svelte"
    import { getMedia, getMediaLayerType, getMediaStyle } from "../../helpers/media"
    import { getActiveOutputs, getCurrentStyle, setOutput } from "../../helpers/output"
    import HoverButton from "../../inputs/HoverButton.svelte"
    import { clearSlide } from "../../output/clear"
    import Center from "../../system/Center.svelte"
    import VideoShow from "../VideoShow.svelte"

    export let projectShow: ProjectShowRef | null = null
    $: show = projectShow || $activeShow

    // LOAD MEDIA

    let mediaPath = ""
    let failed = false

    $: path = show?.id || ""
    $: if (path) loadMedia()
    async function loadMedia() {
        failed = false
        mediaPath = path

        if (show?.type === "player") return

        const media = await getMedia(path)
        if (!media) {
            failed = true
            return
        }

        mediaPath = media.path
    }

    $: outputId = getActiveOutputs($outputs)[0]
    $: currentOutput = $outputs[outputId] || {}
    $: currentStyle = getCurrentStyle($styles, currentOutput.style)

    let mediaStyle: MediaStyle = {}
    $: mediaData = $media[path] || {}
    $: if (show) mediaStyle = getMediaStyle(mediaData, currentStyle)

    $: mediaStyleString = `width: 100%;height: 100%;object-fit: ${mediaStyle.fit === "blur" ? "contain" : mediaStyle.fit || "contain"};filter: ${mediaStyle.filter || ""};transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`
    $: mediaStyleBlurString = `position: absolute;filter: ${mediaStyle.filter || ""} blur(${mediaStyle.fitOptions?.blurAmount ?? 6}px) opacity(${mediaStyle.fitOptions?.blurOpacity || 0.3});object-fit: cover;width: 100%;height: 100%;transform: scale(${mediaStyle.flipped ? "-1" : "1"}, ${mediaStyle.flippedY ? "-1" : "1"});`
</script>

{#if show}
    <!-- WIP indicate that this does not loop when played! -->
    <div style="display: flex;flex-direction: column;height: {projectShow ? '250px' : '100%'};" data-title={failed ? translateText(`error.media: ${mediaPath}`) : ""}>
        {#if failed}
            <Center>
                <Icon size={4} id="close" style="color: var(--disconnected);" white />
            </Center>
        {:else if show.type === "video" || show.type === "player"}
            <VideoShow {mediaPath} {show} {mediaStyle} />
        {:else}
            <div id={mediaPath} class="media context #media_preview" style="flex: 1;overflow: hidden;">
                <HoverButton
                    icon="play"
                    size={10}
                    on:click={() => {
                        if ($outLocked) return

                        const type = getMediaLayerType(mediaPath, mediaStyle)
                        if (type === "foreground" || type !== "background") clearSlide()

                        setOutput("background", { path: mediaPath, ...mediaStyle })
                    }}
                >
                    {#if mediaStyle.fit === "blur"}
                        <Image style={mediaStyleBlurString} src={mediaPath} alt="" />
                    {/if}
                    <Image style={mediaStyleString} src={mediaPath} alt={show.name || ""} />
                </HoverButton>
            </div>
        {/if}
    </div>
{/if}
