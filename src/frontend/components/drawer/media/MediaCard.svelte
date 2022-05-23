<script lang="ts">
  import { activeEdit, activePage, activeShow, media, mediaOptions, outBackground, outLocked } from "../../../stores"
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

  let loaded: boolean = true
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

  $: index = allFiles.findIndex((a) => a === path)

  function click(e: any) {
    if (!e.ctrlKey && !e.metaKey) activeFile = index
  }
  $: if (activeFile !== null && allFiles[activeFile] === path) {
    if ($activePage === "edit" && $activeShow && ($activeShow.type === undefined || $activeShow.type === "show")) activeEdit.set({ id: path, type: "media", items: [] })
    else {
      activeEdit.set({ items: [] })
      activeShow.set({ id: path, name, type })
    }
  }

  function dblclick(e: any) {
    if (!e.ctrlKey && !e.metaKey && !$outLocked) outBackground.set({ path: path, type, loop: false, filter, flipped })
  }

  // TODO: Enter play media
  function keydown(e: any) {
    if (e.key === "Enter") dblclick(e)
  }

  let filter = ""
  let flipped = false

  $: {
    if ($media[path]) {
      let style = ""
      Object.entries($media[path].filter).forEach(([id, a]: any) => (style += ` ${id}(${a})`))
      filter = style
      flipped = $media[path].flipped || false
    } else {
      filter = ""
      flipped = false
    }
  }
</script>

<Card
  {loaded}
  class="context #media_card"
  style="width: {$mediaOptions.mode === 'grid' ? 100 : 100 / $mediaOptions.columns}%;"
  mode={$mediaOptions.mode}
  changed={!!filter.length || flipped}
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
        <MediaLoader bind:loaded bind:hover bind:duration bind:videoElem {type} {path} {name} {filter} {flipped} />
      {/if}
    </IntersectionObserver>
  </SelectElem>
</Card>
