<script lang="ts">
  import { OUTPUT } from "../../../../types/Channels"
  import { activePopup, activeProject, activeTimers, dictionary, projects, shows, showsCache, timers } from "../../../stores"
  import { send } from "../../../utils/request"
  import Icon from "../../helpers/Icon.svelte"
  import { select } from "../../helpers/select"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Timer from "../../slide/views/Timer.svelte"
  import Center from "../../system/Center.svelte"
  import { getTimers } from "./timers"

  $: globalList = $timers
  $: console.log(globalList)

  $: showsList = $projects[$activeProject!].shows
  let list: any[] = []
  $: if (showsList.length || $showsCache) loadTimers()
  async function loadTimers() {
    list = []

    await Promise.all(
      showsList.map(async (a) => {
        let timers = await getTimers(a)
        if (timers) list.push(...timers)
      })
    )

    // remove duplicates
    list = list.filter((value, index, self) => index === self.findIndex((a) => a.id === value.id))
  }
  $: console.log(list)

  // TODO: check overlays

  // function getTimes(timer: any, formatting: string) {
  //   let times = secondsToTimes(timer)

  //   let t: string[] = []
  //   formatting.split(":").forEach((a: string) => t.push(format(a, times)))

  //   return t.join(":")
  // }

  function playPause(item: any) {
    let index = $activeTimers.findIndex((a) => a.showId === item.showId && a.slideId === item.slideId && a.id === item.id)

    activeTimers.update((a) => {
      if (index < 0) a.push({ showId: item.showId, slideId: item.slideId, ...item.timer, currentTime: item.timer.start, paused: false })
      else a[index].paused = !a[index].paused
      return a
    })
  }

  function playPauseGlobal(id: any, timer: any) {
    let index = $activeTimers.findIndex((a) => a.id === id)

    activeTimers.update((a) => {
      if (index < 0) a.push({ ...timer, id, currentTime: timer.start, paused: false })
      else a[index].paused = !a[index].paused
      return a
    })
  }

  function reset(id: string) {
    activeTimers.set($activeTimers.filter((a: any) => a.id !== id))
    send(OUTPUT, ["ACTIVE_TIMERS"], $activeTimers)
  }

  function deleteTimer(id: string) {
    let active = $activeTimers.findIndex((a) => a.id === id)
    if (active > -1) {
      activeTimers.update((a) => {
        a.splice(active, 1)
        return a
      })
    }

    timers.update((a) => {
      delete a[id]
      return a
    })
  }

  $: active = 0

  let today = new Date()
  setInterval(() => (today = new Date()), 1000)
</script>

{#if Object.keys(globalList).length || list.length}
  <div style="flex: 1;overflow: auto;padding: 10px 0;">
    {#if list.length}
      {#each list as item}
        {@const timer = item.timer}
        <!-- {@const playing = $activeTimers.find((a) => a.showId === item.showId && a.slideId === item.slideId && a.id === item.timer.id && a.paused !== true)} -->
        <div style="display: flex;justify-content: space-between;">
          <div style="display: flex;width: 50%;">
            <Button
              disabled={timer.type !== "counter"}
              on:click={() => playPause(item)}
              title={$activeTimers.find((a) => a.showId === item.showId && a.slideId === item.slideId && a.id === timer.id && a.paused !== true)
                ? $dictionary.media?.pause
                : $dictionary.media?.play}
            >
              <Icon
                id={timer.type !== "counter" || $activeTimers.find((a) => a.showId === item.showId && a.slideId === item.slideId && a.id === timer.id && a.paused !== true)
                  ? "pause"
                  : "play"}
              />
            </Button>
            <p style="align-self: center;padding: 0 5px;" title={$shows[list[active].showId].name}>
              {#if timer.name}
                {timer.name}
              {:else if $showsCache[item.showId]}
                <span style="opacity: 0.5;">
                  {$showsCache[item.showId].name}
                </span>
              {:else}
                <span style="opacity: 0.5;">
                  <T id="main.unnamed" />
                </span>
              {/if}
            </p>
          </div>
          <div style="display: flex;">
            <span style="display: flex;align-self: center;padding: 0 5px;">
              <Timer {item} ref={{ showId: item.showId, slideId: item.slideId, id: item.id }} {today} />
            </span>
            <Button
              on:click={() => {
                select("timer", { id: item.id, showId: item.showId, slideId: item.slideId })
                activePopup.set("timer")
              }}
              title={$dictionary.menu?.edit}
            >
              <Icon id="edit" />
            </Button>
            {#if timer.type === "counter"}
              <Button on:click={() => reset(timer.id)} title={$dictionary.actions?.reset}>
                <Icon id="reset" />
              </Button>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
    {#if Object.keys(globalList).length && list.length}
      <hr />
    {/if}
    {#if Object.keys(globalList).length}
      {#each Object.entries(globalList) as [id, timer]}
        <!-- {@const playing = $activeTimers.find((a) => a.id === id && a.paused !== true)} -->
        <div style="display: flex;justify-content: space-between;">
          <div style="display: flex;width: 50%;">
            <Button
              disabled={timer.type !== "counter"}
              on:click={() => playPauseGlobal(id, timer)}
              title={$activeTimers.find((a) => a.id === id && a.paused !== true) ? $dictionary.media?.pause : $dictionary.media?.play}
            >
              <Icon id={timer.type !== "counter" || $activeTimers.find((a) => a.id === id && a.paused !== true) ? "pause" : "play"} />
            </Button>
            <p style="align-self: center;padding: 0 5px;" title={timer.name}>
              {#if timer.name}
                {timer.name}
              {:else}
                <span style="opacity: 0.5;">
                  <T id="main.unnamed" />
                </span>
              {/if}
            </p>
          </div>
          <div style="display: flex;">
            <span style="display: flex;align-self: center;padding: 0 5px;">
              <Timer {timer} ref={{ id }} {today} />
              <!-- {getTimes(list[active].timer.start, list[active].timer.format)} -->
            </span>
            <Button
              on:click={() => {
                select("timer", { id })
                activePopup.set("timer")
              }}
              title={$dictionary.menu?.edit}
            >
              <Icon id="edit" />
            </Button>
            {#if timer.type === "counter"}
              <Button on:click={() => reset(id)}>
                <Icon id="reset" title={$dictionary.actions?.reset} />
              </Button>
            {/if}
            <Button on:click={() => deleteTimer(id)}>
              <Icon id="delete" title={$dictionary.actions?.delete} />
            </Button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
{:else}
  <Center faded>
    <T id="empty.timers" />
  </Center>
{/if}

<div style="display: flex;flex-wrap: wrap;">
  <!-- TODO: enable!! -->
  <Button style="flex: 1;white-space: nowrap;" on:click={() => activePopup.set("timer")} center title={$dictionary.new?.timer} dark>
    <Icon id="timer" right />
    <T id="new.timer" />
  </Button>
  {#if Object.keys(globalList).length || list.length}
    <!-- <Button on:click={() => }>
    <Icon id={ ? "pause" : "play"} />
      [[[Play all]]]
  </Button> -->
    <Button
      on:click={() => {
        activeTimers.set([])
        send(OUTPUT, ["ACTIVE_TIMERS"], $activeTimers)
      }}
      style="flex: 1;"
      center
      dark
    >
      <Icon id="reset" right />
      <T id="actions.reset" />
    </Button>
  {/if}
</div>

<style>
  hr {
    border: 0;
    height: 2px;
    margin: 10px 0;
    background-color: var(--primary-lighter);
  }
</style>
