<script lang="ts">
  import type { OutBackground } from "../../../types/Show"
  import { activeProject, activeShow, dictionary, outBackground, outLocked, projects } from "../../stores"
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
  let filter: string = ""

  // activeShow.subscribe((a) => {
  //   if (a?.id) {
  //     videoTime = 0
  //     // TODO: back to beginning
  //     // if (!videoData.paused) {
  //     //   videoData.paused = true
  //     //   setTimeout(() => {
  //     //     videoTime = 0
  //     //     videoData.paused = false
  //     //   }, 50)
  //     // }
  //   }
  // })

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

  function onVideoClick(e: any) {
    if ($outLocked) return

    let bg: any = { type: show!.type, startAt: e.ctrlKey ? videoTime : 0 }

    if (show!.type === "player") bg.id = show!.id
    else {
      bg.path = show!.id
      // let data: any = setData()
      // bg = {...bg, ...data}
    }

    autoPause = true
    videoData.paused = true

    outBackground.set(bg)
  }

  // function setData() {
  //   let data = { muted: false, loop: false, filter: "" }
  //   if (!$activeProject || $activeShow?.index === undefined) return data

  //   data.muted = $projects[$activeProject].shows[$activeShow.index].muted || false
  //   data.loop = $projects[$activeProject].shows[$activeShow.index].loop || false
  //   if (filter) data.filter = filter
  //   return data
  // }

  $: {
    if ($activeProject && $activeShow?.index !== undefined && $projects[$activeProject].shows[$activeShow.index]?.filter) {
      let style = ""
      Object.entries($projects[$activeProject].shows[$activeShow.index].filter!).forEach(([id, a]: any) => (style += ` ${id}(${a})`))
      filter = style
    } else filter = ""
  }
</script>

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
                  <Player id={show.id} bind:videoData bind:videoTime />
                {:else}
                  <video
                    style="width: 100%;height: 100%;filter: {filter};"
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
              <Button style="flex: 0" center title={videoData.paused ? "Play" : "Paused"} on:click={() => (videoData.paused = !videoData.paused)}>
                <Icon id={videoData.paused ? "play" : "pause"} size={1.2} />
              </Button>
              <VideoSlider bind:videoData bind:videoTime />
              <Button style="flex: 0" center title={videoData.muted ? "Unmute" : "Mute"} on:click={() => (videoData.muted = !videoData.muted)}>
                <Icon id={videoData.muted ? "muted" : "volume"} size={1.2} />
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
