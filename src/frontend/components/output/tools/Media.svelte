<script lang="ts">
  import { OUTPUT } from "../../../../types/Channels"
  import { activeShow, dictionary, outLocked, playerVideos } from "../../../stores"
  import { send } from "../../../utils/request"
  import { splitPath } from "../../helpers/get"
  import Icon from "../../helpers/Icon.svelte"
  import { getMediaType } from "../../helpers/media"
  import { setOutput } from "../../helpers/output"
  import Button from "../../inputs/Button.svelte"
  import VideoSlider from "../VideoSlider.svelte"

  export let currentOutput: any
  export let outputId: string
  export let video: any
  export let videoData: any
  export let videoTime: any
  export let title: any

  $: background = currentOutput?.out?.background
  // $: if (!background) {
  //   let outs = getActiveOutputs().map((id) => $outputs[id])
  //   background = outs.find((output) => output.out?.background)?.out?.background
  // }

  let mediaName: string = ""
  $: outName = background?.path ? splitPath(background.path).name : ""
  $: mediaName = outName ? outName.slice(0, outName.lastIndexOf(".")) : background?.name || ""

  const sendToOutput = () => {
    // window.api.send(OUTPUT, { channel: "MAIN_VIDEO_DATA", data: { ...videoData, time: videoTime } })
    send(OUTPUT, ["UPDATE_VIDEO"], { id: outputId, data: videoData })
    // window.api.send(OUTPUT, { channel: "MAIN_VIDEO_DATA", data: videoData })
    // window.api.send(OUTPUT, { channel: "MAIN_VIDEO_TIME", data: videoTime })
  }

  function openPreview() {
    if (!background) return
    console.log(background)
    activeShow.set({ id: (background.path || background.id)!, type: (background.type || "image") as any })
  }

  // auto clear video on finish
  $: if (videoTime && videoData.duration && !videoData.paused && videoTime >= videoData.duration && !videoData.loop) {
    setOutput("background", null)
    videoTime = 0
    send(OUTPUT, ["UPDATE_VIDEO"], { id: outputId, time: 0 })
  }
</script>

{#if background}
  {#if background?.type === "player"}
    <span class="name" on:click={openPreview}>
      <p>{title?.length ? title : $playerVideos[background?.id || ""].name}</p>
    </span>
  {:else}
    <span class="name" on:click={openPreview}>
      <p>{mediaName}</p>
    </span>
  {/if}
  {#if (video && getMediaType((outName?.match(/\.[0-9a-z]+$/i)?.[0] || "").substring(1)) === "video") || background?.type === "player"}
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
      <VideoSlider disabled={$outLocked} {outputId} bind:videoData bind:videoTime toOutput />
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

    cursor: pointer;
  }

  .name:hover {
    background-color: var(--primary-darker);
  }
</style>
