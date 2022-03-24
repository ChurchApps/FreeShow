<script lang="ts">
  import { activeShow, mediaOptions, outBackground, outLocked } from "../../../stores"
  import SelectElem from "../../system/SelectElem.svelte"
  import Card from "../Card.svelte"
  import IntersectionObserver from "./IntersectionObserver.svelte"
  import MediaLoader from "./MediaLoader.svelte"

  export let name: string
  export let path: string
  export let type: any
  $: name = name.slice(0, name.lastIndexOf("."))

  export let activeFile: null | number
  export let allFiles: string[]

  let loaded: boolean = type === "image"
  let videoElem: any
  let hover: boolean = false
  let duration: number = 0

  function move(e: any) {
    if (loaded && videoElem) {
      let percentage: number = e.offsetX / e.target.offsetWidth
      let steps: number = 10

      let time = duration * ((Math.floor(percentage * steps) * steps + steps) / 100)
      if (Number(time) === time) videoElem.currentTime = time
    }
  }

  let index: number = allFiles.findIndex((a) => a === path)

  function click(e: any) {
    if (!e.ctrlKey && !e.metaKey) activeFile = index
  }
  $: if (activeFile !== null && allFiles[activeFile] === path) activeShow.set({ id: path, name, type })

  function dblclick(e: any) {
    if (!e.ctrlKey && !e.metaKey && !$outLocked) outBackground.set({ path: path })
  }

  // TODO: Enter play media
  function keydown(e: any) {
    if (e.key === "Enter") dblclick(e)
  }
</script>

<Card
  {loaded}
  class="context #media_card"
  style="width: {$mediaOptions.mode === 'grid' ? 100 : 100 / $mediaOptions.columns}%;"
  preview={$activeShow?.id === path}
  active={$outBackground?.path === path}
  label={name}
  icon={type === "video" ? "movie" : "image"}
  white={type === "image"}
  on:click={click}
  on:dblclick={dblclick}
  on:keydown={keydown}
  on:mouseenter={() => (hover = true)}
  on:mouseleave={() => (hover = false)}
  on:mousemove={move}
>
  <SelectElem id="media" data={{ name, path }} draggable fill>
    <IntersectionObserver class="observer" once let:intersecting>
      {#if intersecting}
        <MediaLoader bind:loaded bind:hover bind:duration bind:videoElem {type} {path} {name} />
      {/if}
    </IntersectionObserver>
  </SelectElem>
</Card>
