<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import type { Output } from "../../../../types/Output"
    import type { MediaType, ShowType } from "../../../../types/Show"
    import { activeFocus, activeShow, focusMode, outLocked, outputs, playerVideos, videosData, videosTime } from "../../../stores"
    import { triggerClickOnEnterSpace } from "../../../utils/clickable"
    import { translateText } from "../../../utils/language"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import { splitPath } from "../../helpers/get"
    import { getExtension, getMediaType } from "../../helpers/media"
    import { getActiveOutputs } from "../../helpers/output"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import Button from "../../inputs/Button.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import VideoSlider from "../VideoSlider.svelte"

    export let currentOutput: Output | null
    export let outputId: string
    export let big = false

    $: videoData = $videosData[outputId] || {}

    let videoTime = 0
    $: updateVideoTime($videosTime[outputId])
    let timeJustUpdated: NodeJS.Timeout | null = null
    function updateVideoTime(time = 0) {
        if (timeJustUpdated) clearTimeout(timeJustUpdated)
        timeJustUpdated = setTimeout(() => (timeJustUpdated = null), 900)
        videoTime = time
    }

    // custom time update (for player videos)
    let timeInterval: NodeJS.Timeout | null = null
    onMount(() => {
        if ($videosTime[outputId]) videoTime = $videosTime[outputId]
        timeInterval = setInterval(() => {
            if (videoData.paused || timeJustUpdated) return
            videoTime++
        }, 1000)
    })

    onDestroy(() => {
        if (timeInterval) clearInterval(timeInterval)
    })

    // reset
    $: if (path) videoTime = 0

    $: background = currentOutput?.out?.background
    $: path = background?.path || background?.id
    $: type = background?.type || "image"
    if (path && !type) type = getMediaType(getExtension(path)) as MediaType

    let mediaName = ""
    $: outName = path && path.includes(".") && !path.includes("base64") ? splitPath(path).name : ""
    $: mediaName = outName ? outName.slice(0, outName.lastIndexOf(".")) : background?.name || ""

    $: activeOutputIds = getActiveOutputs($outputs, true, true, true)
    const sendToOutput = () => {
        let dataValues: any = {}
        activeOutputIds.forEach(id => {
            dataValues[id] = { ...videoData, muted: id !== outputId ? true : videoData.muted }
        })

        send(OUTPUT, ["DATA"], dataValues)
    }

    function openPreview() {
        if (!background || !path) return

        if ($focusMode) activeFocus.set({ id: path, type: type as ShowType })
        else activeShow.set({ id: path, type: type as ShowType })
    }

    function playPause() {
        videoData.paused = !videoData.paused
        sendToOutput()
    }

    let changeValue = 0
</script>

{#if background}
    {#if big}
        <!--  -->
        {#if type === "video" || background?.type === "player"}
            <FloatingInputs side="center" style="width: 80%;">
                <MaterialButton title={videoData.paused ? "media.play" : "media.pause"} disabled={$outLocked} on:click={playPause}>
                    <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} size={1.5} />
                </MaterialButton>

                <div class="divider" />

                <VideoSlider disabled={$outLocked} {activeOutputIds} bind:videoData bind:videoTime bind:changeValue unmutedId={outputId} toOutput big />

                <div class="divider" />

                <MaterialButton
                    title="media.back10"
                    on:click={() => {
                        changeValue = Math.max(videoTime - 10, 0.01)
                    }}
                >
                    <Icon id="back_10" white size={1.3} />
                </MaterialButton>
                <MaterialButton
                    title="media.forward10"
                    on:click={() => {
                        changeValue = Math.min(videoTime + 10, videoData.duration - 0.1)
                    }}
                >
                    <Icon id="forward_10" white size={1.3} />
                </MaterialButton>

                <div class="divider" />

                <MaterialButton
                    title="media._loop"
                    on:click={() => {
                        videoData.loop = !videoData.loop
                        sendToOutput()
                    }}
                >
                    <Icon id="loop" white={!videoData.loop} size={1.3} />
                </MaterialButton>

                <MaterialButton
                    title={videoData.muted === false ? "actions.mute" : "actions.unmute"}
                    disabled={$outLocked}
                    on:click={() => {
                        if (videoData.muted === undefined) videoData.muted = true
                        videoData.muted = !videoData.muted
                        sendToOutput()
                    }}
                >
                    <Icon id={videoData.muted === false ? "volume" : "muted"} white={videoData.muted !== false} size={1.3} />
                </MaterialButton>
            </FloatingInputs>
        {/if}
    {:else}
        <span class="name" role="button" tabindex="0" on:click={openPreview} on:keydown={triggerClickOnEnterSpace}>
            {#if background?.type === "player"}
                <p>{$playerVideos[background?.id || ""]?.name || "—"}</p>
            {:else}
                <p>{mediaName}</p>
            {/if}
        </span>

        {#if type === "video" || background?.type === "player"}
            <span class="group">
                <Button center title={translateText(videoData.paused ? "media.play" : "media.pause")} disabled={$outLocked} on:click={playPause}>
                    <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} size={1.2} />
                </Button>

                <VideoSlider disabled={$outLocked} {activeOutputIds} bind:videoData bind:videoTime bind:changeValue unmutedId={outputId} toOutput />

                <Button
                    center
                    title={translateText("media.forward10")}
                    on:click={() => {
                        changeValue = Math.min(videoTime + 10, videoData.duration - 0.1)
                    }}
                >
                    <Icon id="forward_10" white size={1.2} />
                </Button>
                <Button
                    center
                    title={translateText("media._loop")}
                    on:click={() => {
                        videoData.loop = !videoData.loop
                        sendToOutput()
                    }}
                >
                    <Icon id="loop" white={!videoData.loop} size={1.2} />
                </Button>
                <Button
                    center
                    title={translateText(videoData.muted === false ? "actions.mute" : "actions.unmute")}
                    disabled={$outLocked}
                    on:click={() => {
                        if (videoData.muted === undefined) videoData.muted = true
                        videoData.muted = !videoData.muted
                        sendToOutput()
                    }}
                >
                    <Icon id={videoData.muted === false ? "volume" : "muted"} white={videoData.muted !== false} size={1.2} />
                </Button>
            </span>
        {/if}
    {/if}
{/if}

<style>
    .group {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
    }
    .group :global(button) {
        padding: 0.3em !important;
    }

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
    .name:focus {
        outline: 2px solid var(--secondary);
        outline-offset: 2px;
    }
</style>
