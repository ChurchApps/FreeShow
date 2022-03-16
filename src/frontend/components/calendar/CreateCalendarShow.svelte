<script lang="ts">
  import { uid } from "uid"
  import { ShowObj } from "../../classes/Show"
  import { activeDays, activeProject, dictionary, events } from "../../stores"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import { checkName } from "../helpers/show"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import Center from "../system/Center.svelte"

  const copy = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  // const isBetween = (from: Date, to: Date, date: Date) => date >= copy(from) && date <= copy(to)

  let currentEvents: any[] = []
  activeDays.subscribe(updateEvents)

  function updateEvents() {
    let temp: any[] = []
    if ($activeDays.length) {
      $activeDays.forEach((day: number) => {
        temp.push({ date: day, events: [] })
        let thisDay = new Date(day)
        Object.entries($events).forEach(([id, a]) => {
          if (sameDay(new Date(a.from), copy(thisDay))) {
            if (sameDay(new Date(a.to), copy(thisDay))) temp[temp.length - 1].events.push({ id, ...a })
            else temp.push({ date: day, events: [{ id, ...a }] })
          }
          // if (isBetween(a.from, a.to, copy(thisDay))) temp[temp.length - 1].push({ id, ...a })
        })
        // else temp[temp.length - 1] = temp[temp.length - 1].sort((a: any, b: any) => a.from - b.from)
      })
    }

    // sort
    // TODO: sort
    currentEvents = temp.filter((a) => a.events.length).sort((a, b) => a.date - b.date)
    console.log(currentEvents)
  }

  $: sortedDays = $activeDays.sort((a, b) => a - b)
  $: from = new Date(sortedDays[0])
  $: to = new Date(sortedDays[sortedDays.length - 1])

  function createShow() {
    let newData = createSlides()
    history({ id: "newShow", newData, location: { page: "show", project: $activeProject || undefined } })
  }

  function createSlides() {
    let slides: any = {}
    let layouts: any[] = []
    currentEvents.forEach((day: any) => {
      let id = uid()
      let textDay = new Date(day.date).getDate() + ". " + $dictionary.month[new Date(day.date).getMonth() + 1]
      if (!sameDay(day.events[0].from, day.events[0].to)) {
        if (day.events[0].from.getFullYear() !== day.events[0].to.getFullYear()) textDay += " " + day.events[0].from.getFullYear()
        if (day.events[0].from.getMonth() === day.events[0].to.getMonth() && day.events[0].from.getFullYear() === day.events[0].to.getFullYear()) {
          textDay = new Date(day.date).getDate() + ".-" + day.events[0].to.getDate() + ". " + $dictionary.month[day.events[0].to.getMonth() + 1]
        } else textDay += " - " + day.events[0].to.getDate() + ". " + $dictionary.month[day.events[0].to.getMonth() + 1]
        if (day.events[0].from.getFullYear() !== day.events[0].to.getFullYear()) textDay += " " + day.events[0].to.getFullYear()
      }
      let group: string = textDay
      // only one event or all events have the same color
      let color: any = day.events.length === 1 || [...new Set(day.events.map((a: any) => a.color))].length === 1 ? day.events[0].color : null

      // TODO: event over multiple days!!

      // let duration = 6 + Math.floor(day.events.length * 0.75)
      let totalLength: number = 0

      // TODO: align clocks (another font?)
      let values: any[][] = [[{ value: textDay, style: "font-weight: bold;" }], [{ value: "", style: "font-size:30px;" }]]
      day.events
        .sort((a: any, b: any) => a.from - b.from)
        .forEach((event: any) => {
          let v: any[] = []
          if (event.time) {
            let time = getTime(event.from)
            // TODO: event.to (if days are different?)
            // if (event.to.getTime() - event.from.getTime() > 0) time += " - " + getTime(event.to)
            v.push({ value: time + " ", style: "font-weight: bold;font-size:70px;font-family:calibri;" })
          }
          v.push({ value: event.name, style: "font-size:80px;" })
          if (event.location) v.push({ value: " - " + event.location, style: "font-size:80px;font-style:italic;" })
          if (event.notes) v[v.length - 1].value += ":"
          values.push(v)
          if (event.notes) values.push([{ value: "&nbsp;&nbsp;&nbsp;&nbsp;" + event.notes, style: "font-size:80px;" }])
          values.push([{ value: "", style: "font-size:80px;" }])
          totalLength += event.name.length + event.location.length + event.notes.length
        })
      let items: any[] = [
        {
          // TODO: use template!!
          style: "left:100px;top:120px;width:1770px;height:840px;",
          align: "",
          lines: values.map((a) => ({ align: "text-align:left;", text: a })),
        },
      ]

      slides[id] = { group, color, settings: {}, notes: "", items }
      let l: any = { id }
      if (currentEvents.length > 1) {
        let duration = totalLength < 25 ? Math.max(5, totalLength * 0.6) : totalLength < 80 ? Math.max(10, totalLength * 0.3) : Math.max(25, totalLength * 0.2)
        l.transition = { duration: Math.min(60, Math.floor(duration)) }
      }
      layouts.push(l)
    })
    if (currentEvents.length > 1) layouts[layouts.length - 1].end = true

    let layoutID = uid()
    let show = new ShowObj(true, "event", layoutID)
    // TODO: week?
    show.name = getDateString(from)
    if (sortedDays[0] - sortedDays[1] < 0) show.name += " - " + getDateString(to)
    show.name = checkName(show.name)
    show.slides = slides
    show.layouts = { [layoutID]: { name: "", notes: "", slides: layouts } }
    return { show }
  }

  const getDateString = (date: Date) => {
    let d = ("0" + date.getDate()).slice(-2)
    let m = ("0" + (date.getMonth() + 1)).slice(-2)
    let y = date.getFullYear().toString().slice(-2)
    return d + "." + m + "." + y
  }

  function getTime(date: Date) {
    let h = ("0" + date.getHours()).slice(-2)
    let m = ("0" + date.getMinutes()).slice(-2)
    return h + ":" + m
  }
</script>

<div class="main border">
  <span>
    {from.getDate()}. {$dictionary.month[from.getMonth() + 1]}
    {from.getFullYear()}
    {#if sortedDays[0] - sortedDays[1] < 0}
      - {to.getDate()}. {$dictionary.month[to.getMonth() + 1]}
      {to.getFullYear()}
    {/if}
  </span>
  {#if currentEvents.length}
    {#each currentEvents as day}
      <p>{new Date(day.date).getDate()}. {$dictionary.month[new Date(day.date).getMonth() + 1]}</p>
      {#each day.events as event}
        <div class="event" style="color: {event.color || 'unset'}">
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
    {/each}
  {:else}
    <Center faded>
      <T id="empty.events" />
    </Center>
  {/if}
</div>
<Button on:click={createShow} dark center>
  <Icon id="show" right />
  <T id="new.show" />
</Button>

<style>
  .main {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    height: 100%;
    padding: 10px;
  }
</style>
