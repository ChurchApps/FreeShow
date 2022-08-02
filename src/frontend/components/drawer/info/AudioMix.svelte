<script lang="ts">
  import { playingAudio, volume } from "../../../stores"
  import { analyseAudio } from "../../helpers/audio"
  import T from "../../helpers/T.svelte"
  import Slider from "../../inputs/Slider.svelte"

  // TODO: video player volume

  // TODO: reduce volume on video/player too

  // let volume: number = 100

  function updateVolume(e: any) {
    volume.set(Number(Number(e.target.value).toFixed(2)))

    // update volume
    playingAudio.update((a) => {
      Object.keys(a).forEach((id) => {
        // a[id].volume = volume
        a[id].audio.volume = $volume
      })
      return a
    })
    if (volume) analyseAudio()
  }
</script>

<!-- TODO: effects?: https://alemangui.github.io/pizzicato/ -->

<main>
  <p><T id="media.volume" />: <span style="font-size: 1em;color: var(--secondary);">{($volume * 100).toFixed()}</span></p>
  <Slider value={$volume} step={0.01} max={1} on:input={updateVolume} />
</main>

<style>
  main {
    height: 98%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  p {
    text-align: center;
    font-weight: bold;
    font-size: 1.2em;
    padding: 10px;
  }

  main :global(input) {
    /* transform: rotate(270deg) translateX(-50%); */
    width: 90%;
    height: 20px;
  }

  main :global(input)::-webkit-slider-thumb {
    width: 25px;
    height: 25px;
    cursor: pointer;
  }

  main :global(input)::-webkit-slider-thumb:hover {
    width: 30px;
    height: 30px;
  }
</style>
