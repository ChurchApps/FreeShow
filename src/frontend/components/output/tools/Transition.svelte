<script lang="ts">
  import { dictionary, outTransition } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import { nextSlide } from "../../helpers/showActions"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Slider from "../../inputs/Slider.svelte"

  // TODO: global timer...

  let timer = { time: 0, paused: true }
  let timerMax: number = 0
  let timeObj: any = null
  let sliderTimer: any = null

  const Timer: any = function (this: any, callback: any, delay: number) {
    let timeout: any,
      start: number,
      remaining = delay
    timer.time = timerMax - remaining / 1000

    this.clear = () => {
      clearTimeout(timeout)
      timeout = null
    }

    this.pause = () => {
      clearTimeout(timeout)
      clearTimeout(sliderTimer)
      timeout = null
      sliderTimer = null
      remaining -= Date.now() - start
      timer = { time: timerMax - remaining / 1000, paused: true }
    }

    this.resume = () => {
      if (timeout) return
      start = Date.now()
      remaining = (timerMax - timer.time) * 1000
      timeout = setTimeout(() => {
        clearTimeout(timeout)
        timeout = null
        callback()
      }, remaining)
      timer.paused = false
      sliderTime()
    }

    this.resume()
  }

  outTransition.subscribe((a) => {
    timer = { time: 0, paused: true }
    if (timeObj !== null) {
      timeObj.clear()
      timeObj = null
    }

    if (a && a.duration > 0) {
      timerMax = a.duration
      timeObj = new Timer(() => {
        durationAction(a.action)
        // TODO: pause
        timer = { time: 0, paused: timer.paused }
      }, a.duration * 1000)
      sliderTime()
    }
  })

  let autoPause: boolean = false
  function transitionChange(e: any) {
    if (!timer.paused) {
      autoPause = true
      timeObj.pause()
    }
    timer.time = Number(e.target.value)
  }
  function mouseup() {
    if (autoPause) {
      timeObj.resume()
      autoPause = false
    }
  }

  // set timer
  function sliderTime() {
    if (!sliderTimer && timeObj && !timer.paused) {
      sliderTimer = setTimeout(() => {
        if (timeObj && !timer.paused) {
          if (timer.time < timerMax) timer.time += 0.5
          sliderTimer = null
          sliderTime()
        }
      }, 500)
    }
  }

  function round(value: number, step = 1) {
    var inv = 1 / step
    return Math.floor(value * inv) / inv
  }

  function durationAction(action: string) {
    if (timer.paused) return
    switch (action) {
      case "nextSlide":
        nextSlide(null)
        break
    }
  }
</script>

<svelte:window on:mouseup={mouseup} />

{#if $outTransition}
  <span class="name">
    <p><T id="transition.{$outTransition.type || 'fade'}" /></p>
  </span>
  {#if timeObj}
    <span class="group">
      <Button
        style="flex: 0"
        center
        title={timer.paused ? $dictionary.media?.play : $dictionary.media?.pause}
        on:click={() => {
          if (timer.paused) timeObj.resume()
          else timeObj.pause()
        }}
      >
        <Icon id={timer.paused ? "play" : "pause"} size={1.2} />
      </Button>
      <span style="color: var(--secondary);padding: 0 10px;">{round(timer.time)}</span>
      <Slider style="flex: 1;" bind:value={timer.time} step={0.5} max={timerMax} on:input={transitionChange} />
      <!-- <input type="range" bind:value={timer.time} step={0.5} max={timerMax} name="" id="" on:input={transitionChange} /> -->
      <span style="padding: 0 10px;">{round($outTransition.duration)}</span>
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
    flex-grow: 1;
    /* height: 40px; */
  }

  .name {
    display: flex;
    justify-content: center;
    padding: 10px;
    opacity: 0.8;
  }
</style>
