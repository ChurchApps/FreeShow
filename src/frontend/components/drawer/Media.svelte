<script lang="ts">
  import { mediaFolders, outBackground } from "../../stores"
  import Card from "./Card.svelte"
  import Label from "./Label.svelte"

  export let id: string
  export let name: string
  let url: string = $mediaFolders[id].url + "/" + name
  let extension: string = url.match(/\.[0-9a-z]+$/i)?.[0]!
  $: video = extension.includes("mp4") || extension.includes("mov")
  $: {
    if (video) loaded = false
  }

  $: active = $outBackground?.id === id && $outBackground?.name === name

  let hover: boolean = false

  let canvas: any
  let videoElem: any
  let duration: number = 0

  let loaded = true
  let time = false
  function ready() {
    if (!loaded && videoElem) {
      if (!time) {
        duration = videoElem.duration
        videoElem.currentTime = duration / 2
        time = true
      } else {
        canvas.width = videoElem.offsetWidth
        canvas.height = videoElem.offsetHeight
        canvas.getContext("2d").drawImage(videoElem, 0, 0, videoElem.offsetWidth, videoElem.offsetHeight)
        loaded = true
      }
    }
  }

  function setBackground() {
    outBackground.set({ id, name })
  }

  function move(e: any) {
    if (loaded && videoElem) {
      let percentage: number = e.offsetX / e.target.offsetWidth
      let steps: number = 10

      // let time = duration * percentage
      let time = duration * ((Math.floor(percentage * steps) * steps + steps) / 100)
      videoElem.currentTime = time
    }
  }
</script>

<Card {loaded} {active} on:click={setBackground} on:mouseenter={() => (hover = true)} on:mouseleave={() => (hover = false)} on:mousemove={move}>
  {#if video}
    <canvas bind:this={canvas} />
    {#if !loaded || hover}
      <video bind:this={videoElem} src={url} on:canplaythrough={ready}>
        <track kind="captions" />
      </video>
    {/if}
  {:else}
    <img src={url} alt={name} />
  {/if}
  <Label label={name} icon={video ? "movie" : "image"} white={!video} />
</Card>

<style>
  video {
    /* TODO: fix positioning */
    position: absolute;
  }
</style>
