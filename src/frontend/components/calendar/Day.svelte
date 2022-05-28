<script lang="ts">
  import { uid } from "uid"
  import { activeDays, dictionary, events } from "../../stores"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import Color from "../inputs/Color.svelte"
  import TextInput from "../inputs/TextInput.svelte"
  import Center from "../system/Center.svelte"
  import Panel from "../system/Panel.svelte"

  // onMount(updateEvents)

  const copy = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const isBetween = (from: Date, to: Date, date: Date) => date >= copy(from) && date <= copy(to)

  let current = new Date($activeDays[0])

  let createNew: boolean = false
  let currentEvents: any[] = []

  activeDays.subscribe(() => {
    createNew = false
    updateEvents()
  })
  events.subscribe(updateEvents)

  function updateEvents() {
    current = new Date($activeDays[0])
    let temp: any[] = []

    // if ($activeDays[0]) {
    Object.entries($events).forEach(([id, a]) => {
      if (isBetween(new Date(a.from), new Date(a.to), copy(current))) temp.push({ id, ...a })
    })
    // }

    // sort
    // TODO: sort
    currentEvents = temp.sort((a, b) => a.from - b.from)
    console.log(currentEvents)
  }

  function getTime(date: Date) {
    let h = ("0" + date.getHours()).slice(-2)
    let m = ("0" + date.getMinutes()).slice(-2)
    return h + ":" + m
  }

  const getISO = (date: Date) => {
    date = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes())
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
    return date.toISOString().substring(0, 10)
  }

  // TODO: repeat

  let editEvent: any = {}
  let stored: string = ""
  $: if (current) resetEdit()
  function resetEdit() {
    editEvent = {
      id: uid(),
      name: "",
      color: "#FFFFFF",
      time: true,
      isoFrom: $activeDays.length ? getISO(current) : "",
      isoTo: $activeDays.length ? getISO(current) : "",
      fromTime: "11:00",
      toTime: "13:00",
      location: "",
      notes: "",
    }
    stored = JSON.stringify(editEvent)
  }

  function edit(event: any) {
    let from: Date = new Date(event.from)
    let to: Date = new Date(event.to)

    createNew = true
    editEvent = event
    editEvent.id = event.id
    editEvent.isoFrom = getISO(from)
    editEvent.isoTo = getISO(to)
    editEvent.fromTime = getTime(from)
    editEvent.toTime = getTime(to)
    stored = JSON.stringify(editEvent)
  }

  const inputChange = (e: any, key: string) => (editEvent[key] = e.target.value)
</script>

{#if createNew}
  <div class="main" style="flex: 1;padding: 10px;">
    <Panel>
      <h6><T id="new.event" /></h6>
      <div class="gap" style="justify-content: space-between;">
        <span class="titles" style="max-width: 40%;">
          <p><T id="calendar.name" /></p>
          <p><T id="calendar.color" /></p>
          <p><T id="calendar.time" /></p>
          <p><T id="calendar.from_date" /></p>
          <p><T id="calendar.to_date" /></p>
          <p><T id="calendar.from_time" /></p>
          <p><T id="calendar.to_time" /></p>
          <p><T id="calendar.location" /></p>
          <p><T id="calendar.notes" /></p>
        </span>
        <span style="flex: 1;max-width: calc(60% - 10px);">
          <TextInput value={editEvent.name} style="height: initial;padding: 5px;" on:change={(e) => inputChange(e, "name")} />
          <Color bind:value={editEvent.color} />
          <input type="checkbox" bind:checked={editEvent.time} />
          <input type="date" bind:value={editEvent.isoFrom} />
          <input type="date" bind:value={editEvent.isoTo} />
          <input type="time" bind:value={editEvent.fromTime} disabled={!editEvent.time} />
          <input type="time" bind:value={editEvent.toTime} disabled={!editEvent.time} />
          <TextInput value={editEvent.location} style="height: initial;padding: 5px;" on:change={(e) => inputChange(e, "location")} />
          <TextInput value={editEvent.notes} style="padding: 5px;" on:change={(e) => inputChange(e, "notes")} />
        </span>
      </div>
    </Panel>
  </div>
  <Button
    on:click={() => {
      if (stored === JSON.stringify(editEvent)) createNew = false
      else {
        let data = JSON.parse(JSON.stringify(editEvent))
        let oldData = JSON.parse(stored)
        data.from = new Date(editEvent.isoFrom + " " + (editEvent.time ? editEvent.fromTime : ""))
        data.to = new Date(editEvent.isoTo + " " + (editEvent ? editEvent.toTime : ""))
        oldData.from = new Date(oldData.isoFrom + " " + (oldData.time ? oldData.fromTime : ""))
        oldData.to = new Date(oldData.isoTo + " " + (oldData ? oldData.toTime : ""))
        let id = editEvent.id
        delete data.id
        delete data.isoFrom
        delete data.isoTo
        delete data.fromTime
        delete data.toTime
        delete oldData.id
        delete oldData.isoFrom
        delete oldData.isoTo
        delete oldData.fromTime
        delete oldData.toTime
        // if (repeat)
        console.log(oldData)

        // to has to be after from
        if (data.to.getTime() - data.from.getTime() >= 0) {
          history({ id: "newEvent", newData: { id, data }, oldData })
          createNew = false
          activeDays.set([copy(data.from).getTime()])
          // updateEvents()
        }
      }
    }}
    dark
    center
  >
    <Icon id="save" right />
    {#if stored === JSON.stringify(editEvent)}
      <T id="actions.close" />
    {:else}
      <T id="actions.save" />
    {/if}
  </Button>
{:else if $activeDays.length}
  <div class="main">
    <span class="date">
      {current.getDate()}. {$dictionary.month[current.getMonth() + 1]}
      {current.getFullYear()}
    </span>
    <div class="scroll">
      {#if currentEvents.length}
        {#each currentEvents as event}
          <div class="event" style="color: {event.color || 'unset'}" on:click={() => edit(event)}>
            {#if event.time}
              <span class="time">
                {#if sameDay(new Date(event.from), current)}
                  {getTime(new Date(event.from))}
                {/if}
                {#if !sameDay(new Date(event.from), current) || new Date(event.from).getTime() - new Date(event.to).getTime() > 0}
                  {#if sameDay(new Date(event.to), current)}
                    {#if sameDay(new Date(event.from), current)}
                      -
                    {/if}
                    {getTime(new Date(event.to))}
                  {/if}
                {/if}
              </span>
            {/if}
            <p>
              {#if event.name}
                {event.name}
              {:else}
                <span style="opacity: 0.5;">
                  <T id="main.unnamed" />
                </span>
              {/if}
            </p>
          </div>
        {/each}
      {:else}
        <Center faded>
          <T id="empty.events" />
        </Center>
      {/if}
    </div>
  </div>
  <Button
    on:click={() => {
      createNew = true
      resetEdit()
    }}
    dark
    center
  >
    <Icon id="add" right />
    <T id="new.event" />
  </Button>
{/if}

<style>
  .main {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    height: 100%;
    padding: 10px;
  }

  .date {
    color: var(--secondary);
    font-size: 1.6em;
    display: flex;
    justify-content: center;
    font-weight: bold;
    white-space: nowrap;
    margin-bottom: 10px;
  }

  .scroll {
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    /* gap: 5px; */
  }

  .event {
    background-color: var(--primary-darker);
    padding: 10px;
    display: flex;
    cursor: pointer;
  }
  .event:hover {
    background-color: var(--hover);
  }

  .time {
    padding-right: 10px;
    color: var(--text);
    opacity: 0.9;
    white-space: nowrap;
  }

  /* create */

  input[type="date"],
  input[type="time"] {
    background-color: var(--primary-darker);
    color: inherit;
    width: 100%;
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
</style>
