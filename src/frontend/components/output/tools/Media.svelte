<script lang="ts">
  import { OUTPUT } from "../../../../types/Channels"
  import { activeShow, dictionary, outBackground, outLocked, playerVideos, videoExtensions } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import Button from "../../inputs/Button.svelte"
  import VideoSlider from "../VideoSlider.svelte"

  export let video: any
  export let videoData: any
  export let videoTime: any
  export let title: any

  let mediaName: string = ""
  $: outName = $outBackground?.path ? $outBackground.path.substring($outBackground.path.lastIndexOf("\\") + 1) : ""
  $: mediaName = outName ? outName.slice(0, outName.lastIndexOf(".")) : $outBackground?.name || ""

  const sendToOutput = () => {
    // window.api.send(OUTPUT, { channel: "VIDEO_DATA", data: { ...videoData, time: videoTime } })
    window.api.send(OUTPUT, { channel: "VIDEO_DATA", data: videoData })
    window.api.send(OUTPUT, { channel: "VIDEO_TIME", data: videoTime })
  }

  function openPreview() {
    if (!$outBackground) return
    console.log($outBackground)
    activeShow.set({ id: ($outBackground.path || $outBackground.id)!, type: ($outBackground.type || "image") as any })
  }

  // auto clear video on finish
  $: if (videoTime && videoData.duration && !videoData.paused && videoTime >= videoData.duration && !videoData.loop) {
    outBackground.set(null)
    videoTime = 0
  }
</script>

{#if $outBackground?.type === "player"}
  <span class="name" on:click={openPreview}>
    <p>{title.length ? title : $playerVideos[$outBackground?.id || ""].name}</p>
  </span>
{:else}
  <span class="name" on:click={openPreview}>
    <p>{mediaName}</p>
  </span>
{/if}
{#if (video && $videoExtensions.includes((outName?.match(/\.[0-9a-z]+$/i)?.[0] || "").substring(1))) || $outBackground?.type === "player"}
  <span class="group">
    <Button
      style="flex: 0"
      center
      title={videoData.paused ? $dictionary.media?.play : $dictionary.media?.pause}
      disabled={$outLocked}
      on:click={() => {
        videoData.paused = !videoData.paused
        sendToOutput()
      }}
    >
      <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} size={1.2} />
    </Button>
    <VideoSlider disabled={$outLocked} bind:videoData bind:videoTime toOutput />
    <Button
      style="flex: 0"
      center
      title={videoData.muted ? $dictionary.actions?.unmute : $dictionary.actions?.mute}
      disabled={$outLocked}
      on:click={() => {
        videoData.muted = !videoData.muted
        sendToOutput()
      }}
    >
      <Icon id={videoData.muted ? "muted" : "volume"} white={videoData.muted} size={1.2} />
    </Button>
    <Button
      style="flex: 0"
      center
      title={$dictionary.media?._loop}
      on:click={() => {
        videoData.loop = !videoData.loop
        sendToOutput()
      }}
    >
      <Icon id="loop" white={!videoData.loop} size={1.2} />
    </Button>
  </span>
{:else}
  <!-- Image -->
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

    cursor: pointer;
  }

  .name:hover {
    background-color: var(--primary-darker);
  }
</style>
