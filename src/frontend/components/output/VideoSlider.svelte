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

    let hover = false
    let time: string = "00:00"

    function move(e: any) {
        // TODO: time
        // let ratio: number = e.target.offsetWidth / videoData.duration
        // let percentage: number = (e.offsetX / e.target.offsetWidth) % ratio
        let percentage: number = e.offsetX / e.target.offsetWidth
        // console.log(percentage)
        // let test = (e.offsetX / e.target.clientWidth) * parseInt(videoData.duration, 10)
        // console.log(test.toFixed(2))

        if (percentage < 0) percentage = 0
        else if (percentage > 1) percentage = 1

        // let parsed: number = parseInt((videoData.duration * percentage).toString(), 10)

        time = joinTime(secondsToTime((videoData.duration || 0) * percentage))
        if (e.buttons && toOutput) sendToOutput()
    }

    let timeout: any = null
    const sendToOutput = () => {
        if (!timeout) {
            // let time = videoTime

            send(OUTPUT, ["UPDATE_VIDEO"], { id: outputId, data: videoData, time: videoTime })

            // window.api.send(OUTPUT, { channel: "MAIN_VIDEO_TIME", data: videoTime })
            // window.api.send(OUTPUT, { channel: "MAIN_VIDEO_DATA", data: videoData })

            // timeout = setTimeout(() => {
            //   timeout = null
            //   if (videoTime !== time) window.api.send(OUTPUT, { channel: "MAIN_VIDEO_TIME", data: videoTime })
            // }, 100)
        }
    }

    let movePause: boolean = false
    function pauseAtMove(boolean: boolean = true) {
        movePause = videoData.paused = boolean
        if (toOutput) send(OUTPUT, ["UPDATE_VIDEO"], { id: outputId, data: videoData })
    }
</script>

<svelte:window
    on:mouseup={() => {
        if (movePause) pauseAtMove(false)
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
            bind:value={videoTime}
            step={1}
            max={videoData.duration}
            on:mousedown={() => {
                if (toOutput) sendToOutput()
                if (!videoData.paused) pauseAtMove()
            }}
            on:mousemove={move}
            on:change={() => {
                if (toOutput) sendToOutput()
            }}
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
