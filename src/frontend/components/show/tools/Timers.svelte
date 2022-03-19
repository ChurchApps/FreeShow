<script lang="ts">
  import { OUTPUT } from "../../../../types/Channels"

  import { activeProject, activeTimers, projects, showsCache, shows } from "../../../stores"
  import { requestData } from "../../../utils/request"
  import Icon from "../../helpers/Icon.svelte"
  import { loadShows } from "../../helpers/setShow"
  import { _show } from "../../helpers/shows"
  import T from "../../helpers/T.svelte"
  import { secondsToTimes, format } from "../../helpers/time"
  import Button from "../../inputs/Button.svelte"
  import Timer from "../../slide/views/Timer.svelte"
  import Center from "../../system/Center.svelte"

  $: showsList = $projects[$activeProject!].shows
  let list: any[] = []
  $: if (showsList.length) showsList.map(getTimers)
  // TODO: check overlays

  async function getTimers(showRef: any) {
    if (showRef.type !== undefined && showRef.type !== "show") return
    if (!$showsCache[showRef.id]) await loadShows([showRef.id])

    let timers = _show(showRef.id)
      .slides()
      .items()
      .get()[0]
      .filter((a: any) => a.type === "timer")

    if (timers.length) {
      timers.forEach((a: any) => {
        list.push({ showId: showRef.id, slideId: a.id, ...a })
      })
    }
  }

  function getTimes(timer: any, formatting: string) {
    let times = secondsToTimes(timer)

    let t: string[] = []
    formatting.split(":").forEach((a: string) => t.push(format(a, times)))

    return t.join(":")
  }

  function playPause(item: any) {
    let index = $activeTimers.findIndex((a) => a.showId === item.showId && a.slideId === item.slideId && a.id === item.timer.id)
    if (index > -1) {
      activeTimers.update((a) => {
        a[index].paused = a[index].paused === undefined ? true : !a[index].paused
        return a
      })
      return
    }

    activeTimers.set([...new Set([...$activeTimers, { showId: item.showId, slideId: item.id, ...item.timer, currentTime: item.timer.start }])])
  }

  function reset(item: any) {
    activeTimers.set($activeTimers.filter((a: any) => a.showId !== item.showId || a.slideId !== item.slideId || a.id !== item.timer.id))
    requestData(OUTPUT, ["ACTIVE_TIMERS"], $activeTimers)
  }

  $: active = 0
</script>

{#if list.length}
  <div style="display: flex;">
    <div style="width: 50%;display: flex;flex-direction: column;">
      {#each list as item, i}
        <div style="display: flex;" class:active={active === i} on:click={() => (active = i)}>
          <Button on:click={() => playPause(item)}>
            <Icon id={$activeTimers.find((a) => a.showId === item.showId && a.slideId === item.slideId && a.id === item.timer.id && a.paused !== true) ? "pause" : "play"} />
          </Button>
          <span style="display: flex;align-self: center;">
            <Timer {item} ref={{ showId: item.showId, id: item.id }} />
          </span>
        </div>
        {item.timer.name}
      {/each}
    </div>

    <div style="width: 50%;display: flex;flex-direction: column;padding: 10px;gap: 5px;">
      <span style="align-self: center;">
        <!-- <Icon id={list[active].timer.type} /> -->
        {$shows[list[active].showId].name}
      </span>
      <span style="display: flex;align-items: center;align-self: center;">
        {getTimes(list[active].timer.start, list[active].timer.format)}
        <Icon id="next" />
        {getTimes(list[active].timer.end, list[active].timer.format)}
      </span>
      <!-- TODO: slider -->
      <Button on:click={() => reset(list[active])} center>
        <Icon id="reset" />
      </Button>
    </div>
  </div>

  <div>
    <!-- <Button on:click={() => }>
      <Icon id={ ? "pause" : "play"} />
        [[[Play all]]]
    </Button> -->
    <Button
      on:click={() => {
        activeTimers.set([])
        requestData(OUTPUT, ["ACTIVE_TIMERS"], $activeTimers)
      }}
      dark
    >
      <Icon id="reset" right />
      <T id="actions.reset" />
    </Button>
  </div>
{:else}
  <Center faded>
    <T id="empty.timers" />
  </Center>
{/if}

<style>
  .active {
    background-color: var(--primary-lighter);
  }
</style>
