<script lang="ts">
    import { onMount } from "svelte"
    import { uid } from "uid"
    import type { Event } from "../../../../types/Calendar"
    import { activeDays, activePopup, dictionary, drawerTabsData, eventEdit, events, popupData } from "../../../stores"
    import { getTime, isSameDay } from "../../drawer/calendar/calendar"
    import { createRepeatedEvents, updateEventData } from "../../drawer/calendar/event"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { history } from "../../helpers/history"
    import { changeTime } from "../../helpers/time"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Color from "../../inputs/Color.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import CreateAction from "../../actions/CreateAction.svelte"

    let stored = ""

    let defaultRepeatData: any = {
        type: "day",
        ending: "date",
        count: 1,
        endingDate: "",
        afterRepeats: 10
    }

    interface EventWithData extends Event {
        id: string
        repeatData: any
    }
    let editEvent: EventWithData = {
        type: "event",
        id: "",
        name: "",
        color: "#FFFFFF",
        time: true,
        from: "",
        to: "",
        repeat: false,
        repeatData: defaultRepeatData
    }

    let selectedType = "" // "event" | "action"

    onMount(() => {
        selectedType = $drawerTabsData.calendar?.activeSubTab || "event"

        if ($eventEdit) edit($events[$eventEdit])
        else resetEdit()
    })

    function edit(event: any) {
        let from: Date = new Date(event.from)
        let to: Date = new Date(event.to)

        editEvent = { ...event, id: $eventEdit, isoFrom: getISO(from), isoTo: getISO(to), fromTime: getTime(from), toTime: getTime(to) }
        if (!editEvent.repeatData) editEvent.repeatData = defaultRepeatData

        if (event.action) actionData = event.action

        stored = JSON.stringify(editEvent)
    }

    $: if (!$eventEdit && selectedType) resetEdit()
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
            notes: ""
        }

        // update action
        // WIP don't know if this does anything
        if (actionData) editEvent.action = actionData

        let obj: any = { month: selectedDate.getMonth() + 1 }
        if (obj.month > 11) {
            obj = { month: 0, year: selectedDate.getFullYear() + 1 }
        }
        editEvent.repeatData.endingDate = getISO(setDate(selectedDate, obj))

        stored = JSON.stringify(editEvent)
    }

    const getISO = (date: Date) => {
        date = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes())
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
        console.log(date)
        return date.toISOString().substring(0, 10)
    }
    const inputChange = (e: any, key: string) => ((editEvent as any)[key] = e.target.value)
    const check = (e: any, key: string) => ((editEvent as any)[key] = e.target.checked)

    function saveAll() {
        let { data } = updateEventData(editEvent, stored, { type: selectedType, action: actionData })
        if (!data) return

        let updatedData: any = {}
        Object.entries($events).forEach(([eventId, event]: any) => {
            if (event.group !== editEvent.group) return

            let newFromTime = changeTime(event.from, data.from).toString()
            let newToTime = changeTime(event.to, data.to).toString()
            updatedData[eventId] = {
                ...data,
                from: newFromTime,
                to: newToTime
            }
        })

        history({ id: "UPDATE", newData: { data: updatedData, keys: Object.keys(updatedData) }, location: { page: "drawer", id: "event" } })

        if (data.repeat) {
            createRepeatedEvents(data, true)
        }

        activePopup.set(null)
        eventEdit.set(null)
    }

    function save() {
        if (selectedType === "event" && stored === JSON.stringify(editEvent)) return activePopup.set(null)
        if (selectedType === "event" && !editEvent.name?.length) return activePopup.set(null)
        if (selectedType === "action" && !actionData) return activePopup.set(null)
        if (selectedType === "action") editEvent.isoTo = editEvent.isoFrom

        let { data, id } = updateEventData(editEvent, stored, { type: selectedType, action: actionData })
        if (!data) return

        if (data.repeat && !data.group) {
            data.group = id
            createRepeatedEvents(data)
        } else {
            history({ id: "UPDATE", newData: { data }, oldData: { id }, location: { page: "drawer", id: "event" } })
        }

        // activeDays.set([copy(data.from).getTime()])
        activePopup.set(null)
        eventEdit.set(null)
    }

    const setDate = (date: Date, options: any): Date => {
        let newDate = [options.year ?? date.getFullYear(), (options.month ?? date.getMonth()) + 1, options.date ?? date.getDate()]
        let time = date.getHours() + ":" + date.getMinutes()
        return new Date([...newDate, time].join(" "))
    }

    const repeats = [
        { id: "day", name: "$:calendar.day:$" },
        { id: "week", name: "$:calendar.week:$" },
        { id: "month", name: "$:calendar.month:$" },
        { id: "year", name: "$:calendar.year:$" }
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
        { id: "after", name: "$:calendar.ending_repeated:$" }
        // { id: "never", name: "$:calendar.ending_never:$" },
    ]

    let actionData: any = {}
    function changeAction(e) {
        let value = e.detail

        if (value.actionValue) {
            actionData.data = value.actionValue
        } else {
            actionData.id = value.id
        }
    }

    // // TODO: choose current weekday
    // // TODO: get date 1 month ahead
    // let selectedRepeat = repeats[0]
    // // let selectedWeekday = weekdays[0]
    // let selectedEnding = endings[0]
    // let repeatCount: number = 1
    // let endingDate: string = ""
    // let afterRepeats: number = 10

    function updateTime(changed: "from" | "to") {
        if (!editEvent.isoFrom || !editEvent.isoTo) return
        if (!isSameDay(new Date(editEvent.isoFrom), new Date(editEvent.isoTo))) return
        if (!editEvent.fromTime || !editEvent.toTime) return

        let from = Number(editEvent.fromTime.replace(":", ""))
        let to = Number(editEvent.toTime.replace(":", ""))

        if (changed === "to" && editEvent.toTime[0] === "0") return
        if (changed === "from" ? from <= to : to >= from) return

        if (changed === "from") {
            let newTime = from + 100
            if (newTime >= 2400) newTime = 2359
            let sliced = newTime.toString() + "000"
            editEvent.toTime = sliced.slice(0, 2) + ":" + sliced.slice(2, 4)
        } else if (changed === "to") {
            let newTime = to - 100
            if (newTime < 0) newTime = 0
            let sliced = newTime.toString() + "000"
            editEvent.fromTime = sliced.slice(0, 2) + ":" + sliced.slice(2, 4)
        }
    }

    // set show when selected
    $: if ($popupData.showId) setTimeout(setShow, 100)
    function setShow() {
        if (!$popupData.event) return

        editEvent = $popupData.event
        actionData = { id: "start_show", data: { id: $popupData.showId } }

        popupData.update((a) => {
            delete a.showId
            return a
        })
    }

    $: updatePopup(editEvent)
    function updatePopup(event) {
        if ($popupData.showId) return

        popupData.update((a) => {
            a.event = event
            return a
        })
    }

    $: actionDataString = ""
    $: if (JSON.stringify(actionData) !== actionDataString) actionDataString = JSON.stringify(actionData)

    let actionSelector: any = null
</script>

<div style="min-width: 45vw;min-height: 50vh;">
    {#if !actionSelector}
        {#if selectedType === "event"}
            <CombinedInput textWidth={30}>
                <p><T id="calendar.time" /></p>
                <div class="alignRight">
                    <Checkbox checked={editEvent.time} on:change={(e) => check(e, "time")} />
                </div>
            </CombinedInput>
        {/if}

        <!-- TODO: update totime if fromtime is newer -->
        <CombinedInput textWidth={30}>
            <p><T id="timer.from" /></p>
            <div style="display: flex;">
                <input style="flex: 2;" type="date" title={$dictionary.calendar?.from_date} bind:value={editEvent.isoFrom} />
                <input style="flex: 1;" type="time" title={$dictionary.calendar?.from_time} bind:value={editEvent.fromTime} on:change={() => updateTime("from")} disabled={!editEvent.time} />
            </div>
        </CombinedInput>
        {#if selectedType === "event"}
            <CombinedInput textWidth={30}>
                <p><T id="timer.to" /></p>
                <div style="display: flex;">
                    <input style="flex: 2;" type="date" title={$dictionary.calendar?.to_date} bind:value={editEvent.isoTo} />
                    <input style="flex: 1;" type="time" title={$dictionary.calendar?.to_time} bind:value={editEvent.toTime} on:change={() => updateTime("to")} disabled={!editEvent.time} />
                </div>
            </CombinedInput>
        {/if}

        <CombinedInput textWidth={30}>
            <p><T id="calendar.repeat" /></p>
            <div class="alignRight">
                <Checkbox disabled={editEvent.group} checked={editEvent.repeat} on:change={(e) => check(e, "repeat")} />
            </div>
        </CombinedInput>

        {#if editEvent.repeat}
            <CombinedInput textWidth={30}>
                <div style="display: flex;">
                    <span style="display: flex;align-items: center;padding: 0 10px;"><T id="calendar.repeat_every" /></span>
                    <NumberInput disabled={!!editEvent.group} style="width: 50px;" value={editEvent.repeatData.count} min={1} buttons={false} on:change={(e) => (editEvent.repeatData.count = e.detail)} />
                    <Dropdown disabled={!!editEvent.group} style="width: 100px;" options={repeats} value={repeats.find((a) => a.id === editEvent.repeatData.type)?.name || ""} on:click={(e) => (editEvent.repeatData.type = e.detail.id)} />
                    <!-- TODO: select weekdays? -->
                    <!-- {#if selectedRepeat.id === "week"}
<span style="display: flex;align-items: center;padding: 0 10px;"><T id="calendar.repeat_on" /></span>
<Dropdown style="width: 100px;" options={weekdays} value={selectedWeekday.name} on:click={(e) => (selectedWeekday = e.detail)} />
{/if} -->
                    <span style="display: flex;align-items: center;padding: 0 10px;"><T id="calendar.repeat_until" /></span>
                    <Dropdown disabled={!!editEvent.group} style="width: 130px;" options={endings} value={endings.find((a) => a.id === editEvent.repeatData.ending)?.name || ""} on:click={(e) => (editEvent.repeatData.ending = e.detail.id)} />

                    {#if editEvent.repeatData.ending === "date"}
                        <input disabled={!!editEvent.group} type="date" bind:value={editEvent.repeatData.endingDate} />
                    {:else if editEvent.repeatData.ending === "after"}
                        <NumberInput disabled={!!editEvent.group} style="width: 50px;" value={editEvent.repeatData.afterRepeats} min={1} buttons={false} on:change={(e) => (editEvent.repeatData.afterRepeats = e.detail)} />
                        <span style="display: flex;align-items: center;padding: 0 10px;"><T id="calendar.ending_times" /></span>
                    {/if}
                </div>
            </CombinedInput>
        {/if}
    {/if}

    {#if selectedType === "event"}
        <CombinedInput textWidth={30} style="margin-top: 10px;">
            <p>
                <Icon id="edit" size={1.2} right />
                <T id="calendar.name" />
            </p>
            <TextInput value={editEvent.name} style="width: 50%;" on:input={(e) => inputChange(e, "name")} autofocus={!editEvent.name} />
        </CombinedInput>

        <CombinedInput textWidth={30}>
            <p>
                <Icon id="theme" size={1.2} right />
                <T id="calendar.color" />
            </p>
            <Color value={editEvent.color || ""} on:input={(e) => (editEvent.color = e.detail)} style="width: 50%;" />
        </CombinedInput>

        <CombinedInput textWidth={30}>
            <p>
                <Icon id="location" size={1.2} right />
                <T id="calendar.location" />
            </p>
            <TextInput value={editEvent.location || ""} style="width: 50%;" on:input={(e) => inputChange(e, "location")} />
        </CombinedInput>

        <CombinedInput textWidth={30}>
            <p>
                <Icon id="notes" size={1.2} right />
                <T id="calendar.notes" />
            </p>
            <TextInput value={editEvent.notes || ""} style="width: 50%;" on:input={(e) => inputChange(e, "notes")} />
        </CombinedInput>
    {:else if selectedType === "action"}
        {#if actionSelector !== null}
            <Button class="popup-back" title={$dictionary.actions?.back} on:click={() => (actionSelector = null)}>
                <Icon id="back" size={2} white />
            </Button>

            <CreateAction
                actionId={actionData?.id || ""}
                existingActions={actionData?.id ? [actionData.id] : []}
                actionValue={actionData?.data || {}}
                on:change={(e) => {
                    changeAction(e)
                    actionSelector = null
                }}
                mode="calendar"
                list
                full
            />
        {:else}
            <br />

            {#key actionDataString}
                <!-- TODO: only choose actual "Actions" -->
                <CreateAction actionId={actionData?.id || ""} actionValue={actionData?.data || {}} on:change={changeAction} on:choose={() => (actionSelector = { id: actionData?.id || "" })} mode="calendar" choosePopup />
            {/key}
        {/if}
    {/if}

    {#if !actionSelector}
        <br />

        <CombinedInput>
            <Button style="width: 100%;" on:click={save} disabled={selectedType === "event" ? !editEvent.name?.length || stored === JSON.stringify(editEvent) : selectedType === "action" ? !actionData?.id : true} dark center>
                {#if $eventEdit}
                    <Icon id="save" right />
                    <T id="actions.save" />
                {:else}
                    <Icon id="add" right />
                    <T id="timer.create" />
                {/if}
            </Button>
        </CombinedInput>
        {#if editEvent.group}
            <CombinedInput>
                <Button style="width: 100%;" on:click={saveAll} disabled={selectedType === "event" ? !editEvent.name?.length || stored === JSON.stringify(editEvent) : selectedType === "action" ? !actionData?.id : true} dark center>
                    <Icon id="save" right />
                    <T id="calendar.save_all" />
                </Button>
            </CombinedInput>
        {/if}
    {/if}
</div>

<style>
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
