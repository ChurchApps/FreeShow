<script lang="ts">
  import { activeShow, shows } from "../../stores"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import { joinTime, secondsToTime } from "../helpers/time"
  import Button from "../inputs/Button.svelte"

  export let layoutSlide: any
  export let background: any
  export let duration: any
  export let columns: number
  export let index: number

  $: videoDuration = duration ? joinTime(secondsToTime(duration)) : null

  $: transitionTime =
    layoutSlide.transition && layoutSlide.transition.duration > 0
      ? layoutSlide.transition.duration > 59
        ? joinTime(secondsToTime(layoutSlide.transition.duration))
        : layoutSlide.transition.duration + "s"
      : null

  function removeLayout(key: string) {
    history({ id: "changeLayout", newData: { key }, location: { page: "show", show: $activeShow!, layout: $shows[$activeShow!.id].settings.activeLayout, layoutSlide: index } })
  }

  $: notMuted = background?.muted === false
</script>

<div class="icons" style="zoom: {4 / columns};">
  {#if transitionTime}
    <div>
      <div class="button">
        <Button style="padding: 5px;" redHover title="[[[Remove transition]]]" on:click={() => removeLayout("transition")}>
          <Icon id="transition" white />
        </Button>
      </div>
      <span><p>{transitionTime}</p></span>
    </div>
  {/if}
  {#if layoutSlide.end}
    <div>
      <div class="button">
        <Button style="padding: 5px;" redHover title="[[[Remove go to start]]]" on:click={() => removeLayout("end")}>
          <Icon id="restart" white />
        </Button>
      </div>
    </div>
  {/if}
  {#if background}
    <div>
      <div class="button">
        <Button style="padding: 5px;" redHover title="[[[Remove background]]]" on:click={() => removeLayout("background")}>
          <!-- <Icon id={background.type} white /> -->
          <Icon id={background.type || "image"} white />
        </Button>
      </div>
      {#if videoDuration}
        <!-- <span>01:13</span> -->
        <span><p>{videoDuration}</p></span>
      {/if}
    </div>
  {/if}
  {#if notMuted}
    <div>
      <div class="button">
        <Button style="padding: 5px;" redHover title="[[[Mute]]]" on:click={() => console.log("mute")}>
          <Icon id="volume" white />
        </Button>
      </div>
    </div>
  {/if}
  {#if layoutSlide.overlays?.length}
    <div>
      <div class="button">
        <Button style="padding: 5px;" redHover title="[[[Remove overlays]]]" on:click={() => removeLayout("overlays")}>
          <Icon id="overlays" white />
        </Button>
      </div>
      {#if layoutSlide.overlays.length > 1}
        <span><p>{layoutSlide.overlays.length}</p></span>
      {/if}
    </div>
  {/if}
  {#if layoutSlide.audio?.length}
    <div>
      <div class="button">
        <Button style="padding: 5px;" redHover title="[[[Remove audio]]]" on:click={() => removeLayout("audio")}>
          <Icon id="audio" white />
        </Button>
      </div>
      <span><p>03:32</p></span>
    </div>
  {/if}
</div>

<style>
  .icons {
    pointer-events: none;
    display: flex;
    flex-direction: column;
    position: absolute;
    z-index: 1;
  }
  .icons div {
    opacity: 0.9;
    display: flex;
  }
  .icons .button {
    background-color: rgb(0 0 0 / 0.6);
    pointer-events: all;
  }
  .icons span {
    pointer-events: all;
    background-color: rgb(0 0 0 / 0.6);
    padding: 5px;
    font-size: 0.75em;
    font-weight: bold;
    display: flex;
    align-items: center;
  }
</style>
