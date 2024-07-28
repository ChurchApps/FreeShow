<script lang="ts">
    import { onMount } from "svelte"
    import { uid } from "uid"
    import type { Timer } from "../../../../types/Show"
    import { activePopup, dictionary, events, timers } from "../../../stores"
    import { getTimer } from "../../drawer/timers/timers"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { deselect, getSelected } from "../../helpers/select"
    import { secondsToTime } from "../../helpers/time"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Color from "../../inputs/Color.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import { getDateString } from "../../drawer/calendar/calendar"

    const defaultName = "Counter"
    let currentTimer = getSelected("timer", 0)
    let timer: Timer = {
        type: "counter",
        name: defaultName,
        start: 300,
        end: 0,
        event: "",
        time: "12:00",
    }
    $: if (currentTimer?.id) {
        timer = getTimer(currentTimer)
        deselect()
    }

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
        eventList = eventList.sort((a, b) => (new Date(a).getTime() > new Date(b).getTime() ? -1 : 1))
        timer.event = eventList[0]?.id || ""

        // set unique timer name
        if (timer.name === defaultName && !currentTimer?.id) {
            let count = 1
            while (Object.values($timers).find((a) => a.name === defaultName + (count > 1 ? ` ${count}` : ""))) {
                count++
            }
            timer.name = defaultName + (count > 1 ? ` ${count}` : "")
        }
    })

    const addEvent = ([id, event]: any) => {
        if (new Date(event.from).getTime() > today.getTime()) eventList.push({ id, name: `${getDateString(new Date(event.from))}: ${event.name}`, date: event.from })
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

    function toggleOverflow(e: any) {
        timer.overflow = e.target.checked
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
        let id: string = currentTimer.id
        let newTimer: any = getNewTimer()

        timers.update((a) => {
            a[id] = newTimer
            return a
        })

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

        if (timer.overflow) {
            newTimer.overflow = timer.overflow
            newTimer.overflowColor = timer.overflowColor
        }

        return newTimer
    }
</script>

{#if !currentTimer?.id}
    <CombinedInput>
        <Dropdown style="width: 100%;" {options} value={currentOption.name} on:click={(e) => (timer.type = e.detail.id)} />
    </CombinedInput>
{/if}

<CombinedInput>
    <p><T id="inputs.name" /></p>
    <TextInput value={timer.name} on:change={changeName} />
</CombinedInput>

{#if timer.type === "counter"}
    <CombinedInput style="margin-top: 10px;">
        <p>
            <T id="timer.from" />
            <span style="opacity: 0.7;font-size: 0.9em;display: flex;align-items: center;padding: 0 10px;">(<T id="timer.seconds" />)</span>
        </p>
        <NumberInput value={timer.start === undefined ? 300 : timer.start} max={60 * 60 * 24 * 365} on:change={(e) => (timer.start = e.detail)} />
    </CombinedInput>
    <CombinedInput>
        <p>
            <T id="timer.to" />
            <span style="opacity: 0.7;font-size: 0.9em;display: flex;align-items: center;padding: 0 10px;">(<T id="timer.seconds" />)</span>
        </p>
        <NumberInput value={timer.end === undefined ? 0 : timer.end} max={60 * 60 * 24 * 365} on:change={(e) => (timer.end = e.detail)} />
    </CombinedInput>

    <CombinedInput>
        <p><T id="timer.overflow" /></p>
        <div class="alignRight">
            <Checkbox checked={timer.overflow} on:change={toggleOverflow} />
        </div>
    </CombinedInput>
    {#if timer.overflow}
        <CombinedInput>
            <p><T id="timer.overflow_color" /></p>
            <Color style="width: 30%;" value={timer.overflowColor || "red"} on:input={(e) => (timer.overflowColor = e.detail)} />
        </CombinedInput>
    {/if}

    <CombinedInput style="margin-top: 10px;">
        <p><T id="timer.preview" /></p>
        <div style="padding: 0 10px;display: flex;align-items: center;">
            {#if Number(fromTime.d)}{fromTime.d},
            {/if}{#if Number(fromTime.h)}{fromTime.h}:{/if}{fromTime.m}:{fromTime.s}
            <Icon id="next" />
            {#if Number(toTime.d)}{toTime.d},
            {/if}{#if Number(toTime.h)}{toTime.h}:{/if}{toTime.m}:{toTime.s}
        </div>
    </CombinedInput>
{:else if timer.type === "clock"}
    <CombinedInput style="margin-top: 10px;">
        <p><T id="timer.clock" /></p>
        <!-- <Date value={to} on:change={(e) => (to = e.detail)} />x -->
        <input type="time" bind:value={timer.time} />
    </CombinedInput>

    <CombinedInput>
        <p><T id="timer.overflow" /></p>
        <div class="alignRight">
            <Checkbox checked={timer.overflow} on:change={toggleOverflow} />
        </div>
    </CombinedInput>
    {#if timer.overflow}
        <CombinedInput>
            <p><T id="timer.overflow_color" /></p>
            <Color style="width: 30%;" value={timer.overflowColor || "red"} on:input={(e) => (timer.overflowColor = e.detail)} />
        </CombinedInput>
    {/if}

    <CombinedInput style="margin-top: 10px;">
        <p><T id="timer.preview" /></p>
        <div style="padding: 0 10px;display: flex;align-items: center;">
            {#if Number(timeCountdownTime.d)}{timeCountdownTime.d},
            {/if}{#if Number(timeCountdownTime.h)}{timeCountdownTime.h}:{/if}{timeCountdownTime.m}:{timeCountdownTime.s}
        </div>
    </CombinedInput>
{:else if timer.type === "event"}
    <CombinedInput style="margin-top: 10px;">
        <p><T id="timer.event" /></p>
        {#if eventList.length}
            <Dropdown options={eventList} activeId={timer.event} value={eventList.find((a) => a.id === timer.event)?.name || "—"} on:click={updateEvent} />
        {:else}
            <div style="padding: 0 10px;display: flex;align-items: center;"><T id="timer.no_events" /></div>
        {/if}
    </CombinedInput>

    <CombinedInput>
        <p><T id="timer.overflow" /></p>
        <div class="alignRight">
            <Checkbox checked={timer.overflow} on:change={toggleOverflow} />
        </div>
    </CombinedInput>
    {#if timer.overflow}
        <CombinedInput>
            <p><T id="timer.overflow_color" /></p>
            <Color style="width: 30%;" value={timer.overflowColor || "red"} on:input={(e) => (timer.overflowColor = e.detail)} />
        </CombinedInput>
    {/if}

    <CombinedInput style="margin-top: 10px;">
        <p><T id="timer.preview" /></p>
        <div style="padding: 0 10px;display: flex;align-items: center;">
            {#if Number(eventCountdown.d)}{eventCountdown.d},
            {/if}{#if Number(eventCountdown.h)}{eventCountdown.h}:{/if}{eventCountdown.m}:{eventCountdown.s}
        </div>
    </CombinedInput>
{/if}

<CombinedInput>
    <Button style="width: 100%;" center dark on:click={() => (currentTimer?.id ? editTimer() : createTimer())}>
        <Icon id="timer" right />
        {#if currentTimer?.id}
            <T id="timer.edit" />
        {:else}
            <T id="timer.create" />
        {/if}
    </Button>
</CombinedInput>

<style>
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

    /* WIP this is global regardless of timers */
    :global(.dropdown) {
        position: absolute !important;
        width: 100%;
    }
</style>
