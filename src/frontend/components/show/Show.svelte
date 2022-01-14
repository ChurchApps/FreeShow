<script lang="ts">
  import { activeProject, activeShow, outBackground, projects } from "../../stores"
  import Layouts from "../slide/Layouts.svelte"
  import Slides from "./Slides.svelte"
  import Splash from "../main/Splash.svelte"
  import Button from "../inputs/Button.svelte"
  import Icon from "../helpers/Icon.svelte"
  import VideoSlider from "../output/VideoSlider.svelte"
  import Image from "../drawer/media/Image.svelte"
  import HoverButton from "../inputs/HoverButton.svelte"

  $: show = $activeShow

  let videoData = {
    paused: false,
    muted: true,
    duration: 0,
  }
  let videoTime: number = 0
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

  let autoPause: boolean = false
  outBackground.subscribe((a) => {
    if (a && a.path === show?.id && (a.type === undefined || a.type === "media") && !videoData.paused) {
      autoPause = true
      videoData.paused = true
    }
  })

  let hasLoaded: boolean = false
  function loaded() {
    hasLoaded = true
    if (autoPause) videoData.paused = false
    else videoTime = 0
  }
  function playing() {
    autoPause = false
    if (hasLoaded) {
      videoTime = 0
      hasLoaded = false
    }
  }

  function videoClick(e: any) {
    let data: any = { muted: false, loop: false, filter: "" }
    if ($activeProject && $activeShow!.index !== undefined) {
      data.muted = $projects[$activeProject].shows[$activeShow!.index!].muted || false
      data.loop = $projects[$activeProject].shows[$activeShow!.index!].loop || false
      if (filter) data.filter = filter
    }

    if (e.ctrlKey) outBackground.set({ path: show?.id, startAt: videoTime, ...data })
    else outBackground.set({ path: show?.id, ...data })
  }

  let filter: string = ""
  $: {
    if ($activeProject && $activeShow?.index !== undefined && $projects[$activeProject].shows[$activeShow.index].filter) {
      let style = ""
      console.log($projects[$activeProject].shows[$activeShow.index].filter)
      Object.entries($projects[$activeProject].shows[$activeShow.index].filter!).forEach(([id, a]: any) => {
        style += ` ${id}(${a})`
      })
      filter = style
    } else filter = ""
  }
</script>

<div class="main">
  {#if show}
    {#if show.type === "video" || show.type === "image"}
      <div style="display: flex;flex-direction: column;height: 100%;">
        {#if show.type === "video"}
          {#key show.id}
            <div class="media" style="flex: 1;overflow: hidden;">
              <HoverButton icon="play" size={10} on:click={videoClick} title="[[[Play video output..., ctrlclick to start at current pos]]]">
                <video
                  style="width: 100%;height: 100%;filter: {filter};"
                  src={show.id}
                  on:loadedmetadata={loaded}
                  on:playing={playing}
                  bind:currentTime={videoTime}
                  bind:paused={videoData.paused}
                  bind:duration={videoData.duration}
                  bind:muted={videoData.muted}
                >
                  <track kind="captions" />
                </video>
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
            <HoverButton icon="play" size={10} on:click={() => outBackground.set({ path: show?.id, filter })} title="[[[Play image output...]]]">
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
