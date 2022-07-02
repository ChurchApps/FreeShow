<script lang="ts">
  import { onMount } from "svelte"
  import { uid } from "uid"
  import { activePopup, events, timers } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import { secondsToTime } from "../../helpers/time"
  import Button from "../../inputs/Button.svelte"
  import Dropdown from "../../inputs/Dropdown.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import TextInput from "../../inputs/TextInput.svelte"

  const options = [
    { id: "counter", name: "Count from X to Y" },
    { id: "clock", name: "Count towards a time" },
    { id: "event", name: "Count towards an event" },
  ]

  let option = options[0]

  // counter
  let from = 300
  let to = 0
  $: fromTime = secondsToTime(from)
  $: toTime = secondsToTime(to)

  // update today
  let today = new Date()
  setInterval(() => {
    today = new Date()
  }, 1000)

  // clock
  let time = "11:00"

  let timeCountdown = 0
  let todayTime = new Date([today.getMonth() + 1, today.getDate(), today.getFullYear(), time].join(" "))
  $: if (time) {
    todayTime = new Date([today.getMonth() + 1, today.getDate(), today.getFullYear(), time].join(" "))
    timeCountdown = todayTime.getTime() > today.getTime() ? (todayTime.getTime() - today.getTime()) / 1000 : 0
  }

  $: timeCountdownTime = secondsToTime(timeCountdown)

  // event
  let eventList: any[] = []
  onMount(() => {
    Object.entries($events).forEach(addEvent)
    eventList = eventList.sort((a, b) => (new Date(a).getTime() > new Date(b).getTime() ? 1 : -1))
    event = eventList[0] || {}
  })

  const addEvent = ([id, event]: any) => {
    if (new Date(event.from).getTime() > today.getTime()) eventList.push({ id, name: event.name, date: event.from })
  }

  let event: any = {}
  let eventTime: Date
  let eventCountdown: any = { m: "00", s: "00" }

  $: if (event.id) {
    eventTime = new Date($events[event.id].from)
    eventCountdown = secondsToTime(eventTime.getTime() > today.getTime() ? (eventTime.getTime() - today.getTime()) / 1000 : 0)
  }

  $: if (option.id && (name.default || !name.value.length)) {
    name.default = true
    if (option.id === "counter") name.value = "Counter"
    else if (option.id === "clock") name.value = "Time"
    else if (option.id === "event") name.value = event.name || "Event"
  }

  // create
  function createTimer() {
    timers.update((a) => {
      let id = uid()
      a[id] = { name: name.value, type: option.id }
      if (option.id === "event") a[id].event = event.id
      else if (option.id === "clock") a[id].time = time
      else {
        a[id].start = from
        a[id].end = to
      }
      return a
    })
    activePopup.set(null)
  }

  let name: any = { default: true, value: "" }
  function changeName(e: any) {
    name = { default: false, value: e.target.value }
  }
</script>

<h4>Action</h4>
<Dropdown {options} value={option.name} on:click={(e) => (option = e.detail)} />
<br />
<h4>Name</h4>
<TextInput value={name.value} on:change={changeName} />

<hr />

{#if option.id === "counter"}
  <h4>Set time (In seconds)</h4>
  <div class="flex">
    <p>From</p>
    <NumberInput value={from} max={60 * 60 * 24 * 365} on:change={(e) => (from = e.detail)} />
  </div>
  <div class="flex">
    <p>To</p>
    <NumberInput value={to} max={60 * 60 * 24 * 365} on:change={(e) => (to = e.detail)} />
  </div>

  <br />
  <h4>Preview</h4>
  <div style="display: flex;align-items: center;">
    {#if Number(fromTime.d)}{fromTime.d}, {/if}{#if Number(fromTime.h)}{fromTime.h}:{/if}{fromTime.m}:{fromTime.s}
    <Icon id="next" />
    {#if Number(toTime.d)}{toTime.d}, {/if}{#if Number(toTime.h)}{toTime.h}:{/if}{toTime.m}:{toTime.s}
  </div>
{:else if option.id === "clock"}
  <h4>Set time</h4>
  <div class="flex">
    <p>Clock</p>
    <!-- <Date value={to} on:change={(e) => (to = e.detail)} />x -->
    <input type="time" bind:value={time} />
  </div>

  <br />
  <h4>Preview</h4>
  {#if Number(timeCountdownTime.d)}{timeCountdownTime.d}, {/if}{#if Number(timeCountdownTime.h)}{timeCountdownTime.h}:{/if}{timeCountdownTime.m}:{timeCountdownTime.s}
{:else if option.id === "event"}
  <h4>Choose an event</h4>
  <Dropdown options={eventList} value={event.name || "—"} on:click={(e) => (event = e.detail)} />

  <br />
  <h4>Preview</h4>
  {#if Number(eventCountdown.d)}{eventCountdown.d}, {/if}{#if Number(eventCountdown.h)}{eventCountdown.h}:{/if}{eventCountdown.m}:{eventCountdown.s}
{/if}

<hr />

<Button center dark on:click={createTimer}>
  <Icon id="timer" right />
  Create timer
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
