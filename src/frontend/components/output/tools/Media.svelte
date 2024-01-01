<script lang="ts">
    import { onMount } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import { activeShow, currentWindow, dictionary, outLocked, outputDisplay, outputs, playerVideos } from "../../../stores"
    import { receive, send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import { clone } from "../../helpers/array"
    import { splitPath } from "../../helpers/get"
    import { getExtension, getMediaType } from "../../helpers/media"
    import { clearPlayingVideo } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import VideoSlider from "../VideoSlider.svelte"

    export let currentOutput: any
    export let outputId: string
    export let title: any

    let videoTime: number = 0
    let videoData: any = { duration: 0, paused: true, muted: false, loop: false }

    let videoInterval: any = null
    $: if (outputId && type === "video") send(OUTPUT, ["REQUEST_VIDEO_DATA"], { id: outputId })
    else resetVideo()

    // restore output video data when recreating window
    $: if (!$outputDisplay) sendDataToOutput()
    function sendDataToOutput() {
        if (!currentOutput || !videoTime || !videoInterval) return
        let data = clone(videoData)

        setTimeout(() => {
            send(OUTPUT, ["UPDATE_VIDEO"], { id: outputId, time: videoTime, data })
        }, 2200)
    }

    function resetVideo() {
        clearInterval(videoInterval)

        videoTime = 0
        videoData = { duration: 0, paused: true, muted: false, loop: false }
    }
    function startVideoTimer() {
        if (videoInterval) clearInterval(videoInterval)

        videoInterval = setInterval(() => {
            if (videoData.paused) return

            videoTime++

            if (videoTime >= videoData.duration) {
                clearInterval(videoInterval)
                send(OUTPUT, ["REQUEST_VIDEO_DATA"], { id: outputId })
            }
        }, 1000)
    }

    const receiveOutput = {
        MAIN_VIDEO: (msg) => {
            if (msg.id !== outputId) return
            console.log(msg)

            if (msg.data) videoData = msg.data

            if (msg.time !== undefined) {
                videoTime = msg.time || 0
                startVideoTimer()
            }
        },
        MAIN_VIDEO_ENDED: (msg) => {
            // WIP only activated when preview media tab is open
            console.log("ENDED!")

            if ($currentWindow === "output") return

            if (msg.id !== outputId || type !== "video") return
            // check and execute next after media regardless of loop
            // next after function is likely skipped as it is first executed by the startup receiver
            // checkNextAfterMedia(path) ||
            if (videoData.loop) return

            if (videoInterval) clearInterval(videoInterval)

            setTimeout(async () => {
                // return if background is set to something else
                if ($outputs[outputId].out?.background !== path) return

                videoData = await clearPlayingVideo(outputId)
                videoTime = 0
            }, 250)
        },
    }

    onMount(() => {
        receive(OUTPUT, receiveOutput)
    })

    /////

    $: background = currentOutput?.out?.background
    $: path = background?.path || background?.id
    $: type = background?.type || "image"
    if (path && !type) type = getMediaType(getExtension(path))

    let mediaName: string = ""
    $: outName = path && !path.includes("base64") ? splitPath(path).name : ""
    $: mediaName = outName ? outName.slice(0, outName.lastIndexOf(".")) : background?.name || ""

    const sendToOutput = () => {
        send(OUTPUT, ["UPDATE_VIDEO"], { id: outputId, data: videoData })
        if (currentOutput.keyOutput) send(OUTPUT, ["UPDATE_VIDEO"], { id: currentOutput.keyOutput, data: videoData })
    }

    function openPreview() {
        if (!background) return

        activeShow.set({ id: path, type })
    }

    function keydown(e: any) {
        if (e.key !== " ") return
        if (e.target.closest(".edit") || e.target.closest("input")) return

        let show = $activeShow
        if (show && (show.type === "show" || show.type === undefined)) return

        if (show?.id !== path) return

        // play / pause video
        e.preventDefault()
        playPause()
    }

    function playPause() {
        videoData.paused = !videoData.paused
        sendToOutput()
    }

    let changeValue: number = 0
</script>

<svelte:window on:keydown={keydown} />

{#if background}
    {#if background?.type === "player"}
        <span class="name" on:click={openPreview}>
            <p>{title?.length ? title : $playerVideos[background?.id || ""]?.name}</p>
        </span>
    {:else}
        <span class="name" on:click={openPreview}>
            <p>{mediaName}</p>
        </span>
    {/if}

    {#if type === "video" || background?.type === "player"}
        <span class="group">
            <Button center title={videoData.paused ? $dictionary.media?.play : $dictionary.media?.pause} disabled={$outLocked} on:click={playPause}>
                <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} size={1.2} />
            </Button>
            <VideoSlider disabled={$outLocked} {outputId} bind:videoData bind:videoTime bind:changeValue toOutput />
            <Button
                center
                title={$dictionary.media?.back10}
                on:click={() => {
                    changeValue = Math.max(videoTime - 10, 0.01)
                }}
            >
                <Icon id="back_10" white size={1.2} />
            </Button>
            <Button
                center
                title={$dictionary.media?.forward10}
                on:click={() => {
                    changeValue = Math.min(videoTime + 10, videoData.duration - 0.1)
                }}
            >
                <Icon id="forward_10" white size={1.2} />
            </Button>
            <Button
                center
                title={$dictionary.media?._loop}
                on:click={() => {
                    videoData.loop = !videoData.loop
                    sendToOutput()
                }}
            >
                <Icon id="loop" white={!videoData.loop} size={1.2} />
            </Button>
            <Button
                center
                title={videoData.muted === false ? $dictionary.actions?.mute : $dictionary.actions?.unmute}
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
</style>
