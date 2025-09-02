<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import { uid } from "uid"
    import type { Timer } from "../../../../types/Show"
    import { dictionary, events, timers } from "../../../stores"
    import { translate } from "../../../utils/language"
    import { getDateString } from "../../drawer/calendar/calendar"
    import { getTimer } from "../../drawer/timers/timers"
    import T from "../../helpers/T.svelte"
    import { deselect, getSelected } from "../../helpers/select"
    import { secondsToTime } from "../../helpers/time"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialMultiChoice from "../../inputs/MaterialMultiChoice.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    let currentTimer = getSelected("timer", 0)
    let timer: Timer = {
        type: "counter",
        name: "",
        start: 300,
        end: 0,
        event: "",
        time: "12:00"
    }
    $: if (currentTimer?.id) {
        timer = getTimer(currentTimer)
        deselect()
    }

    let chosenType = ""
    const timerTypes: any = [
        { id: "counter", name: translate("timer.from_to"), translate: true, icon: "timer" },
        { id: "clock", name: translate("timer.to_time"), translate: true, icon: "clock" },
        { id: "event", name: translate("timer.to_event"), translate: true, icon: "calendar" }
    ]

    // counter
    $: fromTime = secondsToTime(timer.start === undefined ? 300 : timer.start)
    $: toTime = secondsToTime(timer.end === undefined ? 0 : timer.end)

    // update today
    let today = new Date()
    const interval = setInterval(() => {
        today = new Date()
    }, 1000)
    onDestroy(() => clearInterval(interval))

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
    })

    const addEvent = ([id, event]: any) => {
        if (new Date(event.from).getTime() > today.getTime()) eventList.push({ value: id, label: `${getDateString(new Date(event.from))}: ${event.name}` })
    }

    function updateTime(e: any) {
        timer.time = e.target?.value
    }

    let eventTime: Date
    let eventCountdown: any = { m: "00", s: "00" }
    function updateEvent(e: any) {
        timer.event = e.detail
    }

    $: if (timer.event && eventList.length) {
        eventTime = new Date($events[timer.event].from)
        eventCountdown = secondsToTime(eventTime.getTime() > today.getTime() ? (eventTime.getTime() - today.getTime()) / 1000 : 0)
    }

    let timerNames: any = {
        counter: $dictionary.timer?.counter || "Counter",
        clock: $dictionary.timer?.time || "Time",
        event: $dictionary.timer?.event || "Event"
    }
    $: if (timer.event && eventList.length) updateEventName()
    const updateEventName = () => (timerNames.event = eventList.find((a) => a.id === timer.event)?.name)

    function changeName(e: any) {
        let newName = e.detail

        if (!newName) {
            timer.name = ""
            return
        }

        // set unique timer name
        let count = 1
        while (Object.values($timers).find((a) => a.name === newName + (count > 1 ? ` ${count}` : ""))) {
            count++
        }
        newName = newName + (count > 1 ? ` ${count}` : "")

        timer.name = newName
    }

    // TODO: history

    // auto save edits
    $: if (timer && ((!created && currentTimer?.id) || chosenType)) updateTimer()

    let created = false
    function updateTimer() {
        let id = currentTimer?.id

        const doesNotExist = !id
        if (doesNotExist) {
            // create timer
            id = uid()
            created = true
        }

        timers.update((a) => {
            a[id] = getNewTimer()
            return a
        })

        if (doesNotExist) {
            currentTimer = { id }
        }
    }

    function getNewTimer() {
        let newTimer: Timer = { name: timer.name, type: timer.type }

        // if (!newTimer.name && timer.type) newTimer.name = timerNames[timer.type] || $dictionary.timer?.counter || "Timer"

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
            newTimer.overflowBlink = timer.overflowBlink
            newTimer.overflowBlinkOffset = timer.overflowBlinkOffset
        }

        return newTimer
    }

    function getMinutes(number: number) {
        return Math.floor(number / 60)
    }
    function getSeconds(number: number) {
        return number - getMinutes(number) * 60
    }

    const MAX_MINUTES = 60 * 24 * 30 // 365
</script>

{#if (!currentTimer?.id || created) && !chosenType}
    <MaterialMultiChoice options={timerTypes} on:click={(e) => (chosenType = timer.type = e.detail)} />
{:else}
    {#if created}
        <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (chosenType = "")} />
    {/if}

    <MaterialTextInput label="inputs.name" value={timer.name} on:change={changeName} autoselect={created} />

    {#if timer.type === "counter"}
        <div style="display: flex;gap: 5px;margin: 20px 0;">
            <div class="timerbox">
                <p class="part">
                    <T id="timer.from" />

                    {#if Number(fromTime.h) > 0 || Number(fromTime.d) > 0}
                        <span style="font-weight: normal;opacity: 0.6;font-size: 0.9em;">
                            {#if Number(fromTime.d)}{fromTime.d},
                            {/if}{#if Number(fromTime.h)}{fromTime.h}:{/if}{fromTime.m}:{fromTime.s}
                        </span>
                    {/if}
                </p>

                <div>
                    <MaterialNumberInput label="timer.minutes" value={timer.start === undefined ? 5 : getMinutes(timer.start)} padLength={2} max={MAX_MINUTES} on:change={(e) => (timer.start = getSeconds(timer.start || 0) + Number(e.detail) * 60)} />
                    <span style="padding: 0 10px;font-size: 3em;font-weight: bold;line-height: 1.7;">:</span>
                    <MaterialNumberInput label="timer.seconds" value={timer.start === undefined ? 0 : getSeconds(timer.start)} padLength={2} max={59} on:change={(e) => (timer.start = getMinutes(timer.start ?? 300) * 60 + Number(e.detail))} />
                </div>
            </div>
            <div class="timerbox">
                <p class="part">
                    <T id="timer.to" />

                    {#if Number(toTime.h) > 0 || Number(toTime.d) > 0}
                        <span style="font-weight: normal;opacity: 0.6;font-size: 0.9em;">
                            {#if Number(toTime.d)}{toTime.d},
                            {/if}{#if Number(toTime.h)}{toTime.h}:{/if}{toTime.m}:{toTime.s}
                        </span>
                    {/if}
                </p>

                <div>
                    <MaterialNumberInput label="timer.minutes" value={timer.end === undefined ? 5 : getMinutes(timer.end)} padLength={2} max={MAX_MINUTES} on:change={(e) => (timer.end = getSeconds(timer.end || 0) + Number(e.detail) * 60)} />
                    <span style="padding: 0 10px;font-size: 3em;font-weight: bold;line-height: 1.7;">:</span>
                    <MaterialNumberInput label="timer.seconds" value={timer.end === undefined ? 0 : getSeconds(timer.end)} padLength={2} max={59} on:change={(e) => (timer.end = getMinutes(timer.end ?? 300) * 60 + Number(e.detail))} />
                </div>
            </div>
        </div>
    {:else if timer.type === "clock"}
        <div class="timerbox" style="width: 100%;margin: 20px 0;">
            <p class="part">
                <T id="timer.clock" />

                {#if Number(timeCountdownTime.m) > 0 || Number(timeCountdownTime.s) > 0}
                    <span style="font-weight: normal;opacity: 0.6;font-size: 0.9em;">
                        {#if Number(timeCountdownTime.d)}{timeCountdownTime.d},
                        {/if}{#if Number(timeCountdownTime.h)}{timeCountdownTime.h}:{/if}{timeCountdownTime.m}:{timeCountdownTime.s}
                    </span>
                {/if}
            </p>

            <div>
                <!-- <Date value={to} on:change={(e) => (to = e.detail)} />x -->
                <input type="time" step="2" value={timer.time} on:change={updateTime} />
            </div>
        </div>
    {:else if timer.type === "event"}
        <div class="timerbox" style="width: 100%;margin: 20px 0;overflow: visible;">
            <p style="border: none;min-height: unset;border-radius: 8px;" class="part">
                <T id="timer.to_event" />

                {#if Number(eventCountdown.m) > 0 || Number(eventCountdown.s) > 0}
                    <span style="border: none;min-width: unset;flex: 0;font-weight: normal;display: flex;align-items: center;padding: 0px 10px;opacity: 0.6;font-size: 0.9em;">
                        {#if Number(eventCountdown.d)}{eventCountdown.d},
                        {/if}{#if Number(eventCountdown.h)}{eventCountdown.h}:{/if}{eventCountdown.m}:{eventCountdown.s}
                    </span>
                {/if}
            </p>

            {#if eventList.length}
                <div>
                    <MaterialDropdown label="timer.event" style="width: 100%;" options={eventList} value={timer.event || ""} on:change={updateEvent} />
                </div>
            {:else}
                <div style="padding: 10px;display: flex;align-items: center;opacity: 0.5;"><T id="timer.no_events" /></div>
            {/if}
        </div>
    {/if}

    <InputRow arrow>
        <MaterialToggleSwitch label="timer.overflow" style="width: 100%;" checked={timer.overflow} defaultValue={false} on:change={(e) => (timer.overflow = e.detail)} />

        <div slot="menu">
            <MaterialColorInput label="timer.overflow_color" disabled={!timer.overflow} value={timer.overflowColor || "#FF4136"} defaultValue="#FF4136" on:input={(e) => (timer.overflowColor = e.detail)} />

            <MaterialToggleSwitch label="timer.overflow_blink" disabled={!timer.overflow} checked={timer.overflowBlink} defaultValue={false} on:change={(e) => (timer.overflowBlink = e.detail)} />
            {#if timer.overflowBlink}
                <!-- conditions.seconds -->
                <MaterialNumberInput
                    label="timer.overflow_blink_offset"
                    disabled={!timer.overflow}
                    value={timer.overflowBlinkOffset || 0}
                    defaultValue={0}
                    max={Math.abs((timer.start ?? 300) - (timer.end || 0))}
                    on:change={(e) => (timer.overflowBlinkOffset = e.detail)}
                />
            {/if}
        </div>
    </InputRow>
{/if}

<style>
    .timerbox {
        display: flex;
        flex-direction: column;
        width: 50%;

        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);

        border-radius: 8px;
        overflow: hidden;
    }
    .timerbox div {
        display: flex;
        justify-content: center;
        padding: 15px;
    }

    .timerbox :global(.textfield:not(:has(.dropdown-trigger))) {
        width: 140px;
        height: 100px;
    }
    .timerbox :global(input) {
        width: 140px;
        height: 100px;

        font-size: 3.5em !important;

        text-align: center;
        padding-right: 0.5rem !important;
    }

    .part {
        width: 100%;
        padding: 5px 10px;
        /* justify-content: center; */
        font-size: 0.8em;
        font-weight: bold;

        border: none;
        min-height: unset;

        background-color: var(--primary-darkest);
        border-bottom: 1px solid var(--primary-lighter);

        display: flex;
        justify-content: space-between;
        gap: 5px;
    }

    /* time input */
    input[type="time"] {
        background-color: var(--primary-darkest);
        border-radius: 4px;
        color: inherit;
        font-family: inherit;
        border: 0;

        transition: opacity 0.2s;

        width: 100%;
        font-size: 3.5em;
        padding: 5px 15px;

        cursor: text;
    }

    input:disabled {
        opacity: 0.5;
    }

    input::-webkit-calendar-picker-indicator {
        cursor: pointer;
        opacity: 0.8;
        filter: invert(1);

        font-size: 0.5em;
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
