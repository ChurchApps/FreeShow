<script lang="ts">
  import { activeShow, dictionary, playingAudio } from "../../stores"
  import { getAudioDuration, playAudio } from "../helpers/audio"
  import Icon from "../helpers/Icon.svelte"
  import { joinTime, secondsToTime } from "../helpers/time"
  import Button from "../inputs/Button.svelte"
  import Slider from "../inputs/Slider.svelte"

  $: path = $activeShow?.id || ""
  $: name = $activeShow?.name || ""
  $: playing = $playingAudio[path] || {}
  $: paused = playing.paused !== false

  let currentTime: number = 0
  let duration: any = 0
  $: if (path) getDuration()
  async function getDuration() {
    duration = await getAudioDuration(path)
    currentTime = 0
  }

  $: if (!paused && path) startUpdater()

  // updater
  let interval: any = null
  function startUpdater() {
    if (interval) return

    interval = setInterval(() => {
      if (paused) {
        clearInterval(interval)
        interval = null
      }
      if (sliderValue === null) currentTime = playing.audio?.currentTime || 0
    }, 100)
  }

  function clearAudio() {
    playingAudio.update((a) => {
      a[path].audio.pause()
      delete a[path]
      return a
    })

    currentTime = 0
  }

  function setTime(e: any) {
    sliderValue = null
    if (playing.audio) playing.audio.currentTime = e.target.value
    else currentTime = e.target.value
  }

  let sliderValue: any = null
  function setSliderValue(e: any) {
    sliderValue = e.target.value
  }

  function keydown(e: any) {
    if (e.key === " ") playAudio({ path, name }, true, currentTime)
  }
</script>

<svelte:window on:keydown={keydown} />

<!-- TODO: visualizer! -->

<div class="buttons" style="display: flex;">
  <Button style="flex: 0" center title={paused ? $dictionary.media?.play : $dictionary.media?.pause} on:click={() => playAudio({ path, name }, true, currentTime)}>
    <Icon id={paused ? "play" : "pause"} white={paused} size={1.2} />
  </Button>
  {#if sliderValue !== null}
    <span>
      {joinTime(secondsToTime(sliderValue))}
    </span>
  {:else}
    <span style="color: var(--secondary)">
      {joinTime(secondsToTime(currentTime))}
    </span>
  {/if}
  <Slider value={currentTime} max={duration} on:input={setSliderValue} on:change={setTime} />
  <span>
    {joinTime(secondsToTime(duration))}
  </span>
  <Button disabled={!playing.audio} style="flex: 0" center title={$dictionary.media?.stop} on:click={() => clearAudio()}>
    <Icon id={"stop"} white size={1.2} />
  </Button>

  <!-- TODO: individual volume -->
</div>

<style>
  .buttons {
    gap: 10px;
    align-items: center;

    /* position: absolute;
    bottom: 0;
    width: 100%; */
  }

  div :global(input) {
    background: var(--primary);
  }
</style>
