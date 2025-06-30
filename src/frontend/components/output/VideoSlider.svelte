<script lang="ts">
    import { OUTPUT } from "../../../types/Channels"
    import { send } from "../../utils/request"
    import { joinTime, secondsToTime } from "../helpers/time"
    import { triggerClickOnEnterSpace } from "../../utils/clickable"
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

    // WIP duplicate of video.ts
    let latestValue = "0"
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

    let movePause = false
    function pauseAtMove(boolean = true) {
        movePause = videoData.paused = boolean

        if (!toOutput) return

        let dataValues: any = {}
        activeOutputIds.forEach((id) => {
            dataValues[id] = { ...videoData, muted: id !== unmutedId ? true : videoData.muted }
        })

        send(OUTPUT, ["DATA"], dataValues)
    }

    let fullLength = false

</script>

<svelte:window
    on:mouseup={(e) => {
        if (!e.target?.closest(".slider") && movePause) pauseAtMove(false)
    }}
/>

<div class="main" class:big>
    {#if hover}
        <span>
            {time}
        </span>
    {:else}
        <span style="color: var(--secondary)">
            {joinTime(secondsToTime(Math.floor(videoTime)))}
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
    <span style={fullLength ? "" : "color: var(--secondary)"} on:click={() => (fullLength = !fullLength)} on:keydown={triggerClickOnEnterSpace} role="button" tabindex="0" aria-label="Toggle time display format">
        {#if fullLength}
            {joinTime(secondsToTime(videoData.duration || 0))}
        {:else}
            {joinTime(secondsToTime((videoData.duration || 0) - Math.floor(videoTime)))}
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
