<script lang="ts">
    import type { Output } from "../../../../types/Output"
    import { slideTimers } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import Icon from "../../helpers/Icon.svelte"
    import { getActiveOutputs } from "../../helpers/output"
    import Button from "../../inputs/Button.svelte"
    import Slider from "../../inputs/Slider.svelte"

    export let currentOutput: Output
    export let timer: any

    // $: if (!currentOutput?.out?.transition) {
    //   let outs = getActiveOutputs().map((id) => $outputs[id])
    //   currentOutput = outs.find((output) => output.out?.transition)
    // }

    let autoPause = false
    let step = false
    function transitionChange(e: any) {
        step = true

        let outputIds = getActiveOutputs()
        outputIds.forEach((id) => {
            let timer = $slideTimers[id]
            if (timer) updateTime(e.target.value, timer)
        })
    }
    function updateTime(time, timer) {
        if (!timer.paused) {
            autoPause = true
            timer.timer.pause()
        }
        timer.time = Number(time)
    }

    function mouseup() {
        step = false

        if (autoPause) {
            let outputIds = getActiveOutputs()
            outputIds.forEach((id) => {
                let timer = $slideTimers[id]
                if (timer) timer.timer.resume()
            })

            autoPause = false
        }
    }

    function playPause(isPaused: boolean) {
        let outputIds = getActiveOutputs()
        outputIds.forEach((id) => {
            let timer = $slideTimers[id]
            if (timer) {
                if (isPaused) timer.timer.resume()
                else timer.timer.pause()
            }
        })
    }

    function round(value: number, step = 1) {
        var inv = 1 / step
        return Math.floor(value * inv) / inv
    }
</script>

<svelte:window on:mouseup={mouseup} />

<!-- <span class="name">
    <p><T id="transition.{currentOutput?.out?.transition?.type || 'fade'}" /></p>
  </span> -->
{#if timer.timer && timer.max}
    <span class="group">
        <!-- padding: 0.3em; -->
        <Button style="flex: 0;" center title={translateText(timer.paused ? "media.play" : "media.pause")} on:click={() => playPause(timer.paused)}>
            <Icon id={timer.paused ? "play" : "pause"} size={1.2} white={timer.paused} />
        </Button>
        <span style="color: var(--secondary);padding: 0 10px;">{round(timer.time)}</span>
        <Slider style="flex: 1;" bind:value={timer.time} step={step ? 1 : 0.01} max={timer.max} on:input={transitionChange} on:mousedown={transitionChange} />
        <!-- <input type="range" bind:value={timer.time} step={0.5} max={timer.max} name="" id="" on:input={transitionChange} /> -->
        <span style="padding: 0 10px;">{round(currentOutput?.out?.transition?.duration || 0)}</span>
    </span>
{/if}

<style>
    .group {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
    }
    .group :global(button) {
        flex-grow: 1;
        /* height: 40px; */
    }

    /* .name {
    display: flex;
    justify-content: center;
    padding: 10px;
    opacity: 0.8;
  } */
</style>
