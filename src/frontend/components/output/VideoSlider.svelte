<script lang="ts">
    import { OUTPUT } from "../../../types/Channels"
    import { send } from "../../utils/request"
    import { joinTime, secondsToTime } from "../helpers/time"
    import Slider from "../inputs/Slider.svelte"

    export let videoData: any
    export let videoTime: any
    export let outputId: string = ""
    export let toOutput: boolean = false
    export let disabled: boolean = false

    let sliderValue = 0

    let hover = false
    let time: string = "00:00"

    function move(e: any) {
        // TODO: time
        // let ratio: number = e.target.offsetWidth / videoData.duration
        // let percentage: number = (e.offsetX / e.target.offsetWidth) % ratio
        let padding: number = 3.5
        let width: number = e.target.offsetWidth - padding * 2
        let offset: number = e.offsetX - padding
        let percentage: number = offset / width
        // console.log(percentage)
        // let test = (e.offsetX / e.target.clientWidth) * parseInt(videoData.duration, 10)
        // console.log(test.toFixed(2))

        if (percentage < 0) percentage = 0
        else if (percentage > 1) percentage = 1

        // let parsed: number = parseInt((videoData.duration * percentage).toString(), 10)

        time = joinTime(secondsToTime((videoData.duration || 0) * percentage))
        // if (e.buttons && toOutput) sendToOutput(e)
    }

    let changeVideoTimeout: any = null
    let latestValue: string = "0"
    function sliderInput(e: any) {
        latestValue = e?.target?.value
        if (changeVideoTimeout || (!movePause && !videoData.paused) || !latestValue) return

        videoTime = Number(latestValue)
        if (toOutput) send(OUTPUT, ["UPDATE_VIDEO"], { id: outputId, time: videoTime, updatePreview: true })

        changeVideoTimeout = setTimeout(() => {
            changeVideoTimeout = null
            if (!movePause || !videoData.paused) return
            videoTime = Number(latestValue)
            if (toOutput) send(OUTPUT, ["UPDATE_VIDEO"], { id: outputId, time: videoTime, updatePreview: true })
        }, 80)
    }

    // let timeout: any = null
    const sendToOutput = (e: any = null) => {
        if (!movePause || !videoData.paused) return
        console.log("CHANGE", e)

        // if (timeout) return
        // let time = videoTime

        let value = e?.target?.value
        console.log(Number(value))

        if (value !== undefined) {
            videoTime = Number(value)
            if (toOutput) send(OUTPUT, ["UPDATE_VIDEO"], { id: outputId, time: videoTime })
        }

        if (movePause) pauseAtMove(false)

        // window.api.send(OUTPUT, { channel: "MAIN_VIDEO_TIME", data: videoTime })
        // window.api.send(OUTPUT, { channel: "MAIN_VIDEO_DATA", data: videoData })

        // timeout = setTimeout(() => {
        //   timeout = null
        //   if (videoTime !== time) window.api.send(OUTPUT, { channel: "MAIN_VIDEO_TIME", data: videoTime })
        // }, 100)
    }

    $: if (videoTime && !movePause && !videoData.paused) sliderValue = videoTime

    let movePause: boolean = false
    function pauseAtMove(boolean: boolean = true) {
        movePause = videoData.paused = boolean
        if (toOutput) send(OUTPUT, ["UPDATE_VIDEO"], { id: outputId, data: videoData })
    }
</script>

<svelte:window
    on:mouseup={(e) => {
        if (!e.target?.closest(".slider") && movePause) pauseAtMove(false)
    }}
/>

<div class="main">
    {#if hover}
        <span>
            {time}
        </span>
    {:else}
        <span style="color: var(--secondary)">
            {joinTime(secondsToTime(videoTime))}
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
                // if (toOutput) sendToOutput()
                if (!videoData.paused) pauseAtMove()
            }}
            on:mousemove={move}
            on:change={sendToOutput}
            on:input={sliderInput}
        />
    </div>
    {joinTime(secondsToTime(videoData.duration || 0))}
</div>

<style>
    .main {
        display: flex;
        flex: 1;
        align-items: center;
        margin: 0 10px;
    }

    .slider {
        flex: 1;
        margin: 0 10px;
        height: 100%;
        display: flex;
        align-items: center;
    }
</style>
