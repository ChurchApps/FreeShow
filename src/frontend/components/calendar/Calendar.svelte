<script lang="ts">
    import { activeDays, activePopup, dictionary, eventEdit, events, popupData } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import { isSameDay } from "./calendar"

    export let active: string | null
    export let searchValue: string = ""

    // WIP search for events
    $: console.log(searchValue)

    let today = new Date()
    $: current = new Date(today.getFullYear(), today.getMonth())
    $: year = current.getFullYear()
    $: month = current.getMonth()
    const MILLISECONDS_IN_A_DAY = 86400000

    // const copy = (date: Date, add: number = 0) => new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + add))
    const copy = (date: Date, add: number = 0) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + add)
    const getDaysInMonth = (year: number, month: number) => new Date(year, getMonthIndex(month), 0).getDate()
    const getMonthIndex = (month: number) => (month + 1 > 12 ? month + 1 : 0)
    const isBetween = (from: Date, to: Date, date: Date) => date >= copy(from) && date <= copy(to)

    activeDays.set([copy(today).getTime()])

    // https://stackoverflow.com/a/6117889
    function getWeekNumber(d: Date) {
        d = copy(d)
        // Set to nearest Thursday: current date + 4 - current day number
        // Make Sunday's day number 7
        // d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
        d.setDate(d.getDate() + 4 - (d.getDay() || 7))
        // Get first day of year
        // let firstDay = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
        let firstDay = new Date(d.getFullYear(), 0, 1)
        // Calculate full weeks to nearest Thursday
        let weekNumber = Math.ceil(((d.getTime() - firstDay.getTime()) / MILLISECONDS_IN_A_DAY + 1) / 7)
        return weekNumber
    }

    let sundayFirstDay: boolean = false

    let days: Date[][] = []
    $: getDays(month)

    function getDays(month: number) {
        let daysList: any = []
        for (let i = 1; i <= getDaysInMonth(year, month); i++) daysList.push(new Date(year, month, i))

        let before: Date[] = getDaysBefore(daysList[0].getDay())

        daysList = [...before, ...daysList]
        days = []

        while (daysList.length < 42) daysList.push(copy(daysList[daysList.length - 1], 1))
        while (daysList.length) days.push(daysList.splice(0, 7))
    }

    function getDaysBefore(firstDay: number): Date[] {
        if (!sundayFirstDay && firstDay < 1 && firstDay <= 1 && firstDay !== 0) return []

        let before: Date[] = []
        let i = (sundayFirstDay ? firstDay : firstDay === 0 ? 6 : firstDay - 1) - 1
        for (i; i >= 0; i--) before.push(new Date(year, month, -i))
        return before
    }

    let currentEvents: any[] = []
    events.subscribe(updateEvents)
    $: if (month) updateEvents($events)

    function updateEvents(events: any) {
        if (!days[0]) return

        currentEvents = []
        let first = days[0][0].getTime()
        let last = days[5][days.length - 1].getTime()

        Object.entries(events).forEach(([id, event]: any) => {
            let from = new Date(event.from).getTime()
            let to = new Date(event.to)?.getTime() || 0
            if (from > first || from < last || to > first || to < last) {
                currentEvents.push({ id, ...event })
            }
        })

        currentEvents = currentEvents.sort((a, b) => a.from - b.from)
    }

    let weekdays: string[] = []
    $: {
        for (let i = 0; i < 7; i++) {
            let index = sundayFirstDay ? (i === 0 ? 7 : i) : i + 1
            weekdays.push($dictionary.weekday?.[index] || "")
        }
    }

    let calendarElem: any
    let nextScrollTimeout: any = null
    function wheel(e: any) {
        if (!calendarElem) return
        if (nextScrollTimeout) return

        // forward
        if (e.deltaY > 0) {
            let bottom = calendarElem.scrollTop + 1 + calendarElem.offsetHeight >= calendarElem.scrollHeight
            if (!bottom) return
            current = new Date(year, month, 33)
            return
        }

        // backward
        let top = calendarElem.scrollTop === 0
        if (!top) return
        current = new Date(year, month, 0)

        // don't start timeout if scrolling with mouse
        if (e.deltaY > 100 || e.deltaY < -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    function getEvents(day: Date, currentEvents: any[], type: string) {
        let events: any[] = []
        currentEvents.forEach((a) => {
            if (a.to ? isBetween(new Date(a.from), new Date(a.to), copy(day)) : isSameDay(new Date(a.from), day)) events.push(a)
        })
        events.sort((a, b) => new Date(a.from).getTime() - new Date(b.from).getTime())
        events = events.filter((a) => a.type === type)
        return events
    }

    function dayClick(e: any, day: Date) {
        day = copy(day)

        if (e.ctrlKey || e.metaKey) {
            // TODO: clicking after creation will add duplicate
            activeDays.update((a) => {
                if (a.includes(day.getTime())) {
                    if (a.length > 1) a.splice(a.indexOf(day.getTime()), 1)
                } else a.push(day.getTime())
                return a
            })
            return
        }

        if (e.shiftKey) {
            let first = $activeDays[0] || day.getTime()
            let last = day.getTime()

            let timeDifference = day.getTime() - first
            if (timeDifference === 0) return
            if (timeDifference < 0) {
                first = last
                last = $activeDays[$activeDays.length - 1]
            }

            let temp: number[] = []
            let count = 0

            do {
                console.log(temp[temp.length - 1], new Date(last), isSameDay(new Date(temp[temp.length - 1]), new Date(last)))

                let time = copy(new Date(first + count * MILLISECONDS_IN_A_DAY)).getTime()
                temp.push(time)
                count++
            } while (!isSameDay(new Date(temp[temp.length - 1]), new Date(last)))

            console.log(temp)
            activeDays.set(temp)

            setTimeout(() => {
                console.log($activeDays)
            })
            return
        }

        activeDays.set([day.getTime()])
    }

    function move(e: any, day: Date) {
        if (e.buttons) activeDays.set([...new Set([...$activeDays, copy(day).getTime()])])
    }

    // listen for update
    $: if ($popupData?.action === "select_show" && $popupData?.location === "event" && $popupData?.id) selectedShow()
    function selectedShow() {
        console.log($popupData, $eventEdit)

        // let animation finish
        setTimeout(() => {
            activePopup.set("edit_event")
        }, 300)
    }
</script>

<div class="calendar">
    <div class="week" style="flex: 1;">
        <div class="weekday" style="min-width: 25px;flex: 1;padding: 0;">
            <Button
                on:click={() => {
                    current = today
                    activeDays.set([copy(today).getTime()])
                }}
                active={!!$activeDays.length && isSameDay(new Date($activeDays[0]), today) && current.getMonth() === new Date($activeDays[0]).getMonth() && current.getFullYear() === new Date($activeDays[0]).getFullYear()}
                title={$dictionary.calendar?.today}
                style="width: 100%;height: 100%;padding: 0;"
                center
            >
                <Icon id="calendar" />
            </Button>
        </div>
        {#each weekdays as weekday}
            <div class="weekday">
                {weekday}
                <!-- {weekday.slice(0, 3)} -->
            </div>
        {/each}
    </div>
    <div class="grid" on:wheel={wheel} bind:this={calendarElem}>
        {#each days as week}
            <div class="week">
                <span class="weeknumber">
                    {getWeekNumber(week[0])}
                </span>
                {#each week as day}
                    {@const dayEvents = getEvents(day, currentEvents, active || "event")}
                    <div
                        class="day"
                        class:today={isSameDay(day, today)}
                        class:faded={day.getMonth() !== month || day.getFullYear() !== year}
                        class:active={$activeDays.includes(copy(day).getTime())}
                        on:mousedown={(e) => dayClick(e, day)}
                        on:mousemove={(e) => move(e, day)}
                    >
                        <!-- // isSameDay(day, new Date($activeDays[0]))} -->
                        <span style="font-size: 1.5em;font-weight: bold;">{day.getDate()}</span>
                        <span class="events">
                            {#each dayEvents as event, i}
                                {#if dayEvents.length > 3 && i > 1}
                                    <span class="dot" style="background-color: {event.color || 'white'}" title={event.name} />
                                {:else}
                                    <div class="event" style="color: {event.color || 'white'}" title={event.name}>
                                        <Icon id={event.type === "event" ? "calendar" : event.type} right white />
                                        <p>{event.name}</p>
                                    </div>
                                {/if}
                            {/each}
                        </span>
                    </div>
                {/each}
            </div>
        {/each}
    </div>
    <div class="bottom">
        <span style="opacity: 0.8;min-width: 150px;text-transform: capitalize;white-space: nowrap;align-self: center;padding: 0 10px;">
            {$dictionary.month?.[current.getMonth() + 1]}
            {current.getFullYear()}
        </span>

        <div class="seperator" />

        <Button
            style="flex: 1;"
            on:click={() => {
                eventEdit.set(null)
                activePopup.set("edit_event")
            }}
            center
        >
            <Icon id="add" right />
            <T id="new.event" />
        </Button>

        <div class="seperator" />

        <Button style="width: 75px;" on:click={() => (current = new Date(year, month, 0))} center>
            <Icon id="previous" size={1.1} />
        </Button>
        <Button style="width: 75px;" on:click={() => (current = new Date(year, month, 33))} center>
            <Icon id="next" size={1.1} />
        </Button>
    </div>
</div>

<style>
    .calendar {
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        overflow-y: auto;
    }

    .grid {
        flex: 10;
        display: flex;
        flex-direction: column;

        overflow: auto;
    }

    .week {
        display: flex;
        flex: 2;
        justify-content: space-between;
    }

    .day,
    .weekday {
        padding: 5px;
        flex: 4;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .weekday {
        overflow: hidden;
        text-transform: capitalize;
        background-color: var(--primary-darkest);
    }

    .weeknumber {
        min-width: 25px;
        font-size: 0.8em;
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
        /* flex: 3; */
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
    }

    .event {
        padding: 2px 5px;
        text-align: center;
        width: 100%;
        display: flex;
        align-items: center;
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
        justify-content: space-between;
        background-color: var(--primary-darkest);
    }

    .seperator {
        width: 3px;
        height: 100%;
        background-color: var(--primary-lighter);
    }
</style>
