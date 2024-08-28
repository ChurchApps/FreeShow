<script lang="ts">
    import { onMount } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import { activeFocus, activeShow, dictionary, focusMode, outLocked, outputs, playerVideos, videosData, videosTime } from "../../../stores"
    import { send } from "../../../utils/request"
    import Icon from "../../helpers/Icon.svelte"
    import { splitPath } from "../../helpers/get"
    import { getExtension, getMediaType } from "../../helpers/media"
    import { getActiveOutputs } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import VideoSlider from "../VideoSlider.svelte"

    export let currentOutput: any
    export let outputId: string

    $: videoData = $videosData[outputId] || {}

    let videoTime: number = 0
    $: updateVideoTime($videosTime[outputId])
    let timeJustUpdated: any = null
    function updateVideoTime(time: number = 0) {
        if (timeJustUpdated) clearTimeout(timeJustUpdated)
        timeJustUpdated = setTimeout(() => (timeJustUpdated = null), 900)
        videoTime = time
    }

    // custom time update (for player videos)
    onMount(() => {
        setInterval(() => {
            if (videoData.paused || timeJustUpdated) return
            videoTime++
        }, 1000)
    })

    // reset
    $: if (path) videoTime = 0

    $: background = currentOutput?.out?.background
    $: path = background?.path || background?.id
    $: type = background?.type || "image"
    if (path && !type) type = getMediaType(getExtension(path))

    let mediaName: string = ""
    $: outName = path && path.includes(".") && !path.includes("base64") ? splitPath(path).name : ""
    $: mediaName = outName ? outName.slice(0, outName.lastIndexOf(".")) : background?.name || ""

    $: activeOutputIds = getActiveOutputs($outputs, true, true, true)
    const sendToOutput = () => {
        let dataValues: any = {}
        activeOutputIds.forEach((id, i: number) => {
            dataValues[id] = { ...videoData, muted: i > 0 ? true : videoData.muted }

            let keyOutput = $outputs[id].keyOutput
            if (keyOutput) dataValues[keyOutput] = videoData
        })

        send(OUTPUT, ["DATA"], dataValues)
    }

    function openPreview() {
        if (!background) return

        if ($focusMode) activeFocus.set({ id: path })
        else activeShow.set({ id: path, type })
    }

    function keydown(e: any) {
        if (e.key !== " ") return
        if ($focusMode || e.target.closest(".edit") || e.target.closest("input")) return

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
    <span class="name" on:click={openPreview}>
        {#if background?.type === "player"}
            <p>{$playerVideos[background?.id || ""]?.name || "—"}</p>
        {:else}
            <p>{mediaName}</p>
        {/if}
    </span>

    {#if type === "video" || background?.type === "player"}
        <span class="group">
            <Button center title={videoData.paused ? $dictionary.media?.play : $dictionary.media?.pause} disabled={$outLocked} on:click={playPause}>
                <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} size={1.2} />
            </Button>

            <VideoSlider disabled={$outLocked} {activeOutputIds} bind:videoData bind:videoTime bind:changeValue toOutput />

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
