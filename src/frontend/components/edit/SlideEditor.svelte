<script lang="ts">
  import { activeEdit, activeShow, backgroundColor, screen, showsCache } from "../../stores"
  import MediaLoader from "../drawer/media/MediaLoader.svelte"
  import { history } from "../helpers/history"
  import { getMediaFilter, getMediaFlipped } from "../helpers/showActions"
  import { _show } from "../helpers/shows"
  import { getStyles } from "../helpers/style"
  import T from "../helpers/T.svelte"
  import { getStyleResolution } from "../slide/getStyleResolution"
  import Zoomed from "../slide/Zoomed.svelte"
  import Center from "../system/Center.svelte"
  import Snaplines from "../system/Snaplines.svelte"
  import Editbox from "./Editbox.svelte"
  import { autoSize } from "./scripts/autoSize"

  $: currentShow = $activeShow?.id
  $: if (currentShow && $showsCache[currentShow] && $activeEdit.slide === null && _show("active").slides().get().length) activeEdit.set({ slide: 0, items: [] })
  $: ref = currentShow && $showsCache[currentShow] ? _show("active").layouts("active").ref()[0] : null
  $: Slide = $activeEdit.slide !== null && ref?.[$activeEdit.slide!] ? _show("active").slides([ref[$activeEdit.slide!]?.id]).get()[0] : null

  let lines: [string, number][] = []
  let mouse: any = null
  let newStyles: any = {}
  $: active = $activeEdit.items

  let width: number = 0
  let height: number = 0
  $: resolution = Slide?.settings?.resolution || $screen.resolution
  // TODO: zoom more in...

  let ratio: number = 1

  // get backgruond
  $: bgId = ref?.[$activeEdit.slide!]?.data.background
  $: background = bgId && currentShow ? $showsCache[currentShow].media[bgId] : null
  // $: slideOverlays = ref?.[$activeEdit.slide!]?.data.overlays || []

  let filter: string = ""
  let flipped: boolean = false
  $: if (background?.path) {
    // TODO: use show filter if existing
    filter = getMediaFilter(background.path)
    flipped = getMediaFlipped(background.path)
  }

  $: {
    if (active.length) updateStyles()
    else newStyles = {}
  }

  function updateStyles() {
    if (!Object.keys(newStyles).length) return

    let items = $showsCache[$activeShow?.id!].slides[ref[$activeEdit.slide!]?.id].items
    let values: any[] = []
    active.forEach((id) => {
      let item = items[id]
      if (item) {
        let styles: any = getStyles(item.style)
        let textStyles: string = ""

        Object.entries(newStyles).forEach(([key, value]: any) => (styles[key] = value))
        Object.entries(styles).forEach((obj) => (textStyles += obj[0] + ":" + obj[1] + ";"))

        values.push(textStyles)
      }
    })

    history({
      id: "setStyle",
      newData: { style: { key: "style", values } },
      location: { page: "edit", show: $activeShow!, slide: ref[$activeEdit.slide!].id, items: active },
    })
  }

  $: if (Object.keys(newStyles).length && $showsCache[$activeShow?.id!] && active.length) {
    // let items = $showsCache[$activeShow?.id!].slides[ref[$activeEdit.slide!].id].items
    let items = _show("active").slides([ref[$activeEdit.slide!].id]).items().get()[0]
    if (items) autoSize(active, items)
  }

  let altKeyPressed: boolean = false
  function keydown(e: any) {
    if (e.altKey) {
      e.preventDefault()
      altKeyPressed = true
    }
  }
  function keyup() {
    altKeyPressed = false
  }
</script>

<svelte:window on:keydown={keydown} on:keyup={keyup} on:mousedown={keyup} />

<div class="parent" bind:offsetWidth={width} bind:offsetHeight={height}>
  {#if Slide}
    <Zoomed
      background={Slide?.settings?.color || $backgroundColor || "black"}
      {resolution}
      style={getStyleResolution(resolution, width, height)}
      bind:ratio
      hideOverflow={false}
      center
    >
      <!-- background -->
      {#if !altKeyPressed && background}
        {#key background.path}
          <div class="background" style="zoom: {1 / ratio};opacity: 0.5;">
            <MediaLoader path={background.path || background.id || ""} type={background.type !== "player" ? background.type : null} {filter} {flipped} />
          </div>
        {/key}
      {/if}
      <!-- edit -->
      <Snaplines bind:lines bind:newStyles bind:mouse {ratio} {active} />
      {#each Slide.items as item, index}
        <Editbox {item} ref={{ showId: currentShow, id: Slide.id }} {index} {ratio} bind:mouse />
      {/each}
      <!-- overlays -->
      <!-- {#if !altKeyPressed && slideOverlays?.length}
        <div style="opacity: 0.5;pointer-events: none;">
          {#each slideOverlays as id}
            {#if $overlays[id]}
              {#each $overlays[id].items as item}
                <Textbox {item} ref={{ type: "overlay", id }} />
              {/each}
            {/if}
          {/each}
        </div>
      {/if} -->
    </Zoomed>
  {:else}
    <Center size={2} faded>
      <T id="empty.slide" />
    </Center>
  {/if}
</div>

<style>
  .parent {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 10px;
    overflow: auto;
  }
</style>
