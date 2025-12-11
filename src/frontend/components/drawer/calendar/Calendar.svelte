<script lang="ts">
    import { activeDays, activePopup, eventEdit, events, labelsDisabled, popupData, special } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { actionData } from "../../actions/actionData"
    import { removeDuplicates, sortByTime } from "../../helpers/array"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import { MILLISECONDS_IN_A_DAY, copyDate, getDaysInMonth, getWeekNumber, isBetween, isSameDay } from "./calendar"

    export let active: string | null
    export let searchValue = ""

    // WIP search for events
    $: console.log(searchValue)

    $: sundayFirstDay = $special.firstDayOfWeek === "7"

    let today = new Date()
    $: current = new Date(today.getFullYear(), today.getMonth())
    $: year = current.getFullYear()
    $: month = current.getMonth()

    activeDays.set([copyDate(today).getTime()])

    let days: Date[][] = []
    $: getDays(month, sundayFirstDay)

    function getDays(month: number, _updater: any) {
        let daysList: any = []
        for (let i = 1; i <= getDaysInMonth(year, month); i++) daysList.push(new Date(year, month, i))

        let before: Date[] = getDaysBefore(daysList[0].getDay())

        daysList = [...before, ...daysList]
        days = []

        while (daysList.length < 42) daysList.push(copyDate(daysList[daysList.length - 1], 1))
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
    $: updateEvents($events, { month })

    function updateEvents(events: any, _updater: any) {
        if (!days[0]) return

        currentEvents = []
        let first = days[0][0].getTime()
        let last = days[5][days.length - 1].getTime()

        Object.entries(events).forEach(([id, event]: any) => {
            let from = new Date(event.from).getTime()
            let to = new Date(event.to)?.getTime() || 0

            let startOrEndIsInMonth = from > first || from < last || to > first || to < last
            if (startOrEndIsInMonth) currentEvents.push({ id, ...event })
        })

        currentEvents = currentEvents.sort((a, b) => a.from - b.from)
    }

    let weekdays: string[] = []
    $: {
        weekdays = []
        for (let i = 0; i < 7; i++) {
            let index = sundayFirstDay ? (i === 0 ? 7 : i) : i + 1
            weekdays.push(translateText("weekday." + index))
        }
    }

    let calendarElem: HTMLElement | undefined
    let nextScrollTimeout: NodeJS.Timeout | null = null
    function wheel(e: any) {
        if (nextScrollTimeout || !calendarElem) return

        let scrollDown = e.deltaY > 0
        if (scrollDown) nextMonth(true)
        else previousMonth(true)

        let isMouseAndNotTrackpad = e.deltaY >= 100 || e.deltaY <= -100
        if (isMouseAndNotTrackpad) return

        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    function nextMonth(checkScroll = false) {
        if (!calendarElem) return
        let scrolledToBottom = calendarElem.scrollTop + 1 + calendarElem.offsetHeight >= calendarElem.scrollHeight
        if (checkScroll && !scrolledToBottom) return

        current = new Date(year, month, 33)
    }

    function previousMonth(checkScroll = false) {
        let scrolledToTop = calendarElem?.scrollTop === 0
        if (checkScroll && !scrolledToTop) return

        current = new Date(year, month, 0)
    }

    function getEvents(day: Date, currentEvents: any[], type: string) {
        let events: any[] = []
        currentEvents.forEach((a) => {
            let eventIsAtDayOrGoingThrough = a.to ? isBetween(new Date(a.from), new Date(a.to), copyDate(day)) : isSameDay(new Date(a.from), day)
            if (eventIsAtDayOrGoingThrough) events.push(a)
        })
        events.sort(sortByTime)
        events = events.filter((a) => a.type === type)

        return events
    }

    function dayClick(e: any, day: Date) {
        day = copyDate(day)

        if (e.ctrlKey || e.metaKey) return toggleCurrentDay(day)
        if (e.shiftKey) return selectRange(day)

        activeDays.set([day.getTime()])
    }

    function toggleCurrentDay(day: Date) {
        activeDays.update((a) => {
            let alreadySelected = a.includes(day.getTime())
            if (!alreadySelected) return [...a, day.getTime()]

            if (a.length < 2) return a
            a.splice(a.indexOf(day.getTime()), 1)

            return a
        })
    }

    function selectRange(day: Date) {
        let first = $activeDays[0] || day.getTime()
        let last = day.getTime()
        let timeDifference = day.getTime() - first
        if (timeDifference === 0) return

        // invert
        if (timeDifference < 0) {
            first = last
            last = $activeDays[$activeDays.length - 1]
        }

        let newActiveDays: number[] = []
        let count = 0

        do {
            let newDay = copyDate(new Date(first + count * MILLISECONDS_IN_A_DAY)).getTime()
            newActiveDays.push(newDay)
            count++
        } while (!isSameDay(new Date(newActiveDays[newActiveDays.length - 1]), new Date(last)))

        activeDays.set(newActiveDays)
    }

    function move(e: any, day: Date) {
        if (!e.buttons) return
        activeDays.set(removeDuplicates([...$activeDays, copyDate(day).getTime()]))
    }

    // listen for update
    $: if ($popupData?.action === "select_show" && $popupData?.location === "event" && $popupData?.showId) selectedShow()
    function selectedShow() {
        // let animation finish
        setTimeout(() => activePopup.set("edit_event"), 300)
    }

    function getEventIcon(type: string, { actionId }) {
        if (type === "event") return "calendar"
        if (type === "action") return actionData[actionId]?.icon || "actions"
        return type
    }

    $: isPresentDay = !!$activeDays.length && isSameDay(new Date($activeDays[0]), today) && current.getMonth() === new Date($activeDays[0]).getMonth() && current.getFullYear() === new Date($activeDays[0]).getFullYear()
    function setToPresentDay() {
        current = today
        activeDays.set([copyDate(today).getTime()])
    }
</script>

<div class="calendar">
    <div class="week" style="flex: 1;">
        <div class="weekday" style="min-width: 25px;flex: 1;padding: 0;background-color: var(--primary-darker);font-size: 0.9em;opacity: 0.7;font-weight: 600;">
            {current.getFullYear().toString().slice(2)}
        </div>

        {#each weekdays as weekday}
            <div class="weekday">
                {weekday}
                <!-- {weekday.slice(0, 3)} -->
            </div>
        {/each}
    </div>

    <div class="grid" on:wheel|passive={wheel} bind:this={calendarElem}>
        {#each days as week}
            <div class="week">
                <span class="weeknumber">
                    {getWeekNumber(week[0])}
                </span>

                {#each week as day}
                    {@const dayEvents = getEvents(day, currentEvents, active || "event")}
                    <div class="day" class:today={isSameDay(day, today)} class:faded={day.getMonth() !== month || day.getFullYear() !== year} class:active={$activeDays?.includes(copyDate(day).getTime())} on:mousedown={(e) => dayClick(e, day)} on:mousemove={(e) => move(e, day)}>
                        <!-- // isSameDay(day, new Date($activeDays[0]))} -->
                        <span style="font-size: 1.5em;font-weight: 600;">{day.getDate()}</span>
                        <span class="events">
                            {#each dayEvents as event, i}
                                {@const eventIcon = getEventIcon(event.type, { actionId: event.action?.id })}

                                {#if dayEvents.length > 3 && i > 1}
                                    <span class="dot" style="background-color: {event.color || 'white'}" data-title={event.name} />
                                {:else}
                                    <div class="event" style="color: {event.color || 'white'}" data-title={event.name}>
                                        <Icon id={eventIcon} right white />
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
</div>

<FloatingInputs style="margin-left: 25px;" side="left">
    <MaterialButton title="media.previous" on:click={() => previousMonth()}>
        <Icon id="previous" size={1.1} />
    </MaterialButton>
    <MaterialButton title="media.next" on:click={() => nextMonth()}>
        <Icon id="next" size={1.1} />
    </MaterialButton>

    <div class="divider"></div>

    <MaterialButton title="calendar.today" isActive={isPresentDay} on:click={setToPresentDay}>
        <Icon id="home" white={!isPresentDay} size={1.1} />
    </MaterialButton>

    <div class="divider"></div>

    <span style="opacity: 0.8;text-transform: capitalize;white-space: nowrap;align-self: center;padding: 0 10px;">
        {translateText("month." + (current.getMonth() + 1))}
        {current.getFullYear()}
    </span>
</FloatingInputs>

<FloatingInputs onlyOne>
    <MaterialButton
        on:click={() => {
            eventEdit.set(null)
            popupData.set({})
            activePopup.set("edit_event")
        }}
    >
        <Icon id="add" right={!$labelsDisabled} />
        {#if !$labelsDisabled}<T id="new.{active === 'action' ? 'event_action' : 'event'}" />{/if}
    </MaterialButton>
</FloatingInputs>

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
</style>
