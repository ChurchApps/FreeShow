<script lang="ts">
  import { audioSource, outBackground } from "../../stores"
  import { audioAnalyser } from "./audioAnalyser"

  export let video: any
  let audioChannels: any = { left: 0, right: 0 }

  // https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Basic_concepts_behind_Web_Audio_API
  // https://ui.dev/web-audio-api/

  $: if (!$outBackground && interval) {
    audioChannels = { left: 0, right: 0 }
    clearInterval(interval)
  }

  let interval: any = null
  $: {
    if (video !== null && $audioSource !== video) {
      audioSource.set(video)
      analyse()
    }
  }

  async function analyse() {
    // https://stackoverflow.com/questions/20769261/how-to-get-video-elements-current-level-of-loudness
    let ac = new AudioContext()
    let source = ac.createMediaElementSource(video)

    let analyser = ac.createAnalyser() //we create an analyser
    analyser.smoothingTimeConstant = 0.9
    analyser.fftSize = 512 //the total samples are half the fft size.

    source.connect(analyser)
    analyser.connect(ac.destination)

    if (interval) clearInterval(interval)
    interval = setInterval(() => {
      audioChannels = audioAnalyser(analyser)
    })
    console.log(audioChannels)
  }
</script>

<div class="main">
  <span class="left">
    <!-- <p>L</p> -->
    <div style="height: {100 - audioChannels.left}%" />
  </span>
  <span class="right">
    <!-- <p>R</p> -->
    <div style="height: {100 - audioChannels.right}%" />
  </span>
</div>

<style>
  .main {
    width: 15px;
    display: flex;
    border-left: 5px solid var(--primary-lighter);
  }

  span {
    background-image: linear-gradient(rgb(200, 0, 0) 1%, rgb(255, 220, 0) 16%, rgb(0, 220, 0) 45%, rgb(0, 120, 0) 100%);
    filter: hue-rotate(250deg);
    width: 50%;
  }

  span div {
    transition: height 0.08s ease 0s;
    background-color: var(--primary);
    width: 100%;
  }
</style>
