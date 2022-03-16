<script lang="ts">
  import { OUTPUT } from "../../../types/Channels"
  import { dictionary, outAudio, outBackground, outLocked, outOverlays, outSlide, outTransition } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"

  $: out = $outBackground === null && $outSlide === null && !$outOverlays.length && !$outAudio.length ? false : true

  export let autoChange: any
  export let activeClear: any
  export let video: any
  export let videoTime: number
  export let videoData: any

  function clearVideo() {
    // TODO: clear after fade out.....
    setTimeout(() => {
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
    }, 600)
  }

  export let callClear: boolean = false
  $: if (callClear) clearAll()

  const clearAll = () => {
    if ($outLocked) return

    outBackground.set(null)
    outSlide.set(null)
    outOverlays.set([])
    outAudio.set([])
    outTransition.set(null)
    clearVideo()
    autoChange = true
  }
</script>

<div class="clear" style="border-top: 2px solid var(--primary-lighter);">
  <span>
    <Button class="clearAll" disabled={$outLocked || !out} on:click={clearAll} title={$dictionary.clear?.all} red dark center>
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
          outBackground.set(null)
          clearVideo()
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
      disabled={($outLocked && activeClear === "transition") || !$outTransition}
      on:click={() => {
        if (activeClear !== "transition") {
          // previousActive = activeClear
          autoChange = false
          activeClear = "transition"
        } else if (!$outLocked) {
          autoChange = true
          outTransition.set(null)
        }
      }}
      title={activeClear === "transition" ? $dictionary.clear?.transition : $dictionary.preview?.transition}
      red={activeClear === "transition"}
      dark
      center
    >
      <Icon id="transition" size={1.2} />
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
