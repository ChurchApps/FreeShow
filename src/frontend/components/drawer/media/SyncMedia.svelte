<script lang="ts">
  import type { MediaFit } from "../../../../types/Main"
  import { outputs } from "../../../stores"
  import { getResolution } from "../../helpers/output"
  import Loader from "../../main/Loader.svelte"

  export let name: any = ""
  export let path: string
  export let cameraGroup: string = ""
  export let filter: any = ""
  export let flipped: boolean = false
  export let fit: MediaFit = "contain"
  export let type: null | "media" | "image" | "video" | "camera" | "screen" | "audio" = null
  export let hover: boolean = false
  export let loaded: boolean = type === "image"
  export let duration: number = 0
  export let videoElem: any = null

  console.log(name, cameraGroup, filter, flipped, fit, hover, duration, videoElem)

  const preload = async (src: any): Promise<any> => {
    const resp = await fetch(src)
    const blob = await resp.blob()

    return new Promise((resolve, reject) => {
      let reader = new FileReader()
      reader.readAsDataURL(blob)
      reader.onload = () => {
        loaded = true
        resolve(reader.result)
      }
      reader.onerror = (error: any) => reject("Error: " + error)
    })
  }

  // let width: number = 0
  // let height: number = 0
  $: resolution = getResolution(null, $outputs)
</script>

<!-- bind:offsetWidth={width} bind:offsetHeight={height} -->
<div class="main" style="aspect-ratio: {resolution.width}/{resolution.height};">
  {#await preload(path)}
    <Loader />
  {:then base64}
    <img src={base64} alt="" />
  {/await}
</div>

<style>
  .main {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
