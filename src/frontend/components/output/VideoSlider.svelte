<script lang="ts">
    import { OUTPUT } from "../../../types/Channels"
    import { outputs, videosTime } from "../../stores"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"
    import { send } from "../../utils/request"
    import { joinTime, secondsToTime } from "../helpers/time"
    import { VideoController } from "../media/VideoController"
    import Slider from "../inputs/Slider.svelte"

    export let videoData: any
    export let videoTime: any
    export let activeOutputIds: string[] = []
    export let unmutedId = ""
    export let toOutput = false
    export let big = false
    export let disabled = false
    export let changeValue = 0

    $: if (changeValue) updateValue()
    function updateValue() {
        if (!videoData.paused) pauseAtMove()
        sliderValue = changeValue
        sliderInput(changeValue)

        setTimeout(() => {
            sendToOutput()
            changeValue = 0
        })
    }

    let sliderValue = 0

    let hover = false
    let time = "00:00"

    function move(e: any) {
        let padding = 3.5
        let width: number = e.target.offsetWidth - padding * 2
        let offset: number = e.offsetX - padding
        let percentage: number = offset / width

        if (percentage < 0) percentage = 0
        else if (percentage > 1) percentage = 1

        time = joinTime(secondsToTime((videoData.duration || 0) * percentage))
    }

    let latestValue: number | null = null

    function getNumericValue(e: any): number | null {
        if (typeof e === "number") return isNaN(e) ? null : e
        if (typeof e === "string") {
            const num = Number(e)
            return isNaN(num) ? null : num
        }
        if (e && typeof e === "object") {
            if (e.target && "value" in e.target) {
                const num = Number(e.target.value)
                return isNaN(num) ? null : num
            }
            if ("detail" in e) {
                return getNumericValue(e.detail)
            }
        }
        return null
    }

    let dragSeekTimeout: NodeJS.Timeout | null = null

    function sliderInput(e: any) {
        const val = getNumericValue(e) ?? latestValue
        if (val === null) return
        latestValue = val
        sliderValue = val

        if (!dragSeekTimeout) {
            dragSeekTimeout = setTimeout(() => {
                dragSeekTimeout = null
                if (movePause && sliderValue !== null) {
                    videoTime = sliderValue
                    seekAllOutputs(videoTime)
                }
            }, 150)
        }
    }

    function seekAllOutputs(time: number) {
        // Seek via controller if available (native videos)
        const ctrl = VideoController.get(unmutedId)
        if (ctrl) {
            ctrl.seek(time)
        } else {
            // Fallback: update store & send IPC for players/images
            const outputList = toOutput && activeOutputIds.length ? activeOutputIds : Object.keys($outputs)
            let timeValues: any = {}
            outputList.forEach((id) => { timeValues[id] = time })
            videosTime.update((a) => ({ ...a, ...timeValues }))
            send(OUTPUT, ["TIME"], timeValues)
        }
    }

    const sendToOutput = (e: any = null) => {
        if (dragSeekTimeout) {
            clearTimeout(dragSeekTimeout)
            dragSeekTimeout = null
        }

        const val = getNumericValue(e) ?? sliderValue ?? latestValue
        if (val !== null) {
            latestValue = val
            sliderValue = val
            videoTime = val
            seekAllOutputs(videoTime)
        }

        if (movePause) pauseAtMove(false)
    }

    $: if (videoTime !== undefined && !movePause) sliderValue = videoTime

    let movePause = false
    let wasPausedBeforeMove = false
    function pauseAtMove(boolean = true) {
        const ctrl = VideoController.get(unmutedId)

        if (boolean) {
            wasPausedBeforeMove = !!videoData.paused
            movePause = true
            videoData.paused = true
            if (ctrl) ctrl.pause()
        } else {
            movePause = false
            videoData.paused = wasPausedBeforeMove
            if (ctrl && !wasPausedBeforeMove) ctrl.play()
        }

        if (!toOutput || ctrl) return

        // Fallback for non-native-video: send DATA IPC
        let dataValues: any = {}
        activeOutputIds.forEach((id) => {
            dataValues[id] = { ...videoData, muted: id !== unmutedId ? true : videoData.muted }
        })

        send(OUTPUT, ["DATA"], dataValues)
    }

    let fullLength = false
    $: displayTime = Math.max(0, videoData?.duration ? Math.min(videoTime || 0, videoData.duration) : videoTime || 0)
    $: remainingTime = Math.max(0, (videoData?.duration || 0) - Math.floor(displayTime))
</script>

<svelte:window
    on:mouseup={() => {
        if (movePause) sendToOutput()
    }}
/>

<div class="main" class:big>
    {#if hover}
        <span>
            {time}
        </span>
    {:else}
        <span style="color: var(--secondary)">
            {joinTime(secondsToTime(Math.floor(displayTime)))}
        </span>
    {/if}
    <div class="slider">
        <Slider
            {disabled}
            on:mouseenter={() => (hover = true)}
            on:mouseleave={() => (hover = false)}
            value={sliderValue}
            step={1}
            max={videoData.duration}
            on:mousedown={() => {
                pauseAtMove(true)
            }}
            on:mousemove={move}
            on:change={sendToOutput}
            on:input={sliderInput}
        />
    </div>
    <span style={fullLength ? "" : "color: var(--secondary)"} on:click={() => (fullLength = !fullLength)} on:keydown={triggerClickOnEnterSpace} role="button" tabindex="0" aria-label="Toggle time display format">
        {#if fullLength}
            {joinTime(secondsToTime(videoData.duration || 0))}
        {:else}
            {joinTime(secondsToTime(remainingTime))}
        {/if}
    </span>
</div>

<style>
    .main {
        display: flex;
        flex: 1;
        align-items: center;
        margin: 0 5px;
        font-size: 0.8em;
    }
    .main.big {
        font-size: 1em;
        margin: 0 10px;
    }

    .slider {
        flex: 1;
        margin: 0 5px;
        height: 100%;
        display: flex;
        align-items: center;
    }
    .main.big .slider {
        margin: 0 10px;
    }
</style>
