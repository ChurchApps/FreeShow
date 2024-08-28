<script lang="ts">
    import { OUTPUT } from "../../../types/Channels"
    import { send } from "../../utils/request"
    import { joinTime, secondsToTime } from "../helpers/time"
    import Slider from "../inputs/Slider.svelte"

    export let videoData: any
    export let videoTime: any
    export let activeOutputIds: string[] = []
    export let toOutput: boolean = false
    export let disabled: boolean = false
    export let changeValue: number = 0

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
    let time: string = "00:00"

    function move(e: any) {
        let padding: number = 3.5
        let width: number = e.target.offsetWidth - padding * 2
        let offset: number = e.offsetX - padding
        let percentage: number = offset / width

        if (percentage < 0) percentage = 0
        else if (percentage > 1) percentage = 1

        time = joinTime(secondsToTime((videoData.duration || 0) * percentage))
    }

    let latestValue: string = "0"
    function sliderInput(e: any) {
        latestValue = e?.target?.value || e
        if ((!movePause && !videoData.paused) || !latestValue) return

        videoTime = Number(latestValue)

        if (!toOutput) return

        let timeValues: any = {}
        activeOutputIds.forEach((id) => {
            timeValues[id] = videoTime
        })

        send(OUTPUT, ["TIME"], timeValues)
    }

    const sendToOutput = (e: any = null) => {
        if (!movePause || !videoData.paused) return

        let value = e?.target?.value

        if (value !== undefined) {
            videoTime = Number(value)
            if (toOutput) {
                let timeValues: any = {}
                activeOutputIds.forEach((id) => {
                    timeValues[id] = videoTime
                })

                send(OUTPUT, ["TIME"], timeValues)
            }
        }

        if (movePause) pauseAtMove(false)
    }

    $: if (videoTime !== undefined && !movePause) sliderValue = videoTime

    let movePause: boolean = false
    function pauseAtMove(boolean: boolean = true) {
        movePause = videoData.paused = boolean

        if (!toOutput) return

        let dataValues: any = {}
        activeOutputIds.forEach((id, i: number) => {
            dataValues[id] = { ...videoData, muted: i > 0 ? true : videoData.muted }
        })

        send(OUTPUT, ["DATA"], dataValues)
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
                if (!videoData.paused) pauseAtMove()
            }}
            on:mousemove={move}
            on:change={sendToOutput}
            on:input={sliderInput}
        />
    </div>
    <span>{joinTime(secondsToTime(videoData.duration || 0))}</span>
</div>

<style>
    .main {
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
