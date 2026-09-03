<script lang="ts">
    import { triggerClickOnEnterSpace } from "../../utils/clickable"
    import { joinTime, secondsToTime } from "../helpers/time"
    import Slider from "../inputs/Slider.svelte"
    import { VideoPlayer } from "../media/video/videoPlayer"

    export let outputId: string | undefined = undefined
    export let path: string | undefined

    export let videoData: any
    export let videoTime: any
    export let big = false
    export let disabled = false
    export let changeValue = 0

    $: if (changeValue) {
        finishDrag(changeValue)
        changeValue = 0
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

        const dur = Number.isFinite(videoData?.duration) && videoData.duration > 0 ? videoData.duration : 0
        time = joinTime(secondsToTime(dur * percentage))
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
    let lastSeekedValue: number | null = null

    function onInput(e: any) {
        const val = getNumericValue(e) ?? latestValue
        if (val === null) return
        latestValue = val
        sliderValue = val

        if (!dragSeekTimeout) {
            dragSeekTimeout = setTimeout(() => {
                dragSeekTimeout = null
                if (movePause && sliderValue !== null) {
                    videoTime = sliderValue
                    lastSeekedValue = videoTime
                    if (path && outputId) VideoPlayer.seekTo(path, outputId, videoTime)
                }
            }, 150)
        }
    }

    function finishDrag(e: any = null) {
        if (dragSeekTimeout) {
            clearTimeout(dragSeekTimeout)
            dragSeekTimeout = null
        }

        const wasDragging = movePause
        if (movePause) pauseAtMove(false)

        const val = getNumericValue(e) ?? sliderValue ?? latestValue
        if (val !== null) {
            latestValue = val
            sliderValue = val
            videoTime = val
            if (path && outputId && (wasDragging || lastSeekedValue !== val)) {
                lastSeekedValue = val
                VideoPlayer.seekTo(path, outputId, videoTime)
            }
        }
    }

    $: if (videoTime !== undefined && !movePause) sliderValue = videoTime

    let movePause = false
    let wasPausedBeforeMove = false
    function pauseAtMove(boolean = true) {
        if (!path) return

        if (boolean) {
            wasPausedBeforeMove = !!videoData.paused
            movePause = true
            videoData.paused = true
            if (outputId) VideoPlayer.pause(path, outputId)
        } else {
            movePause = false
            videoData.paused = wasPausedBeforeMove
            if (outputId && !wasPausedBeforeMove) VideoPlayer.play(path, outputId)
        }
    }

    let fullLength = false
    $: validDuration = Number.isFinite(videoData?.duration) && videoData.duration > 0 ? videoData.duration : 0
    $: validTime = Number.isFinite(videoTime) && videoTime > 0 ? videoTime : 0
    $: displayTime = Math.max(0, validDuration ? Math.min(validTime, validDuration) : validTime)
    $: remainingTime = Math.max(0, validDuration - Math.floor(displayTime))
</script>

<svelte:window
    on:mouseup={() => {
        if (movePause) finishDrag()
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
            max={validDuration}
            on:mousedown={() => {
                pauseAtMove(true)
            }}
            on:mousemove={move}
            on:change={finishDrag}
            on:input={onInput}
        />
    </div>
    <span style={fullLength ? "" : "color: var(--secondary)"} on:click={() => (fullLength = !fullLength)} on:keydown={triggerClickOnEnterSpace} role="button" tabindex="0" aria-label="Toggle time display format">
        {#if fullLength}
            {joinTime(secondsToTime(validDuration))}
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
