<script lang="ts">
  import { activeProject, activeShow, dictionary, media, outLocked, outputs, playingVideos, projects, volume } from "../../stores"
  import Image from "../drawer/media/Image.svelte"
  import { analyseAudio, getAnalyser } from "../helpers/audio"
  import Icon from "../helpers/Icon.svelte"
  import { getActiveOutputs, setOutput } from "../helpers/output"
  import Button from "../inputs/Button.svelte"
  import HoverButton from "../inputs/HoverButton.svelte"
  import Splash from "../main/Splash.svelte"
  import VideoSlider from "../output/VideoSlider.svelte"
  import Layouts from "../slide/Layouts.svelte"
  import Player from "../system/Player.svelte"
  import AudioPreview from "./AudioPreview.svelte"
  import Section from "./Section.svelte"
  import Slides from "./Slides.svelte"

  $: show = $activeShow

  let videoTime: number = 0
  let videoData = {
    paused: false,
    muted: true,
    duration: 0,
    loop: false,
  }
  $: if (!videoData) videoData = { paused: false, muted: true, duration: 0, loop: false }

  let hasLoaded: boolean = false
  let autoPause: boolean = true

  let prevId: string | undefined = show?.id
  $: if (show?.id !== prevId) {
    videoTime = 0
    autoPause = true
    prevId = show?.id
  }

  $: currentOutput = $outputs[getActiveOutputs()[0]]

  // outBackground.subscribe(backgroundChanged)
  $: background = currentOutput?.out?.background || {}
  $: if (JSON.stringify(background) !== JSON.stringify(currentOutput?.out?.background || {})) backgroundChanged()
  function backgroundChanged() {
    background = currentOutput?.out?.background || {}
    if (background === null || background.path !== show?.id || videoData.paused) return
    if (background.type !== undefined || background.type !== "media") return
    autoPause = true
    videoData.paused = true
  }

  function onLoad() {
    hasLoaded = true
    if (autoPause) videoData.paused = false
    else videoTime = 0
  }

  let video: any
  async function onPlay() {
    // autoPause = false
    if (hasLoaded) {
      videoTime = 0
      hasLoaded = false

      let analyser = await getAnalyser(video)
      playingVideos.update((a) => {
        a.push({ id: show!.id, location: "preview", analyser })
        return a
      })
      analyseAudio()
    }
  }
  $: if (videoData) {
    playingVideos.update((a) => {
      let existing = a.findIndex((a) => a.id === show?.id && a.location === "preview")
      if (existing > -1) {
        a[existing].paused = videoData.muted ? true : videoData.paused
        if (!a[existing].paused) analyseAudio()
      }
      return a
    })
  }

  function keydown(e: any) {
    if (e.target.closest("input") || e.target.closest(".edit")) return
    if (e.key === " " && show) {
      e.preventDefault()
      if ((show!.type === "video" && getActiveOutputs()[0].out?.background?.path !== show.id) || (show!.type === "player" && getActiveOutputs()[0].out?.background?.id !== show.id))
        onVideoClick(e)
      else if (show!.type === "image" && !$outLocked) setOutput("background", { path: show?.id, filter })
    }
  }

  function onVideoClick(e: any) {
    if ($outLocked) return

    let bg: any = { type: show!.type, startAt: e.ctrlKey || e.metaKey ? videoTime : 0, loop: false, filter, flipped, fit }

    if (show!.type === "player") bg.id = show!.id
    else {
      bg.path = show!.id
      // if (filter) data.filter = filter
    }

    // autoPause = true
    // videoData.paused = true

    if ($activeProject && $projects[$activeProject].shows.find((a) => a.id === bg.path)) setOutput("slide", null)
    setOutput("background", bg)
  }

  $: if (background.path === show?.id && autoPause) videoData.paused = true

  let filter = ""
  let flipped = false
  let fit = "contain"

  $: if (show) {
    filter = $media[show.id]?.filter || ""
    flipped = $media[show.id]?.flipped || false
    fit = $media[show.id]?.fit || "contain"
  }
</script>

<svelte:window on:keydown={keydown} />

<div class="main">
  {#if show}
    {#if show.type === "video" || show.type === "image" || show.type === "player"}
      <div style="display: flex;flex-direction: column;height: 100%;">
        {#if show.type === "video" || show.type === "player"}
          {#key show.id}
            <div class="media context #media_preview" style="flex: 1;overflow: hidden;">
              <!-- TODO: info about: CTRL click to play at current pos -->
              <HoverButton icon="play" size={10} on:click={onVideoClick} title={$dictionary.media?.play}>
                {#if show.type === "player"}
                  <Player id={show.id} bind:videoData bind:videoTime preview />
                {:else}
                  <!-- TODO: on:error={videoError} - ERR_FILE_NOT_FOUND -->
                  <video
                    style="width: 100%;height: 100%;filter: {filter};{flipped ? 'transform: scaleX(-1);' : ''}"
                    src={show.id}
                    on:loadedmetadata={onLoad}
                    on:playing={onPlay}
                    bind:this={video}
                    bind:currentTime={videoTime}
                    bind:paused={videoData.paused}
                    bind:duration={videoData.duration}
                    bind:muted={videoData.muted}
                    bind:volume={$volume}
                  >
                    <track kind="captions" />
                  </video>
                {/if}
              </HoverButton>
            </div>
            <div class="buttons" style="display: flex;">
              <Button
                style="flex: 0"
                center
                title={videoData.paused ? $dictionary.media?.play : $dictionary.media?.pause}
                on:click={() => {
                  autoPause = false
                  videoData.paused = !videoData.paused
                }}
              >
                <Icon id={videoData.paused ? "play" : "pause"} white={videoData.paused} size={1.2} />
              </Button>
              <VideoSlider bind:videoData bind:videoTime />
              <Button
                style="flex: 0"
                center
                title={videoData.muted ? $dictionary.actions?.unmute : $dictionary.actions?.mute}
                on:click={() => (videoData.muted = !videoData.muted)}
              >
                <Icon id={videoData.muted ? "muted" : "volume"} white={videoData.muted} size={1.2} />
              </Button>
            </div>
          {/key}
        {:else}
          <div class="media context #media_preview" style="flex: 1;overflow: hidden;">
            <HoverButton
              icon="play"
              size={10}
              on:click={() => {
                if (!$outLocked) setOutput("background", { path: show?.id, filter, flipped, fit })
              }}
              title={$dictionary.media?.show}
            >
              <Image
                style="width: 100%;height: 100%;object-fit: contain;filter: {filter};{flipped ? 'transform: scaleX(-1);' : ''};object-fit: {fit}"
                src={show.id}
                alt={show.name || ""}
              />
            </HoverButton>
          </div>
        {/if}
      </div>
    {:else if show.type === "audio"}
      <AudioPreview />
    {:else if show.type === "section"}
      <Section section={show} />
    {:else}
      <Slides />
      <Layouts />
    {/if}
  {:else}
    <Splash />
  {/if}
</div>

<style>
  .main {
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .buttons :global(.slider input) {
    background-color: var(--primary);
  }
</style>
