<script lang="ts">
  import { dictionary } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import Button from "../inputs/Button.svelte"
  import VideoSlider from "../output/VideoSlider.svelte"

  export let videoData: any
  export let videoTime: number
</script>

<div class="buttons" style="display: flex;">
  <Button style="flex: 0" center title={videoData.paused ? $dictionary.media?.play : $dictionary.media?.pause} on:click={() => (videoData.paused = !videoData.paused)}>
    <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} size={1.2} />
  </Button>
  <VideoSlider bind:videoData bind:videoTime />
  <Button style="flex: 0" center title={videoData.muted ? $dictionary.actions?.unmute : $dictionary.actions?.mute} on:click={() => (videoData.muted = !videoData.muted)}>
    <Icon id={videoData.muted ? "muted" : "volume"} white={videoData.muted} size={1.2} />
  </Button>
</div>
