<script lang="ts">
  import { onMount } from "svelte"
  import { uid } from "uid"
  import type { Event } from "../../../../types/Calendar"
  import { activeDays, activePopup, dictionary, eventEdit, events } from "../../../stores"
  import { history } from "../../helpers/history"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import { changeTime } from "../../helpers/time"
  import Button from "../../inputs/Button.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import Color from "../../inputs/Color.svelte"
  import Dropdown from "../../inputs/Dropdown.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import TextInput from "../../inputs/TextInput.svelte"

  let stored: string = ""
  interface EventWithData extends Event {
    id: string
    repeatData: any
  }
  let editEvent: EventWithData

  onMount(() => {
    if ($eventEdit) edit($events[$eventEdit])
    else resetEdit()
  })

  function edit(event: any) {
    let from: Date = new Date(event.from)
    let to: Date = new Date(event.to)

    // console.log(from)
    // // getISO(from)

    editEvent = { ...event, id: $eventEdit, isoFrom: getISO(from), isoTo: getISO(to), fromTime: getTime(from), toTime: getTime(to) }
    if (!editEvent.repeatData) editEvent.repeatData = defaultRepeatData

    stored = JSON.stringify(editEvent)
  }

  let defaultRepeatData: any = {
    type: "day",
    ending: "date",
    count: 1,
    endingDate: "",
    afterRepeats: 10,
  }

  $: if (selectedType) resetEdit()
  function resetEdit() {
    let selectedDate = new Date($activeDays[0])

    editEvent = {
      type: "event",
      id: uid(),
      name: "",
      color: "#FFFFFF",
      time: true,
      from: "",
      to: "",
      isoFrom: $activeDays.length ? getISO(selectedDate) : "",
      isoTo: $activeDays.length ? getISO(selectedDate) : "",
      fromTime: "11:00",
      toTime: "13:00",
      location: "",
      repeat: false,
      repeatData: defaultRepeatData,
      notes: "",
    }

    let obj: any = { month: selectedDate.getMonth() + 1 }
    if (obj.month > 11) {
      obj = { month: 0, year: selectedDate.getFullYear() + 1 }
    }
    editEvent.repeatData.endingDate = getISO(setDate(selectedDate, obj))

    stored = JSON.stringify(editEvent)
  }

  // const copy = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const getISO = (date: Date) => {
    date = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes())
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
    console.log(date)
    return date.toISOString().substring(0, 10)
  }
  function getTime(date: Date) {
    let h = ("0" + date.getHours()).slice(-2)
    let m = ("0" + date.getMinutes()).slice(-2)
    return h + ":" + m
  }
  const inputChange = (e: any, key: string) => ((editEvent as any)[key] = e.target.value)
  const check = (e: any, key: string) => ((editEvent as any)[key] = e.target.checked)

  function saveAll() {
    // TODO: history
    let { data } = updateEventData()
    if (!data) return

    events.update((a: any) => {
      Object.entries(a).forEach(([eventId, event]: any) => {
        if (event.group === editEvent.group) {
          let newFromTime = changeTime(event.from, data.from).toString()
          let newToTime = changeTime(event.to, data.to).toString()
          a[eventId] = {
            ...data,
            from: newFromTime,
            to: newToTime,
          }
        }
      })
      return a
    })

    // history({ id: "newEvent", newData: { id, data }, oldData })
    activePopup.set(null)
    eventEdit.set(null)
  }

  function save() {
    if (!editEvent.name?.length || stored === JSON.stringify(editEvent)) {
      activePopup.set(null)
      return
    }

    let { data, oldData, id } = updateEventData()
    if (!data) return

    if (data.repeat && !data.group) {
      data.group = id
      createRepeatedEvents(data)
    }
    console.log(id, data)

    history({ id: "newEvent", newData: { id, data }, oldData })
    // activeDays.set([copy(data.from).getTime()])
    activePopup.set(null)
    eventEdit.set(null)
  }

  function updateEventData(): any {
    let data = JSON.parse(JSON.stringify(editEvent))
    let oldData = JSON.parse(stored)
    let id = editEvent.id

    data.from = new Date(editEvent.isoFrom + " " + (editEvent.time ? editEvent.fromTime : ""))
    oldData.from = new Date(oldData.isoFrom + " " + (oldData.time ? oldData.fromTime : ""))
    data.to = new Date(editEvent.isoTo + " " + (editEvent ? editEvent.toTime : ""))
    oldData.to = new Date(oldData.isoTo + " " + (oldData ? oldData.toTime : ""))
    data.type = selectedType.id
    oldData.type = selectedType.id

    console.log(data.from, editEvent.fromTime)

    // to has to be after from
    if (data.to.getTime() - data.from.getTime() <= 0) {
      activePopup.set(null)
      return { data: null, oldData: null, id }
    }

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

    console.log(data)

    return { data, oldData, id }
  }

  function createRepeatedEvents(event: Event) {
    // <!-- REPEAT EVERY: {1-10000}, {day, week, month, year} -->
    // <!-- REPEAT ON: {MO,TH,WE,TH,FR,SA,SU} (if "week") -->
    // <!-- ENDING: {date, after {10} times, never} -->

    let data = event.repeatData!
    let dates: string[][] = []

    let currentFromDate = new Date(event.from)
    let currentToDate = new Date(event.to)
    let endingDate = new Date(data.endingDate || "")
    endingDate = setDate(currentFromDate, { date: endingDate.getDate(), month: endingDate.getMonth(), year: endingDate.getFullYear() })

    const increment = {
      day: () => [currentFromDate.getDate() + Number(data.count), currentToDate.getDate() + Number(data.count)],
      week: () => [currentFromDate.getDate() + 7 * Number(data.count), currentToDate.getDate() + 7 * Number(data.count)],
      month: () => {
        let newMonth: number[] = [currentFromDate.getMonth() + Number(data.count), currentToDate.getMonth() + Number(data.count)]
        if (newMonth[0] > 11) {
          currentFromDate = setDate(currentFromDate, { month: 0, year: currentFromDate.getFullYear() + 1 })
          newMonth[0] = newMonth[0] - 12
        }
        if (newMonth[1] > 11) {
          currentToDate = setDate(currentToDate, { month: 0, year: currentToDate.getFullYear() + 1 })
          newMonth[1] = newMonth[1] - 12
        }
        return newMonth
      },
      year: () => [currentFromDate.getFullYear() + Number(data.count), currentToDate.getFullYear() + Number(data.count)],
    }

    // get dates array
    // TODO: repeat on weekdays...
    if (data.ending === "date") {
      while (currentFromDate.getTime() <= endingDate.getTime()) {
        let incremented = increment[data.type]()
        console.log(currentFromDate, endingDate, data.count, incremented)

        if (data.type === "day" || data.type === "week") {
          currentFromDate.setDate(incremented[0])
          currentToDate.setDate(incremented[1])
        } else {
          currentFromDate = setDate(currentFromDate, { [data.type]: incremented[0] })
          currentToDate = setDate(currentToDate, { [data.type]: incremented[1] })
        }

        if (currentFromDate.getTime() <= endingDate.getTime()) {
          dates.push([currentFromDate.toString(), currentToDate.toString()])
        }
      }
    } else if (data.ending === "after") {
      let count = 0
      while (count < data.afterRepeats!) {
        count++
        let incremented = increment[data.type]()

        if (data.type === "day" || data.type === "week") {
          currentFromDate.setDate(incremented[0])
          currentToDate.setDate(incremented[1])
        } else {
          currentFromDate = setDate(currentFromDate, { [data.type]: incremented[0] })
          currentToDate = setDate(currentToDate, { [data.type]: incremented[1] })
        }

        if (count < data.afterRepeats!) {
          dates.push([currentFromDate.toString(), currentToDate.toString()])
        }
      }
    }

    // create events
    dates.forEach((date: string[]) => {
      let newEvent = JSON.parse(JSON.stringify(event))

      newEvent.from = date[0]
      newEvent.to = date[1]

      history({ id: "newEvent", newData: { id: uid(), data: newEvent } })
    })
  }

  const setDate = (date: Date, options: any): Date => {
    let newDate = [options.year ?? date.getFullYear(), (options.month ?? date.getMonth()) + 1, options.date ?? date.getDate()]
    let time = date.getHours() + ":" + date.getMinutes()
    return new Date([...newDate, time].join(" "))
  }

  const types = [
    { id: "event", name: "$:calendar.event:$" },
    { id: "show", name: "$:calendar.show:$ (TBA)" },
    // { id: "timer", name: "$:calendar.timer:$" },
  ]
  const repeats = [
    { id: "day", name: "$:calendar.day:$" },
    { id: "week", name: "$:calendar.week:$" },
    { id: "month", name: "$:calendar.month:$" },
    { id: "year", name: "$:calendar.year:$" },
  ]

  // "repeat_on": "on",
  // const weekdays = [
  //   { id: "1", name: "$:weekday.1:$" },
  //   { id: "2", name: "$:weekday.2:$" },
  //   { id: "3", name: "$:weekday.3:$" },
  //   { id: "4", name: "$:weekday.4:$" },
  //   { id: "5", name: "$:weekday.5:$" },
  //   { id: "6", name: "$:weekday.6:$" },
  //   { id: "7", name: "$:weekday.7:$" },
  // ]

  // "ending_never": "the end of time",
  const endings = [
    { id: "date", name: "$:calendar.ending_the:$" },
    { id: "after", name: "$:calendar.ending_repeated:$" },
    // { id: "never", name: "$:calendar.ending_never:$" },
  ]

  let selectedType = types[0]

  // // TODO: choose current weekday
  // // TODO: get date 1 month ahead
  // let selectedRepeat = repeats[0]
  // // let selectedWeekday = weekdays[0]
  // let selectedEnding = endings[0]
  // let repeatCount: number = 1
  // let endingDate: string = ""
  // let afterRepeats: number = 10
</script>

<main>
  <div class="sections">
    <section>
      <!-- <span>
        <Icon id="type" size={1.2} right />
        <p><T id="calendar.type" /></p>
      </span> -->
      <Dropdown style="width: 100%;" options={types} value={selectedType.name} on:click={(e) => (selectedType = e.detail)} />
    </section>

    <br />

    {#if selectedType.id === "event"}
      <section>
        <span>
          <Icon id="clock" size={1.2} right />
          <p><T id="calendar.time" /></p>
        </span>
        <Checkbox checked={editEvent.time} on:change={(e) => check(e, "time")} />
      </section>
    {/if}

    <section style="flex-direction: column;align-items: initial;">
      <span>
        <span>
          <input type="date" title={$dictionary.calendar?.from_date} bind:value={editEvent.isoFrom} />
          <!-- TODO: update totime if fromtime is newer -->
          <input type="time" title={$dictionary.calendar?.from_time} bind:value={editEvent.fromTime} disabled={!editEvent.time} />
        </span>
        <p style="padding: 0.5em;display: flex;justify-content: center;">
          <Icon id="next" size={1.5} />
        </p>
        <span>
          <input type="date" title={$dictionary.calendar?.to_date} bind:value={editEvent.isoTo} />
          <input type="time" title={$dictionary.calendar?.to_time} bind:value={editEvent.toTime} disabled={!editEvent.time} />
        </span>
      </span>
    </section>

    <br />

    <section>
      <span>
        <Icon id="loop" size={1.2} right />
        <p><T id="calendar.repeat" /></p>
      </span>
      <Checkbox checked={editEvent.repeat} on:change={(e) => check(e, "repeat")} />
    </section>

    {#if editEvent.repeat}
      <section>
        <span>
          <p><T id="calendar.repeat_every" /></p>
          <NumberInput value={editEvent.repeatData.count} min={1} buttons={false} on:change={(e) => (editEvent.repeatData.count = e.detail)} />
          <Dropdown
            style="width: 100px;"
            options={repeats}
            value={repeats.find((a) => a.id === editEvent.repeatData.type)?.name || ""}
            on:click={(e) => (editEvent.repeatData.type = e.detail.id)}
          />
          <!-- TODO: select weekdays? -->
          <!-- {#if selectedRepeat.id === "week"}
            <p><T id="calendar.repeat_on" /></p>
            <Dropdown style="width: 100px;" options={weekdays} value={selectedWeekday.name} on:click={(e) => (selectedWeekday = e.detail)} />
          {/if} -->
          <p><T id="calendar.repeat_until" /></p>
          <Dropdown
            style="width: 150px;"
            options={endings}
            value={endings.find((a) => a.id === editEvent.repeatData.ending)?.name || ""}
            on:click={(e) => (editEvent.repeatData.ending = e.detail.id)}
          />

          {#if editEvent.repeatData.ending === "date"}
            <input type="date" bind:value={editEvent.repeatData.endingDate} />
          {:else if editEvent.repeatData.ending === "after"}
            <NumberInput value={editEvent.repeatData.afterRepeats} min={1} buttons={false} on:change={(e) => (editEvent.repeatData.afterRepeats = e.detail)} />
            <T id="calendar.ending_times" />
          {/if}
        </span>
      </section>
    {/if}

    <hr />

    {#if selectedType.id === "event"}
      <section>
        <span>
          <Icon id="edit" size={1.2} right />
          <p><T id="calendar.name" /></p>
        </span>
        <TextInput value={editEvent.name} style="width: 50%;" on:input={(e) => inputChange(e, "name")} />
      </section>

      <section>
        <span>
          <Icon id="theme" size={1.2} right />
          <p><T id="calendar.color" /></p>
        </span>
        <Color bind:value={editEvent.color} style="width: 50%;" />
      </section>

      <section>
        <span>
          <Icon id="location" size={1.2} right />
          <p><T id="calendar.location" /></p>
        </span>
        <TextInput value={editEvent.location} style="width: 50%;" on:input={(e) => inputChange(e, "location")} />
      </section>

      <section>
        <span>
          <Icon id="notes" size={1.2} right />
          <p><T id="calendar.notes" /></p>
        </span>
        <TextInput value={editEvent.notes} style="width: 50%;" on:input={(e) => inputChange(e, "notes")} />
      </section>
    {:else if selectedType.id === "show"}
      <!-- TODO: get shows -->
      <Dropdown options={[]} value={"-"} />
    {/if}
    <!-- TODO: timers -->
  </div>
</main>

<hr />

<!-- TODO: save current + save all events -->
<Button on:click={save} disabled={!editEvent.name?.length || stored === JSON.stringify(editEvent)} dark center>
  <Icon id="save" right />
  <T id="actions.save" />
</Button>
{#if editEvent.group}
  <Button on:click={saveAll} disabled={!editEvent.name?.length || stored === JSON.stringify(editEvent)} dark center>
    <Icon id="save" right />
    <T id="calendar.save_all" />
  </Button>
{/if}

<style>
  .sections {
    display: flex;
    flex-direction: column;
  }

  section {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 2px 0;
    justify-content: space-between;
  }

  section span {
    display: flex;
    align-items: center;
    gap: 10px;
    /* padding: 5px 0; */
    /* width: 100%; */
  }

  section :global(.numberInput) {
    width: 50px;
  }

  hr {
    border: none;
    height: 2px;
    margin: 20px 0;
    background-color: var(--primary-lighter);
  }

  input[type="date"],
  input[type="time"] {
    background-color: var(--primary-darker);
    color: inherit;
    /* width: 100%; */
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
