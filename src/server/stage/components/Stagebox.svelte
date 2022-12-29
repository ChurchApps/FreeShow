<script lang="ts">
  import { getAutoSize } from "../helpers/autoSize"
  import { getStyles } from "../helpers/style"
  import Clock from "../items/Clock.svelte"
  import SlideNotes from "../items/SlideNotes.svelte"
  import SlideText from "../items/SlideText.svelte"
  import VideoTime from "../items/VideoTime.svelte"
  import { timers } from "../store"
  import Timer from "./Timer.svelte"

  export let show: any
  export let id: string
  export let item: any
  export let slides: any

  // timer
  let today = new Date()
  setInterval(() => (today = new Date()), 1000)

  let height: number = 0
  let width: number = 0
  $: fontSize = Number(getStyles(item.style, true)?.["font-size"] || 0)

  $: size = getAutoSize(item, { width, height })
  $: autoSize = fontSize ? Math.min(fontSize, size) : size
</script>

<div class="item" style={item.style} bind:offsetHeight={height} bind:offsetWidth={width}>
  {#if show?.settings.labels}
    <div class="label">
      {item.label}
      <!-- <T id="stage.{id.split('#')[1]}" /> -->
    </div>
  {/if}
  <div class="align" style={item.align}>
    <div>
      {#if id.split("#")[0] === "countdowns"}
        <!--  -->
      {:else if id.includes("notes")}
        <SlideNotes notes="" />
      {:else if id.includes("slide_text")}
        {#key item}
          <SlideText {slides} next={id.includes("next")} {autoSize} parent={{ width, height }} />
        {/key}
      {:else if id.includes("slide")}
        <span style="pointer-events: none;">
          <SlideText {slides} next={id.includes("next")} parent={{ width, height }} style />
        </span>
      {:else if id.includes("clock")}
        <Clock {autoSize} />
      {:else if id.includes("video")}
        <VideoTime {autoSize} />
      {:else if id.includes("timers")}
        {#if $timers[id.split("#")[1]]}
          <Timer timer={$timers[id.split("#")[1]]} ref={{ id: id.split("#")[1] }} {today} style="font-size: {autoSize}px;" />
        {/if}
      {:else}
        {id}
      {/if}
    </div>
  </div>
</div>

<style>
  .align {
    height: 100%;
    display: flex;
    text-align: center;
    align-items: center;
  }

  .align div,
  .align :global(.item) {
    width: 100%;
    height: 100%;
    color: unset;
    /* overflow-wrap: break-word; */
  }
</style>
