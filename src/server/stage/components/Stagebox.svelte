<script lang="ts">
  import Clock from "../items/Clock.svelte"
  import SlideText from "../items/SlideText.svelte"
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
  $: autoSize = Math.min(height, width) / 2
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
      {:else if id.includes("slide_text")}
        <SlideText {slides} next={id.includes("next")} />
      {:else if id.includes("slide")}
        <span>
          <SlideText {slides} next={id.includes("next")} style />
        </span>
      {:else if id.includes("clock")}
        <Clock />
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
