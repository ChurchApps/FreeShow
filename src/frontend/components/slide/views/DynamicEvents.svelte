<script lang="ts">
    import { onMount } from "svelte"
    import { activeDrawerTab, drawer, drawerTabsData, events } from "../../../stores"
    import { getTime } from "../../calendar/calendar"
    import { keysToID, sortByTime } from "../../helpers/array"
    import { combineDateAndTime } from "../../helpers/time"

    export let edit: boolean = false
    export let textSize: number = 80

    export let maxEvents: number = 5
    export let startDaysFromToday: number = 0
    export let justOneDay: boolean = false
    export let enableStartDate: boolean = false
    export let startDate: string = ""
    export let startTime: string = "00:00"

    let filteredEvents: any[] = []

    // update every 10 seconds
    const UPDATE_INTERVAL = 10 * 1000
    onMount(startCounter)
    function startCounter() {
        setTimeout(() => {
            updateEvents()

            startCounter()
        }, UPDATE_INTERVAL)
    }

    $: [updateEvents(), $events, maxEvents, startDaysFromToday, justOneDay, enableStartDate, startDate, startTime]

    function updateEvents() {
        let startFromDate = enableStartDate ? combineDateAndTime(startDate, startTime) : getXDaysFromToday(startDaysFromToday)
        let eventsList = keysToID($events).filter((a) => a.type === "event" && new Date(a.to) >= startFromDate)

        if (justOneDay) {
            let tomorrow = new Date(startFromDate).setHours(24, 0, 0, 0)
            eventsList = eventsList.filter((a) => new Date(a.from).getTime() <= tomorrow)
        }

        eventsList = eventsList.sort(sortByTime)
        filteredEvents = maxEvents ? eventsList.slice(0, maxEvents) : eventsList
    }

    function getXDaysFromToday(startDaysFromToday: number = 0) {
        let date = new Date()
        if (startDaysFromToday) date.setHours(0, 0, 0, 0)
        date.setDate(date.getDate() + startDaysFromToday)
        return date
    }

    // calendar.ts createSlides()
    function getEventElement(event: any, textSize: number = 80) {
        let html = "<p>"

        if (event.time) {
            let time = getTime(new Date(event.from))
            html += `<span style="font-weight: bold;font-size:${textSize * 0.8}px;font-family:Arial;">${time} </span>`
        }
        html += `<span style="font-size:${textSize}px;">${event.name}`
        if (event.location) html += `<span style="font-size:${textSize * 0.9}px;font-style:italic;"> - ${event.location}`
        if (event.notes) html += ":"
        html += `</span>`
        if (event.location) html += `</span>`

        html += "</p>"
        if (event.notes) html += `<p><span style="font-size:${textSize * 0.8}px;">&nbsp;&nbsp;&nbsp;&nbsp;${event.notes}</span></p>`

        return html
    }

    function openInDrawer() {
        if (!edit) return

        drawerTabsData.update((a) => {
            a.calendar.activeSubTab = "event"
            return a
        })
        activeDrawerTab.set("calendar")

        // open drawer if closed
        if ($drawer.height <= 40) drawer.set({ height: $drawer.stored || 300, stored: null })
    }
</script>

<div class="events" on:dblclick={openInDrawer}>
    {#each filteredEvents as event}
        {#if event.name}
            {@html getEventElement(event, textSize)}
        {/if}
    {/each}
</div>

<style>
    .events {
        text-align: left;
        height: 100%;
        /* line-height: 0.8em; */
    }

    .events :global(p) {
        overflow: unset;
        white-space: unset;
    }
</style>
