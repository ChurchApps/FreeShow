<script lang="ts">
  import { OUTPUT } from "../../../types/Channels"

  import { activeShow, activeTimers, dictionary, showsCache } from "../../stores"
  import { requestData } from "../../utils/request"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import { _show } from "../helpers/shows"
  import { joinTime, secondsToTime } from "../helpers/time"
  import Button from "../inputs/Button.svelte"

  export let timer: any
  export let layoutSlide: any
  export let background: any
  export let duration: any
  export let columns: number
  export let index: number

  $: videoDuration = duration ? joinTime(secondsToTime(duration)) : null
  $: notMuted = background?.muted === false

  $: transitionTime =
    layoutSlide.transition && layoutSlide.transition.duration > 0
      ? layoutSlide.transition.duration > 59
        ? joinTime(secondsToTime(layoutSlide.transition.duration))
        : layoutSlide.transition.duration + "s"
      : null

  function removeLayout(key: string) {
    history({
      id: "changeLayout",
      newData: { key },
      location: { page: "show", show: $activeShow!, layout: $showsCache[$activeShow!.id].settings.activeLayout, layoutSlide: index },
    })
  }

  // TODO: history
  function mute() {
    _show("active").media([layoutSlide.background]).set({ key: "muted", value: undefined })
  }

  function resetTimer() {
    activeTimers.update((a) => {
      a = a.filter((_a, i) => !timer.includes(i))
      return a
    })
    requestData(OUTPUT, ["ACTIVE_TIMERS"], $activeTimers)
  }
</script>

<!-- TODO: check if exists -->
<div class="icons" style="zoom: {4 / columns};">
  {#if timer.length}
    <div>
      <div class="button">
        <Button style="padding: 5px;" redHover title={$dictionary.remove?.timer} on:click={() => resetTimer()}>
          <Icon id="timer" white />
        </Button>
      </div>
      {#if timer.length > 1}
        <span><p>{timer.length}</p></span>
      {/if}
    </div>
  {/if}
  {#if transitionTime}
    <div>
      <div class="button">
        <Button style="padding: 5px;" redHover title={$dictionary.remove?.transition} on:click={() => removeLayout("transition")}>
          <Icon id="transition" white />
        </Button>
      </div>
      <span><p>{transitionTime}</p></span>
    </div>
  {/if}
  {#if layoutSlide.end}
    <div>
      <div class="button">
        <Button style="padding: 5px;" redHover title={$dictionary.remove?.to_start} on:click={() => removeLayout("end")}>
          <Icon id="restart" white />
        </Button>
      </div>
    </div>
  {/if}
  {#if background}
    <div>
      <div class="button">
        <Button style="padding: 5px;" redHover title={$dictionary.remove?.background} on:click={() => removeLayout("background")}>
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
        <Button style="padding: 5px;" redHover title={$dictionary.actions?.mute} on:click={() => mute()}>
          <Icon id="volume" white />
        </Button>
      </div>
    </div>
  {/if}
  {#if layoutSlide.overlays?.length}
    <div>
      <div class="button">
        <Button style="padding: 5px;" redHover title={$dictionary.remove?.overlays} on:click={() => removeLayout("overlays")}>
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
        <Button style="padding: 5px;" redHover title={$dictionary.remove?.audio} on:click={() => removeLayout("audio")}>
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
