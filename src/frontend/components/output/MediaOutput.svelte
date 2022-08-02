<script lang="ts">
  import { linear } from "svelte/easing"
  import { OUTPUT } from "../../../types/Channels"
  import type { Transition, TransitionType } from "../../../types/Show"
  import { audioChannels, currentWindow, mediaFolders, outBackground, playingVideos, videoExtensions, volume } from "../../stores"
  import { send } from "../../utils/request"
  import { easings, transitions } from "../../utils/transitions"
  import { analyseAudio, getAnalyser } from "../helpers/audio"
  import { getStyleResolution } from "../slide/getStyleResolution"
  import Player from "../system/Player.svelte"
  import Camera from "./Camera.svelte"
  import Window from "./Window.svelte"

  export let transition: Transition
  export let path: string = ""
  export let id: string = ""
  export let name: string = ""
  export let type: string = "media"
  export let startAt: number = 0
  export let video: any
  export let videoData: any
  export let videoTime: any
  export let title: string
  export let mirror: boolean = false

  $: if (type === "video" || type === "image" || type === undefined) type = "media"
  $: if (type === "media" && !path.length) path = $mediaFolders[id].path + "/" + name || ""
  $: extension = path?.match(/\.[0-9a-z]+$/i)?.[0]! || ""
  $: isVideo = extension ? $videoExtensions.includes(extension.substring(1)) : false

  // $: if ($outputWindow && !videoData.muted) videoData.muted = $outputWindow
  let alt = "Could not find image!"

  let width: number = 0
  let height: number = 0
  let filter: string = ""
  let flipped: boolean = false

  let hasLoaded: boolean = false
  let autoMute: boolean = false
  function loaded() {
    if ($currentWindow) return

    console.log("LOADED")
    hasLoaded = true

    if ($outBackground?.muted !== undefined && !mirror) videoData.muted = $outBackground.muted
    if ($outBackground?.loop !== undefined) videoData.loop = $outBackground.loop
    // if ($outBackground?.filter !== undefined) filter = $outBackground.filter
    else if (!mirror) videoData.muted = false

    if (!videoData.muted) autoMute = videoData.muted = true
  }

  function playing() {
    if (!hasLoaded || $currentWindow) return

    console.log("PLAYING")
    videoData.paused = true
    setTimeout(() => {
      videoTime = startAt || 0
      if (!mirror) {
        window.api.send(OUTPUT, { channel: "VIDEO_TIME", data: videoTime })
        setTimeout(() => window.api.send(OUTPUT, { channel: "VIDEO_TIME", data: videoTime }), 100)

        // TODO: draw get time
        // sendCurrentTime()
      }

      if (autoMute && !mirror) {
        autoMute = false
        videoData.muted = false
      }
      videoData.paused = false
      startAt = 0
    }, 50)
    hasLoaded = false
  }

  // let timeout: any = null
  // function sendCurrentTime() {
  //   if (timeout) clearTimeout()
  //   timeout = setTimeout(() => {
  //     if (!videoData.paused) window.api.send(OUTPUT, { channel: "VIDEO_TIME", data: videoTime })
  //     sendCurrentTime()
  //   }, 1000)
  // }

  $: console.log(mirror, videoData.muted)

  function updateFilter() {
    let temp: any = { ...$outBackground }
    filter = ""
    // if (temp.filter !== undefined && temp.filter.length) {
    filter = temp.filter
    //   delete temp.filter
    // }
    // if (temp.flipped !== undefined) {
    flipped = temp.flipped
    //   delete temp.flipped
    // }
  }

  $: if ($outBackground !== null) updateFilter()
  $: if ($outBackground?.type === "video") setUpdater()
  // let bg: any = null
  let oldFilter: string = ""
  setUpdater()
  function setUpdater() {
    if (oldFilter === filter) videoTime = 0
    else oldFilter = filter
  }

  function custom(node: any, { type = "fade", duration = 500, easing = "linear" }: any) {
    return { ...transitions[type as TransitionType](node), duration: type === "none" ? 0 : duration, easing: easings.find((a) => a.id === easing).data || linear }
  }

  // AUDIO ANALYZER

  // let audioChannels: any = { left: 0, right: 0 }

  // https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Basic_concepts_behind_Web_Audio_API
  // https://ui.dev/web-audio-api/

  // $: if (($outBackground?.type !== "video" || videoData.paused) && !mirror) {
  //   audioChannels.set({ left: 0, right: 0 })
  //   send(OUTPUT, ["AUDIO_MAIN"], { id: path, channels: $audioChannels })
  // }
  // $: if ($outBackground?.type !== "video" && $currentWindow === "output") playingVideos.set([])

  // let interval: any = null
  // $: if (!videoData.paused && video !== null && $currentWindow === "output") analyseVideo()

  // only output window
  let currentAnalysedElem: any = null
  let currentAnalyser: any = null
  async function analyseVideo() {
    // if ($playingVideos[0]?.video === video) return
    // Failed to execute 'createMediaElementSource' on 'AudioContext': HTMLMediaElement already connected previously to a different MediaElementSourceNode.
    if (currentAnalysedElem !== video) {
      currentAnalyser = await getAnalyser(video)
      currentAnalysedElem = video
    }
    playingVideos.set([{ analyser: currentAnalyser }])
    analyseAudio()
  }

  $: if ($currentWindow === "output" && $audioChannels) send(OUTPUT, ["AUDIO_MAIN"], { id: path, channels: $audioChannels })
  $: if ($currentWindow === "output" && (video === null || videoData.paused === true)) playingVideos.set([])
  $: if ($currentWindow === "output" && video !== null && videoData.paused === false) analyseVideo()

  // $: if ($currentWindow === "output" && $audioChannels) send(OUTPUT, ["AUDIO_MAIN"], { id: path, channels: $audioChannels })
  // $: if ($currentWindow === "output" && videoData && $playingVideos.length) {
  //   let analyser = $playingVideos[0]
  //   playingVideos.set([{ analyser, paused: videoData.paused }])
  //   analyseAudio()
  // }
  // $: if ($currentWindow === "output" && video === null) playingVideos.set([])

  // let analyser: any = null
  // $: if (!videoData.paused && analyser) startInterval()

  // function startInterval() {
  //   interval = setInterval(() => {
  //     audioChannels = audioAnalyser(analyser)
  //     send(OUTPUT, ["AUDIO_MAIN"], { id: path, channels: audioChannels })
  //   }, 100)
  // }
</script>

<!-- TODO: display image stretch / scale -->
{#if type === "media"}
  {#if isVideo}
    <div transition:custom={transition} bind:clientWidth={width} bind:clientHeight={height}>
      <video
        class="media"
        style="{getStyleResolution({ width: video?.videoWidth || 0, height: video?.videoHeight || 0 }, width, height, 'cover')};filter: {filter};{flipped
          ? 'transform: scaleX(-1);'
          : ''}"
        bind:this={video}
        on:loadedmetadata={loaded}
        on:playing={playing}
        bind:currentTime={videoTime}
        bind:paused={videoData.paused}
        bind:duration={videoData.duration}
        bind:volume={$volume}
        muted={$currentWindow !== "output" ? true : videoData.muted}
        src={path}
        autoplay
        loop={videoData.loop || false}
      >
        <track kind="captions" />
      </video>
    </div>
  {:else}
    {#key path}
      <div transition:custom={transition}>
        <!-- style={getStyleResolution({ width: image?.naturalWidth || 0, height: image?.naturalHeight || 0 }, width, height, "cover")} -->
        <img class="media" style="object-fit: contain;width: 100%;height: 100%;filter: {filter};{flipped ? 'transform: scaleX(-1);' : ''}" src={path} {alt} draggable="false" />
      </div>
    {/key}
  {/if}
{:else if type === "screen"}
  {#key id}
    <div transition:custom={transition} bind:clientWidth={width} bind:clientHeight={height}>
      <Window {id} class="media" style="{getStyleResolution({ width: video?.videoWidth || 0, height: video?.videoHeight || 0 }, width, height, 'cover')};" />
    </div>
  {/key}
{:else if type === "camera"}
  {#key id}
    <div transition:custom={transition} bind:clientWidth={width} bind:clientHeight={height}>
      <Camera {id} class="media" style="{getStyleResolution({ width: video?.videoWidth || 0, height: video?.videoHeight || 0 }, width, height, 'cover')};" bind:videoElem={video} />
    </div>
  {/key}
{:else if type === "player"}
  {#key id}
    <div transition:custom={transition}>
      <!-- remove when finished -->
      <!-- TODO: this has to be disabled to get rid of ads! -->
      {#if !$currentWindow}
        <div class="overlay" />
      {/if}
      <Player {id} bind:videoData bind:videoTime bind:title {startAt} />
    </div>
  {/key}
{/if}

<style>
  /* hide alt text */
  img {
    text-indent: 100%;
    white-space: nowrap;
    overflow: hidden;
  }

  div {
    /* position: relative; */
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  div :global(.media) {
    max-width: 100%;
    max-height: 100%;
  }

  .overlay {
    position: absolute;
    width: 100%;
    height: 100%;
    background-color: transparent;
    z-index: 1;
  }
</style>
