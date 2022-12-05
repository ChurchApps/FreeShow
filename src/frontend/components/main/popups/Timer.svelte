<script lang="ts">
  import { onMount } from "svelte"
  import { uid } from "uid"
  import type { Timer } from "../../../../types/Show"
  import { activePopup, dictionary, events, timers } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import { deselect, getSelected } from "../../helpers/select"
  import T from "../../helpers/T.svelte"
  import { secondsToTime } from "../../helpers/time"
  import Button from "../../inputs/Button.svelte"
  import Dropdown from "../../inputs/Dropdown.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import TextInput from "../../inputs/TextInput.svelte"
  import { getTimer, updateShowTimer } from "../../drawer/timers/timers"

  let currentTimer = getSelected("timer", 0)
  let timer: Timer = {
    type: "counter",
    name: "Counter",
    start: 300,
    end: 0,
    event: "",
    time: "12:00",
  }
  $: console.log(currentTimer)
  $: if (currentTimer?.id) {
    timer = getTimer(currentTimer)
    deselect()
  }
  $: console.log(timer)

  const options: any = [
    { id: "counter", name: "$:timer.from_to:$", translate: true },
    { id: "clock", name: "$:timer.to_time:$", translate: true },
    { id: "event", name: "$:timer.to_event:$", translate: true },
  ]
  $: currentOption = options.find((a: any) => a.id === timer.type) || {}

  // counter
  $: fromTime = secondsToTime(timer.start === undefined ? 300 : timer.start)
  $: toTime = secondsToTime(timer.end === undefined ? 0 : timer.end)

  // update today
  let today = new Date()
  setInterval(() => {
    today = new Date()
  }, 1000)

  // clock
  let timeCountdown = 0
  let todayTime = new Date([today.getMonth() + 1, today.getDate(), today.getFullYear(), timer.time].join(" "))
  $: if (!timer.time) timer.time = "12:00"
  $: if (timer.time) {
    todayTime = new Date([today.getMonth() + 1, today.getDate(), today.getFullYear(), timer.time].join(" "))
    timeCountdown = todayTime.getTime() > today.getTime() ? (todayTime.getTime() - today.getTime()) / 1000 : 0
  }

  $: timeCountdownTime = secondsToTime(timeCountdown)

  // event
  let eventList: any[] = []
  onMount(() => {
    Object.entries($events).forEach(addEvent)
    eventList = eventList.sort((a, b) => (new Date(a).getTime() > new Date(b).getTime() ? 1 : -1))
    timer.event = eventList[0]?.id || ""
  })

  const addEvent = ([id, event]: any) => {
    if (new Date(event.from).getTime() > today.getTime()) eventList.push({ id, name: event.name, date: event.from })
  }

  let eventTime: Date
  let eventCountdown: any = { m: "00", s: "00" }
  function updateEvent(e: any) {
    timer.event = e.detail.id
  }

  $: if (timer.event && eventList.length) {
    eventTime = new Date(eventList.find((a) => a.id === timer.event).date)
    eventCountdown = secondsToTime(eventTime.getTime() > today.getTime() ? (eventTime.getTime() - today.getTime()) / 1000 : 0)
  }

  let timerNames: any = {
    counter: $dictionary.timer?.counter || "Counter",
    clock: $dictionary.timer?.time || "Time",
    event: $dictionary.timer?.event || "Event",
  }
  $: if (timer.event && eventList.length) updateEventName()
  const updateEventName = () => (timerNames.event = eventList.find((a) => a.id === timer.event)?.name)
  $: if (timer.type && (!timer.name || Object.values(timerNames).includes(timer.name))) timer.name = timerNames[timer.type] || $dictionary.timer?.counter || "Timer"

  function changeName(e: any) {
    timer.name = e.target.value
  }

  // timer
  function createTimer() {
    timers.update((a) => {
      let id = uid()
      a[id] = getNewTimer()
      return a
    })
    activePopup.set(null)
  }

  // TODO: history

  function editTimer() {
    console.log("edit", currentTimer)
    let id: string = currentTimer.id
    let newTimer: any = getNewTimer()

    if (currentTimer.showId) {
      updateShowTimer(currentTimer, newTimer)
    } else {
      timers.update((a) => {
        a[id] = newTimer
        return a
      })
    }
    activePopup.set(null)
  }

  function getNewTimer() {
    let newTimer: Timer = { name: timer.name, type: timer.type }
    if (timer.id) newTimer.id = timer.id
    if (timer.type === "event") newTimer.event = timer.event
    else if (timer.type === "clock") newTimer.time = timer.time || "12:00"
    else {
      newTimer.start = timer.start === undefined ? 300 : Number(timer.start)
      newTimer.end = timer.end === undefined ? 0 : Number(timer.end)
    }
    return newTimer
  }
</script>

<!-- <h4>Action</h4> -->
<Dropdown {options} value={currentOption.name} on:click={(e) => (timer.type = e.detail.id)} />
<br />
<h4><T id="inputs.name" /></h4>
<TextInput value={timer.name} on:change={changeName} />

<hr />

{#if timer.type === "counter"}
  <h4><T id="timer.time" /> (<T id="timer.seconds" />)</h4>
  <div class="flex">
    <p><T id="timer.from" /></p>
    <NumberInput value={timer.start === undefined ? 300 : timer.start} max={60 * 60 * 24 * 365} on:change={(e) => (timer.start = e.detail)} />
  </div>
  <div class="flex">
    <p><T id="timer.to" /></p>
    <NumberInput value={timer.end === undefined ? 0 : timer.end} max={60 * 60 * 24 * 365} on:change={(e) => (timer.end = e.detail)} />
  </div>

  <br />
  <h4><T id="timer.preview" /></h4>
  <div style="display: flex;align-items: center;">
    {#if Number(fromTime.d)}{fromTime.d}, {/if}{#if Number(fromTime.h)}{fromTime.h}:{/if}{fromTime.m}:{fromTime.s}
    <Icon id="next" />
    {#if Number(toTime.d)}{toTime.d}, {/if}{#if Number(toTime.h)}{toTime.h}:{/if}{toTime.m}:{toTime.s}
  </div>
{:else if timer.type === "clock"}
  <h4><T id="timer.time" /></h4>
  <div class="flex">
    <p><T id="timer.clock" /></p>
    <!-- <Date value={to} on:change={(e) => (to = e.detail)} />x -->
    <input type="time" bind:value={timer.time} />
  </div>

  <br />
  <h4><T id="timer.preview" /></h4>
  {#if Number(timeCountdownTime.d)}{timeCountdownTime.d}, {/if}{#if Number(timeCountdownTime.h)}{timeCountdownTime.h}:{/if}{timeCountdownTime.m}:{timeCountdownTime.s}
{:else if timer.type === "event"}
  <h4><T id="timer.event" /></h4>
  {#if eventList.length}
    <Dropdown options={eventList} value={eventList.find((a) => a.id === timer.event)?.name || "—"} on:click={updateEvent} />
  {:else}
    <T id="timer.no_events" />
  {/if}

  <br />
  <h4><T id="timer.preview" /></h4>
  {#if Number(eventCountdown.d)}{eventCountdown.d}, {/if}{#if Number(eventCountdown.h)}{eventCountdown.h}:{/if}{eventCountdown.m}:{eventCountdown.s}
{/if}

<hr />

<Button center dark on:click={() => (currentTimer?.id ? editTimer() : createTimer())}>
  <Icon id="timer" right />
  {#if currentTimer?.id}
    <T id="timer.edit" />
  {:else}
    <T id="timer.create" />
  {/if}
</Button>

<style>
  .flex {
    display: flex;
    justify-content: space-between;
  }

  hr {
    border: 0;
    height: 2px;
    margin: 20px 0;
    background-color: var(--primary-lighter);
  }

  /* time input */

  input[type="time"] {
    background-color: var(--primary-darker);
    color: inherit;
    width: 50%;
    font-size: inherit;
    font-family: inherit;
    border: 0;
    padding: 5px;

    transition: opacity 0.2s;
  }

  input:disabled {
    opacity: 0.5;
  }

  input::-webkit-calendar-picker-indicator {
    cursor: pointer;
    opacity: 0.8;
    filter: invert(1);
  }
  input::-webkit-calendar-picker-indicator:hover {
    background-color: rgb(0 0 0 / 0.1);
  }

  :global(.dropdown) {
    position: absolute !important;
    width: 100%;
  }
</style>
