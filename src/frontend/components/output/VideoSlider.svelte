<script lang="ts">
  import { OUTPUT } from "../../../types/Channels"

  import { joinTime, secondsToTime } from "../helpers/time"
  import Slider from "../inputs/Slider.svelte"

  export let videoData: any

  // $: duration = video.duration || 0
  // let ac = new AudioContext()
  // let source = ac.createMediaElementSource(video)
  // let value = new
  // $: time = video.currentTime || 0
  // $: console.log(time)

  // $: console.log(videoTime)

  // function change() {
  //   console.log(duration, videoTime / 100)
  //   videoTime = duration * (videoTime / 100)
  // }

  let hover = false
  let time: string = "00:00"
  function move(e: any) {
    console.log(e.target)

    let percentage: number = e.offsetX / e.target.offsetWidth
    // console.log(e.offsetX, e.target.offsetWidth)
    console.log(percentage)

    if (percentage < 0) percentage = 0
    else if (percentage > 1) percentage = 1

    time = joinTime(secondsToTime(videoData.duration * percentage))
    sendToOutput()
  }

  const sendToOutput = () => window.api.send(OUTPUT, { channel: "VIDEO_DATA", data: videoData })
</script>

<!-- {#key time} -->
<!-- on:change={(e) => (videoData.time = e.target.value)} -->
<div class="main">
  {#if hover}
    <span>
      {time}
    </span>
  {:else}
    <span style="color: var(--secondary)">
      {joinTime(secondsToTime(videoData.time))}
    </span>
  {/if}
  <div class="slider" on:mouseenter={() => (hover = true)} on:mouseleave={() => (hover = false)}>
    <Slider bind:value={videoData.time} max={videoData.duration} on:mousemove={move} on:change={sendToOutput} />
  </div>
  {joinTime(secondsToTime(videoData.duration))}
</div>

<!-- {/key} -->
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
  }
</style>
