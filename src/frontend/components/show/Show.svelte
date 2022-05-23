<script lang="ts">
  import type { OutBackground } from "../../../types/Show"
  import { activeProject, activeShow, dictionary, media, outBackground, outLocked, outSlide, projects } from "../../stores"
  import Image from "../drawer/media/Image.svelte"
  import Icon from "../helpers/Icon.svelte"
  import Button from "../inputs/Button.svelte"
  import HoverButton from "../inputs/HoverButton.svelte"
  import Splash from "../main/Splash.svelte"
  import VideoSlider from "../output/VideoSlider.svelte"
  import Layouts from "../slide/Layouts.svelte"
  import Player from "../system/Player.svelte"
  import Slides from "./Slides.svelte"

  $: show = $activeShow

  let videoTime: number = 0
  let videoData = {
    paused: false,
    muted: true,
    duration: 0,
    loop: false,
  }

  let hasLoaded: boolean = false
  let autoPause: boolean = false

  outBackground.subscribe(backgroundChanged)
  function backgroundChanged(a: null | OutBackground) {
    if (a === null || a.path !== show?.id || videoData.paused) return
    if (a.type !== undefined || a.type !== "media") return
    autoPause = true
    videoData.paused = true
  }

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

  function keydown(e: any) {
    if (e.target.closest("input") || e.target.closest(".edit")) return
    if (e.key === " " && show) {
      e.preventDefault()
      if ((show!.type === "video" && $outBackground?.path !== show.id) || (show!.type === "player" && $outBackground?.id !== show.id)) onVideoClick(e)
      else if (show!.type === "image" && !$outLocked) outBackground.set({ path: show?.id, filter })
    }
  }

  function onVideoClick(e: any) {
    if ($outLocked) return

    let bg: any = { type: show!.type, startAt: e.ctrlKey || e.metaKey ? videoTime : 0, loop: false, filter, flipped }

    if (show!.type === "player") bg.id = show!.id
    else {
      bg.path = show!.id
      // if (filter) data.filter = filter
    }

    autoPause = true
    videoData.paused = true

    if ($activeProject && $projects[$activeProject].shows.find((a) => a.id === bg.path)) outSlide.set(null)
    outBackground.set(bg)
  }

  let filter = ""
  let flipped = false

  // $: {
  //   if ($activeProject && $activeShow?.index !== undefined && $projects[$activeProject].shows[$activeShow.index]?.filter) {
  //     let style = ""
  //     Object.entries($projects[$activeProject].shows[$activeShow.index].filter!).forEach(([id, a]: any) => (style += ` ${id}(${a})`))
  //     filter = style
  //   } else filter = ""
  // }
  $: {
    if (show && $media[show.id]) {
      let style = ""
      Object.entries($media[show.id].filter).forEach(([id, a]: any) => (style += ` ${id}(${a})`))
      filter = style
      flipped = $media[show.id].flipped || false
    } else {
      filter = ""
      flipped = false
    }
  }
</script>

<svelte:window on:keydown={keydown} />

<div class="main">
  {#if show}
    {#if show.type === "video" || show.type === "image" || show.type === "player"}
      <div style="display: flex;flex-direction: column;height: 100%;">
        {#if show.type === "video" || show.type === "player"}
          {#key show.id}
            <div class="media" style="flex: 1;overflow: hidden;">
              <!-- TODO: info about: CTRL click to play at current pos -->
              <HoverButton icon="play" size={10} on:click={onVideoClick} title={$dictionary.media?.play}>
                {#if show.type === "player"}
                  <Player id={show.id} bind:videoData bind:videoTime preview />
                {:else}
                  <video
                    style="width: 100%;height: 100%;filter: {filter};{flipped ? 'transform: scaleX(-1);' : ''}"
                    src={show.id}
                    on:loadedmetadata={onLoad}
                    on:playing={onPlay}
                    bind:currentTime={videoTime}
                    bind:paused={videoData.paused}
                    bind:duration={videoData.duration}
                    bind:muted={videoData.muted}
                  >
                    <track kind="captions" />
                  </video>
                {/if}
              </HoverButton>
            </div>
            <div class="buttons" style="display: flex;">
              <Button style="flex: 0" center title={videoData.paused ? $dictionary.media?.play : $dictionary.media?.pause} on:click={() => (videoData.paused = !videoData.paused)}>
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
          <div class="media" style="flex: 1;overflow: hidden;">
            <HoverButton
              icon="play"
              size={10}
              on:click={() => {
                if (!$outLocked) outBackground.set({ path: show?.id, filter })
              }}
              title={$dictionary.media?.show}
            >
              <Image style="width: 100%;height: 100%;object-fit: contain;filter: {filter};" src={show.id} alt={show.name || ""} />
            </HoverButton>
          </div>
        {/if}
      </div>
    {:else if show.type === "audio"}
      <!--  -->
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
    justify-content: space-between;
  }

  .buttons :global(.slider input) {
    background-color: var(--primary);
  }
</style>
