<script lang="ts">
  import { OUTPUT } from "../../../../types/Channels"
  import { activePopup, activeProject, activeTimers, dictionary, projects, shows, timers } from "../../../stores"
  import { send } from "../../../utils/request"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Timer from "../../slide/views/Timer.svelte"
  import Center from "../../system/Center.svelte"
  import { getTimers } from "./timers"

  $: globalList = $timers
  $: console.log(globalList)

  $: showsList = $projects[$activeProject!].shows
  let list: any[] = []
  $: if (showsList.length) loadTimers()
  async function loadTimers() {
    list = []
    showsList.forEach(async (a) => {
      let timers = await getTimers(a)
      if (timers) list = [...list, ...timers]
    })
  }

  // TODO: check overlays

  // function getTimes(timer: any, formatting: string) {
  //   let times = secondsToTimes(timer)

  //   let t: string[] = []
  //   formatting.split(":").forEach((a: string) => t.push(format(a, times)))

  //   return t.join(":")
  // }

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

  function playPauseGlobal(id: any, timer: any) {
    activeTimers.update((a) => {
      a[id].paused = a[id].paused === undefined ? true : !a[id].paused
      return a
    })

    activeTimers.set([...new Set([...$activeTimers, { id, ...timer, currentTime: timer.start }])])
  }

  function reset(item: any) {
    activeTimers.set($activeTimers.filter((a: any) => a.showId !== item.showId || a.slideId !== item.slideId || a.id !== item.timer.id))
    send(OUTPUT, ["ACTIVE_TIMERS"], $activeTimers)
  }

  $: active = 0

  let today = new Date()
  setInterval(() => (today = new Date()), 1000)
</script>

{#if Object.keys(globalList).length || list.length}
  <div style="flex: 1;overflow: auto;padding: 10px 0;">
    {#if Object.keys(globalList).length}
      {#each Object.entries(globalList) as [id, timer]}
        <!-- {@const playing = $activeTimers.find((a) => a.id === id && a.paused !== true)} -->
        <div style="display: flex;justify-content: space-between;">
          <div style="display: flex;width: 50%;">
            <Button
              on:click={() => playPauseGlobal(id, timer)}
              title={$activeTimers.find((a) => a.id === id && a.paused !== true) ? $dictionary.media?.pause : $dictionary.media?.play}
            >
              <Icon id={$activeTimers.find((a) => a.id === id && a.paused !== true) ? "pause" : "play"} />
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
            <Button on:click={() => activePopup.set("timer")} title={$dictionary.menu?.edit}>
              <Icon id={"edit"} />
            </Button>
            <Button>
              <Icon id={"reset"} title={$dictionary.actions?.reset} />
            </Button>
          </div>
        </div>
      {/each}
    {/if}
    {#if Object.keys(globalList).length && list.length}
      <hr />
    {/if}
    {#if list.length}
      {#each list as item}
        <!-- {@const playing = $activeTimers.find((a) => a.showId === item.showId && a.slideId === item.slideId && a.id === item.timer.id && a.paused !== true)} -->
        <div style="display: flex;justify-content: space-between;">
          <div style="display: flex;width: 50%;">
            <Button
              on:click={() => playPause(item)}
              title={$activeTimers.find((a) => a.showId === item.showId && a.slideId === item.slideId && a.id === item.timer.id && a.paused !== true)
                ? $dictionary.media?.pause
                : $dictionary.media?.play}
            >
              <Icon id={$activeTimers.find((a) => a.showId === item.showId && a.slideId === item.slideId && a.id === item.timer.id && a.paused !== true) ? "pause" : "play"} />
            </Button>
            <p style="align-self: center;padding: 0 5px;" title={$shows[list[active].showId].name}>
              {#if item.timer.name}
                {item.timer.name}
              {:else}
                <span style="opacity: 0.5;">
                  <T id="main.unnamed" />
                </span>
              {/if}
            </p>
          </div>
          <div style="display: flex;">
            <span style="display: flex;align-self: center;padding: 0 5px;">
              <Timer {item} ref={{ showId: item.showId, id: item.id }} {today} />
            </span>
            <Button on:click={() => activePopup.set("timer")} title={$dictionary.menu?.edit}>
              <Icon id={"edit"} />
            </Button>
            <Button on:click={() => reset(list[active])} title={$dictionary.actions?.reset}>
              <Icon id={"reset"} />
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
  <Button disabled style="flex: 1;white-space: nowrap;" on:click={() => activePopup.set("timer")} center title={$dictionary.new?.timer} dark>
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
