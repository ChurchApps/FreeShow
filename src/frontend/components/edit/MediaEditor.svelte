<script lang="ts">
  import { activeEdit, activeShow, dictionary, imageExtensions, media } from "../../stores"
  import Image from "../drawer/media/Image.svelte"
  import Icon from "../helpers/Icon.svelte"
  import Button from "../inputs/Button.svelte"
  import VideoSlider from "../output/VideoSlider.svelte"

  $: currentId = $activeEdit.id || $activeShow!.id
  $: type = $imageExtensions.includes(currentId.slice(currentId.lastIndexOf(".") + 1, currentId.length)) ? "image" : "video"

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

  // let width: number = 0
  // let height: number = 0
  // let resolution: Resolution = $screen.resolution

  let filter = ""

  $: {
    if ($media[currentId]) {
      let style = ""
      Object.entries($media[currentId].filter).forEach(([id, a]: any) => (style += ` ${id}(${a})`))
      filter = style
    } else filter = ""
  }

  $: flipped = $media[currentId]?.flipped
</script>

<!-- bind:offsetWidth={width} bind:offsetHeight={height} -->
<div class="parent" style="display: flex;flex-direction: column;height: 100%;">
  {#if type === "video"}
    {#key currentId}
      <div class="media" style="flex: 1;overflow: hidden;">
        <video
          style="width: 100%;height: 100%;filter: {filter};{flipped ? 'transform: scaleX(-1);' : ''}"
          src={currentId}
          on:loadedmetadata={onLoad}
          on:playing={onPlay}
          bind:currentTime={videoTime}
          bind:paused={videoData.paused}
          bind:duration={videoData.duration}
          bind:muted={videoData.muted}
        >
          <track kind="captions" />
        </video>
      </div>
      <div class="buttons" style="display: flex;">
        <Button style="flex: 0" center title={videoData.paused ? $dictionary.media?.play : $dictionary.media?.pause} on:click={() => (videoData.paused = !videoData.paused)}>
          <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} size={1.2} />
        </Button>
        <VideoSlider bind:videoData bind:videoTime />
        <Button style="flex: 0" center title={videoData.muted ? $dictionary.actions?.unmute : $dictionary.actions?.mute} on:click={() => (videoData.muted = !videoData.muted)}>
          <Icon id={videoData.muted ? "muted" : "volume"} white={videoData.muted} size={1.2} />
        </Button>
      </div>
    {/key}
  {:else}
    <div class="media" style="flex: 1;overflow: hidden;">
      <Image style="width: 100%;height: 100%;object-fit: contain;filter: {filter};{flipped ? 'transform: scaleX(-1);' : ''}" src={currentId} alt={currentId || ""} />
    </div>
  {/if}
</div>

<style>
  /* .main {
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  } */
  /* .parent {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px;
    overflow: auto;
  } */

  .parent :global(.slider input) {
    background-color: var(--primary);
  }
</style>
