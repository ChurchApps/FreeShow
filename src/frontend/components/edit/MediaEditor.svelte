<script lang="ts">
  import { activeEdit, activeShow } from "../../stores"
  import Media from "../media/Media.svelte"

  $: path = $activeEdit.id || $activeShow!.id

  let videoTime: number = 0
  let videoData = {
    paused: false,
    muted: true,
    duration: 0,
    loop: false,
  }

  let hasLoaded: boolean = false
  let autoPause: boolean = false

  function onLoad() {
    hasLoaded = true
    if (autoPause) videoData.paused = false
    else videoTime = 0
  }

  function onPlay() {
    autoPause = false
    if (hasLoaded) {
      videoTime = 0
      hasLoaded = false
    }
  }
</script>

<div class="parent" style="display: flex;flex-direction: column;height: 100%;">
  <div class="media" style="flex: 1;overflow: hidden;">
    <Media {path} bind:videoData bind:videoTime controls on:loaded={onLoad} on:playing={onPlay} />
  </div>
</div>

<style>
  .parent :global(.slider input) {
    background-color: var(--primary);
  }
</style>
