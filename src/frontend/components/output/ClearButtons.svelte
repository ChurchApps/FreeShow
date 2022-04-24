<script lang="ts">
  import { OUTPUT } from "../../../types/Channels"
  import { dictionary, outAudio, outBackground, outLocked, outOverlays, outSlide, outTransition } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"

  $: allCleared = !$outBackground && !$outSlide && !$outOverlays.length && !$outAudio.length && !$outTransition

  export let autoChange: any
  export let activeClear: any
  export let video: any
  export let videoTime: number
  export let videoData: any

  function clearVideo() {
    videoData.paused = true
    window.api.send(OUTPUT, { channel: "VIDEO_DATA", data: videoData })
    window.api.send(OUTPUT, { channel: "VIDEO_TIME", data: videoTime })

    setTimeout(() => {
      if (videoData.paused) {
        video = null
        videoTime = 0
        videoData = {
          time: 0,
          duration: 0,
          paused: true,
          muted: false,
          loop: false,
        }
        window.api.send(OUTPUT, { channel: "VIDEO_DATA", data: videoData })
        window.api.send(OUTPUT, { channel: "VIDEO_TIME", data: videoTime })
      }
      // TODO: clear after transition out.....
    }, 500)
  }

  export let callClear: boolean = false
  $: if (callClear) {
    clearAll()
    callClear = false
  }

  const clearAll = () => {
    if ($outLocked) return

    clearVideo()
    outBackground.set(null)
    outSlide.set(null)
    outOverlays.set([])
    outAudio.set([])
    outTransition.set(null)
    allCleared = true
    autoChange = true
  }
</script>

<div class="clear" style="border-top: 2px solid var(--primary-lighter);">
  <span>
    <Button class="clearAll" disabled={$outLocked || allCleared} on:click={clearAll} title={$dictionary.clear?.all} red dark center>
      <Icon id="clear" size={1.2} />
      <span style="padding-left: 10px;"><T id={"clear.all"} /></span>
    </Button>
  </span>
  <span class="group">
    <Button
      disabled={($outLocked && activeClear === "background") || !$outBackground}
      on:click={() => {
        if (activeClear !== "background") {
          // previousActive = activeClear
          autoChange = false
          activeClear = "background"
        } else if (!$outLocked) {
          autoChange = true
          clearVideo()
          outBackground.set(null)
        }
      }}
      title={activeClear === "background" ? $dictionary.clear?.background : $dictionary.preview?.background}
      red={activeClear === "background"}
      dark
      center
    >
      <Icon id="background" size={1.2} />
    </Button>
    <Button
      disabled={($outLocked && activeClear === "slide") || !$outSlide}
      on:click={() => {
        if (activeClear !== "slide") {
          // previousActive = activeClear
          autoChange = false
          activeClear = "slide"
        } else if (!$outLocked) {
          autoChange = true
          outSlide.set(null)
        }
      }}
      title={activeClear === "slide" ? $dictionary.clear?.slide : $dictionary.preview?.slide}
      red={activeClear === "slide"}
      dark
      center
    >
      <Icon id="slide" size={1.2} />
    </Button>
    <Button
      disabled={($outLocked && activeClear === "overlays") || !$outOverlays.length}
      on:click={() => {
        if (activeClear !== "overlays") {
          // previousActive = activeClear
          autoChange = false
          activeClear = "overlays"
        } else if (!$outLocked) {
          autoChange = true
          outOverlays.set([])
        }
      }}
      title={activeClear === "overlays" ? $dictionary.clear?.overlays : $dictionary.preview?.overlays}
      red={activeClear === "overlays"}
      dark
      center
    >
      <Icon id="overlays" size={1.2} />
    </Button>
    <Button
      disabled={($outLocked && activeClear === "audio") || !$outAudio.length}
      on:click={() => {
        if (activeClear !== "audio") {
          // previousActive = activeClear
          autoChange = false
          activeClear = "audio"
        } else if (!$outLocked) {
          autoChange = true
          outAudio.set([])
        }
      }}
      title={activeClear === "audio" ? $dictionary.clear?.audio : $dictionary.preview?.audio}
      red={activeClear === "audio"}
      dark
      center
    >
      <Icon id="audio" size={1.2} />
    </Button>
    <Button
      disabled={($outLocked && activeClear === "nextTimer") || !$outTransition}
      on:click={() => {
        if (activeClear !== "nextTimer") {
          // previousActive = activeClear
          autoChange = false
          activeClear = "nextTimer"
        } else if (!$outLocked) {
          autoChange = true
          outTransition.set(null)
        }
      }}
      title={activeClear === "nextTimer" ? $dictionary.clear?.nextTimer : $dictionary.preview?.nextTimer}
      red={activeClear === "nextTimer"}
      dark
      center
    >
      <Icon id="clock" size={1.2} />
    </Button>
  </span>
</div>

<style>
  .clear {
    display: flex;
    flex-direction: column;
  }

  :global(.clearAll) {
    width: 100%;
  }

  .group {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }
  .group :global(button) {
    flex-grow: 1;
    /* height: 40px; */
  }
</style>
