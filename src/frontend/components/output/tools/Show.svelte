<script lang="ts">
    import { OUTPUT } from "../../../../types/Channels"
    import type { Output } from "../../../../types/Output"
    import type { LayoutRef } from "../../../../types/Show"
    import { activeFocus, activeShow, focusMode, outLocked, presentationData, showsCache, slideVideoData } from "../../../stores"
    import { triggerClickOnEnterSpace } from "../../../utils/clickable"
    import { translateText } from "../../../utils/language"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import { getFileName, removeExtension } from "../../helpers/media"
    import T from "../../helpers/T.svelte"
    import { joinTime, secondsToTime } from "../../helpers/time"
    import Button from "../../inputs/Button.svelte"
    import Slider from "../../inputs/Slider.svelte"

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
            showsCache.update(a => {
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

    // {ref.showId}_{ref.slideId}
    $: videoId = `${slide?.id}_${ref?.[slide?.index || ""]?.id}`

    function playPause(path: string, play: boolean) {
        send(OUTPUT, ["SLIDE_VIDEO_STATE"], { slideId: videoId, path, action: play ? "play" : "pause" })
    }
    function toggleLoop(path: string, looping: boolean) {
        const action = looping ? "unloop" : "loop"
        send(OUTPUT, ["SLIDE_VIDEO_STATE"], { slideId: videoId, path, action })
    }
</script>

{#if slide}
    <span class="name" style="justify-content: space-between;" role="button" tabindex="0" on:click={openShow} on:keydown={triggerClickOnEnterSpace}>
        <p>
            {#if name.length}
                {name}
            {:else}
                <T id="main.unnamed" />
            {/if}
        </p>
        {#if totalLength}
            <span style="opacity: 0.6;white-space: nowrap;">
                {currentIndex}/{totalLength}
                {#if linesIndex !== null && maxLines !== null}
                    <span style="opacity: 0.8;font-size: 0.8em;">({linesIndex + 1}/{maxLines})</span>
                {/if}
            </span>
        {/if}
    </span>

    {#if $slideVideoData[videoId]}
        {#each Object.entries($slideVideoData[videoId]) as [path, data]}
            <div class="videoValues">
                <p>{removeExtension(getFileName(path))}</p>

                <span class="group">
                    <Button center title={translateText(data.isPaused ? "media.play" : "media.pause")} disabled={$outLocked} on:click={() => playPause(path, data.isPaused)}>
                        <Icon id={data.isPaused ? "play" : "pause"} white={data.isPaused} />
                    </Button>

                    <div class="mainSlider">
                        <span style="color: var(--secondary)">
                            {joinTime(secondsToTime(Math.floor(data.currentTime)))}
                        </span>

                        <div class="slider">
                            <!-- WIP change time -->
                            <Slider disabled value={data.currentTime} step={1} max={data.duration} />
                            <!-- on:mousedown={() => {
                            if (!videoData.paused) pauseAtMove()
                        }}
                        on:mousemove={move}
                        on:change={sendToOutput}
                        on:input={sliderInput} -->
                        </div>

                        <span style="color: var(--secondary)">
                            {joinTime(secondsToTime((data.duration || 0) - Math.floor(data.currentTime)))}
                        </span>
                    </div>

                    <!-- WIP change loop/mute state -->
                    <!-- NOTE: mute state can be changed in the media item edit currently -->
                    <Button center title={translateText("media._loop")} on:click={() => toggleLoop(path, !!data.loop)}>
                        <Icon id="loop" white={!data.loop} />
                    </Button>
                    <!-- <Button
                        center
                        title={data.muted === false ? $dictionary.actions?.mute : $dictionary.actions?.unmute}
                        disabled={$outLocked}
                        on:click={() => {
                            console.log("set mute")
                        }}
                    >
                        <Icon id={data.muted === false ? "volume" : "muted"} white={data.muted !== false} />
                    </Button> -->
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

    .mainSlider {
        display: flex;
        flex: 1;
        align-items: center;
        margin: 0 5px;
        font-size: 0.8em;
    }

    .slider {
        flex: 1;
        margin: 0 5px;
        height: 100%;
        display: flex;
        align-items: center;
    }
</style>
