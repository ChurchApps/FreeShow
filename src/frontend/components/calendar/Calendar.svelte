<script lang="ts">
  import { activeDays, dictionary, events } from "../../stores"
  import Icon from "../helpers/Icon.svelte"
  import Button from "../inputs/Button.svelte"

  const copy = (date: Date, add: number = 0) => new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + add))
  const getDaysInMonth = (year: number, month: number) => new Date(year, getMonthIndex(month), 0).getDate()
  const getMonthIndex = (month: number) => (month + 1 > 12 ? month + 1 : 0)
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const isBetween = (from: Date, to: Date, date: Date) => date >= copy(from) && date <= copy(to)

  let today = new Date()
  activeDays.set([copy(today).getTime()])
  $: current = new Date(today.getFullYear(), today.getMonth())
  $: year = current.getFullYear()
  $: month = current.getMonth()

  // $: week = getWeekNumber(current)
  // console.log(week);
  // https://stackoverflow.com/a/6117889
  function getWeekNumber(d: Date) {
    d = copy(d)
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
    // Get first day of year
    let firstDay = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    // Calculate full weeks to nearest Thursday
    let weekNumber = Math.ceil(((d.getTime() - firstDay.getTime()) / 86400000 + 1) / 7)
    return weekNumber
  }

  let sundayFirstDay: boolean = false

  let days: Date[][] = []
  $: {
    let d: any = []
    for (let i = 1; i <= getDaysInMonth(year, month); i++) {
      d.push(new Date(year, month, i))
    }
    let day = d[0].getDay()
    let before: Date[] = []
    if ((sundayFirstDay && day > 0) || day > 1 || day === 0) {
      let add = sundayFirstDay ? day : day === 0 ? 6 : day - 1
      for (let i = add - 1; i >= 0; i--) {
        before.push(new Date(year, month, -i))
      }
    }
    d = [...before, ...d]
    while (d.length < 42) d.push(copy(d[d.length - 1], 1))
    days = []
    while (d.length) days.push(d.splice(0, 7))
    console.log(days)
  }
  console.log(today)

  let currentEvents: any[] = []
  $: {
    currentEvents = []
    let first = days[0][0].getTime()
    let last = days[5][days.length - 1].getTime()
    Object.entries($events).forEach(([id, a]) => {
      let from = a.from.getTime()
      let to = a.to?.getTime() || 0
      if (from > first || from < last || to > first || to < last) {
        // if (from > first && from < last || to > first && to < last) {
        currentEvents.push({ id, ...a })
      }
    })

    // sort
    currentEvents = currentEvents.sort((a, b) => a.from - b.from)
    console.log(currentEvents)
  }

  let weekdays: string[] = []
  $: {
    for (let i = 0; i < 7; i++) {
      let index = sundayFirstDay ? (i === 0 ? 7 : i) : i + 1
      weekdays.push($dictionary.weekday[index])
    }
  }

  function wheel(e: any) {
    if (e.deltaY < 0) current = new Date(year, month, 0)
    else current = new Date(year, month, 33)
  }

  function getEvents(day: Date, currentEvents: any[]) {
    let e: any[] = []
    currentEvents.forEach((a) => {
      if (a.to ? isBetween(a.from, a.to, copy(day)) : sameDay(a.from, day)) e.push(a)
    })
    return e
  }

  function dayClick(e: any, day: Date) {
    day = copy(day)
    if (e.ctrlKey) {
      activeDays.update((a) => {
        if (a.includes(day.getTime())) {
          if (a.length > 1) a.splice(a.indexOf(day.getTime()), 1)
        } else a.push(day.getTime())
        return a
      })
    } else if (e.shiftKey) {
      let first = $activeDays[0] || day.getTime()
      let last = day.getTime()
      if (day.getTime() - first < 0) {
        first = last
        last = $activeDays[$activeDays.length - 1]
      }
      let temp = []
      let count = 0
      do {
        temp.push(first + count * 86400000)
        console.log(new Date(temp[temp.length - 1]), new Date(last))
        count++
      } while (!sameDay(new Date(temp[temp.length - 1]), new Date(last)))
      activeDays.set(temp)
    } else activeDays.set([day.getTime()])
  }

  function move(e: any, day: Date) {
    if (e.buttons) activeDays.set([...new Set([...$activeDays, copy(day).getTime()])])
  }
</script>

<div class="calendar" on:wheel={wheel}>
  <div class="week" style="flex: 1;">
    <div class="weekday" style="flex: 1;padding: 0;">
      <Button
        on:click={() => {
          current = today
          activeDays.set([today.getTime()])
        }}
        active={!!$activeDays.length ||
          !sameDay(new Date($activeDays[0]), today) ||
          current.getMonth() !== new Date($activeDays[0]).getMonth() ||
          current.getFullYear() !== new Date($activeDays[0]).getFullYear()}
        title="[[[Today]]]"
        style="width: 100%;height: 100%;"
        center
      >
        <Icon id="calendar" />
      </Button>
    </div>
    {#each weekdays as weekday}
      <div class="weekday">
        {weekday.slice(0, 3)}
      </div>
    {/each}
  </div>
  <div class="grid">
    {#each days as week}
      <div class="week">
        <span class="weeknumber">
          {getWeekNumber(week[0])}
        </span>
        {#each week as day}
          <div
            class="day"
            class:today={sameDay(day, today)}
            class:faded={day.getMonth() !== month || day.getFullYear() !== year}
            class:active={$activeDays.includes(copy(day).getTime())}
            on:mousedown={(e) => dayClick(e, day)}
            on:mousemove={(e) => move(e, day)}
          >
            <!-- // sameDay(day, new Date($activeDays[0]))} -->
            <span style="font-size: 2em;font-weight: bold;">{day.getDate()}</span>
            <span class="events">
              {#each getEvents(day, currentEvents) as event, i}
                {#if i >= 3}
                  <span class="dot" style="background-color: {event.color || 'unset'}" title={event.name} />
                {:else}
                  <p class="event" style="color: {event.color || 'unset'}" title={event.name}>
                    {event.name}
                  </p>
                {/if}
              {/each}
            </span>
          </div>
        {/each}
      </div>
    {/each}
  </div>
  <div class="bottom">
    <Button style="flex: 1;" on:click={() => (current = new Date(year, month, 0))} center>
      <Icon id="previous" />
    </Button>
    <span style="text-transform: capitalize;align-self: center;padding: 0 10px;">
      {$dictionary.month[current.getMonth() + 1]}
      {current.getFullYear()}
    </span>
    <Button style="flex: 1;" on:click={() => (current = new Date(year, month, 33))} center>
      <Icon id="next" />
    </Button>
  </div>
</div>

<style>
  .calendar {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .grid {
    flex: 10;
    display: flex;
    flex-direction: column;
  }

  .week {
    display: flex;
    flex: 2;
    justify-content: space-between;
  }

  .day,
  .weekday {
    padding: 10px;
    flex: 3;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .weekday {
    text-transform: capitalize;
    background-color: var(--primary-darkest);
  }

  .weeknumber {
    flex: 1;
    color: var(--secondary);
    background-color: var(--primary-darkest);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .day {
    flex-direction: column;
    overflow: hidden;
  }
  .day:hover {
    background-color: var(--hover);
  }

  .day.faded {
    opacity: 0.5;
  }
  .day.today {
    color: var(--secondary);
    background-color: var(--primary-darkest);
  }
  .day.active {
    background-color: var(--focus);
  }

  .events {
    flex: 3;
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
  }

  .event {
    padding: 5px 10px;
    text-align: center;
    width: 100%;
  }
  .dot {
    display: flex;
    height: 10px;
    width: 10px;
    border-radius: 50%;
    margin: 2px;
  }

  .bottom {
    display: flex;
    background-color: var(--primary-darkest);
  }
</style>
