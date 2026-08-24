<script lang="ts">
    import type { Output } from "../../../../types/Output"
    import type { LayoutRef } from "../../../../types/Show"
    import { activeFocus, activeShow, focusMode, outLocked, playingVideoState, presentationData, showsCache } from "../../../stores"
    import { triggerClickOnEnterSpace } from "../../../utils/clickable"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import { getFileName, removeExtension } from "../../helpers/media"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import { VideoPlayer } from "../../media/video/videoPlayer"
    import VideoSlider from "../VideoSlider.svelte"

    export let currentOutput: Output
    export let ref: LayoutRef[] | { temp: boolean; items: any; id: string }[] | undefined
    export let linesIndex: null | number
    export let maxLines: null | number

    $: slide = currentOutput?.out?.slide

    $: name = slide?.name || $showsCache[slide?.id || ""]?.name || "—"
    $: length = ref?.length || 0

    function openShow() {
        if (!slide || slide.id === "temp") return

        if (slide?.layout && $showsCache[slide.id]) {
            showsCache.update((a) => {
                if (!a[slide.id].settings) a[slide.id].settings = { activeLayout: "", template: null }
                a[slide.id].settings.activeLayout = slide.layout!
                return a
            })
        }

        if ($focusMode) activeFocus.set({ id: slide?.id, type: slide?.type || "show" })
        else activeShow.set({ id: slide?.id, type: slide?.type || "show" })
    }

    $: currentIndex = slide?.type === "ppt" ? $presentationData.stat?.position : (slide?.page || slide?.index || 0) + 1
    $: totalLength = slide?.type === "ppt" ? $presentationData.stat?.slides : slide?.pages || length

    $: itemVideos = Object.entries($playingVideoState).filter(([_, data]) => data.type === "item")

    function playPause(path: string, outputId: string, isPaused: boolean) {
        if (isPaused) VideoPlayer.play(path, outputId)
        else VideoPlayer.pause(path, outputId)
    }
    function toggleLoop(path: string, outputId: string) {
        VideoPlayer.toggleLoop(path, outputId)
    }
</script>

{#if slide}
    <span class="name" style="justify-content: space-between;" role="button" tabindex="0" on:click={openShow} on:keydown={triggerClickOnEnterSpace}>
        <p style="font-size: 0.9em;">
            {#if name.length}
                {name}
            {:else}
                <T id="main.unnamed" />
            {/if}
        </p>
        {#if totalLength}
            <span style="opacity: 0.6;white-space: nowrap;font-size: 0.9em;">
                {currentIndex}/{totalLength}
                {#if linesIndex !== null && maxLines !== null}
                    <span style="opacity: 0.8;font-size: 0.8em;">({linesIndex + 1}/{maxLines})</span>
                {/if}
            </span>
        {/if}
    </span>

    {#if itemVideos.length}
        {#each itemVideos as [key, data]}
            {@const sepIndex = key.lastIndexOf("_")}
            {@const path = sepIndex !== -1 ? key.slice(0, sepIndex) : key}
            {@const outputId = sepIndex !== -1 ? key.slice(sepIndex + 1) : ""}
            <div class="videoValues">
                <p>{removeExtension(getFileName(path))}</p>

                <span class="group">
                    <Button center title={translateText(data.paused ? "media.play" : "media.pause")} disabled={$outLocked} on:click={() => playPause(path, outputId, data.paused)}>
                        <Icon id={data.paused ? "play" : "pause"} white={data.paused} />
                    </Button>

                    <VideoSlider {outputId} {path} disabled={$outLocked} videoData={{ duration: data.duration, paused: data.paused, loop: data.loop }} videoTime={data.currentTime} />

                    <Button center title={translateText("media._loop" + (data.loop ? ": settings.enabled" : ""))} on:click={() => toggleLoop(path, outputId)}>
                        <Icon id="loop" white={!data.loop} />
                    </Button>
                    <Button center title={translateText(data.muted === false ? "actions.mute" : "actions.unmute")} disabled={$outLocked} on:click={() => VideoPlayer.toggleMute(path, outputId)}>
                        <Icon id={data.muted === false ? "volume" : "muted"} white={data.muted !== false} />
                    </Button>
                </span>
            </div>
        {/each}
    {/if}
{/if}

<style>
    .name {
        display: flex;
        justify-content: center;
        padding: 5px 10px;
        opacity: 0.8;

        cursor: pointer;
    }

    .name:hover {
        background-color: var(--primary-darker);
    }

    /* video */

    .videoValues {
        display: flex;
        flex-direction: column;

        border-top: 2px solid var(--primary-lighter);
    }

    .videoValues p {
        /* text-align: center; */
        font-size: 0.8em;
        opacity: 0.8;

        padding: 3px 10px;
    }

    .group {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
    }
    .group :global(button) {
        padding: 0.3em !important;
    }
</style>
