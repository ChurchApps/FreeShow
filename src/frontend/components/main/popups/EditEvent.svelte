<script lang="ts">
    import { onMount } from "svelte"
    import { uid } from "uid"
    import type { Event } from "../../../../types/Calendar"
    import { activeDays, activePopup, drawerTabsData, eventEdit, events, popupData } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import CreateAction from "../../actions/CreateAction.svelte"
    import { getTime, isSameDay } from "../../drawer/calendar/calendar"
    import { createRepeatedEvents, updateEventData } from "../../drawer/calendar/event"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { history } from "../../helpers/history"
    import { changeTime } from "../../helpers/time"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialColorInput from "../../inputs/MaterialColorInput.svelte"
    import MaterialDatePicker from "../../inputs/MaterialDatePicker.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialTextInput from "../../inputs/MaterialTextInput.svelte"
    import MaterialTimePicker from "../../inputs/MaterialTimePicker.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

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
        { value: "day", label: translateText("calendar.day") },
        { value: "week", label: translateText("calendar.week") },
        { value: "month", label: translateText("calendar.month") },
        { value: "year", label: translateText("calendar.year") }
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
        { value: "date", label: translateText("calendar.ending_the") },
        { value: "after", label: translateText("calendar.ending_repeated") }
        // { value: "never", label: translateText("calendar.ending_never") },
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

        popupData.update(a => {
            delete a.showId
            return a
        })
    }

    $: updatePopup(editEvent)
    function updatePopup(event) {
        if ($popupData.showId) return

        popupData.update(a => {
            a.event = event
            return a
        })
    }

    $: actionDataString = ""
    $: if (JSON.stringify(actionData) !== actionDataString) actionDataString = JSON.stringify(actionData)

    $: cantSave = selectedType === "event" ? !editEvent.name?.length || stored === JSON.stringify(editEvent) : selectedType === "action" ? !actionData?.id : true

    let actionSelector: any = null

    let showMore = false
</script>

{#if selectedType === "event"}
    <InputRow>
        <MaterialTextInput label="calendar.name" value={editEvent.name} on:input={e => (editEvent.name = e.detail)} autofocus={!editEvent.name} />
        <MaterialColorInput label="calendar.color" style="min-width: 200px;max-width: 200px;" value={editEvent.color || ""} on:input={e => (editEvent.color = e.detail)} noLabel />
    </InputRow>

    {#if showMore}
        <MaterialTextInput label="calendar.location" value={editEvent.location || ""} on:input={e => (editEvent.location = e.detail)} />
        <MaterialTextInput label="calendar.notes" value={editEvent.notes || ""} on:input={e => (editEvent.notes = e.detail)} />
    {/if}

    <MaterialButton class="popup-options {showMore ? 'active' : ''}" icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} on:click={() => (showMore = !showMore)} white />

    {#if showMore}
        <MaterialToggleSwitch label="calendar.time" style="margin-top: 10px;" checked={editEvent.time} defaultValue={true} on:change={e => (editEvent.time = e.detail)} />
    {/if}
{:else if selectedType === "action"}
    {#if actionSelector !== null}
        <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => (actionSelector = null)} />

        <CreateAction
            actionId={actionData?.id || ""}
            existingActions={actionData?.id ? [actionData.id] : []}
            actionValue={actionData?.data || {}}
            on:change={e => {
                changeAction(e)
                actionSelector = null
            }}
            mode="calendar"
            list
            full
        />
    {:else}
        {#key actionDataString}
            <!-- TODO: only choose actual "Actions" -->
            <CreateAction actionId={actionData?.id || ""} actionValue={actionData?.data || {}} on:change={changeAction} on:choose={() => (actionSelector = { id: actionData?.id || "" })} mode="calendar" choosePopup />
        {/key}
    {/if}
{/if}

{#if !actionSelector}
    <!-- TODO: update totime if fromtime is newer -->
    <InputRow style="margin-top: {showMore ? 0 : 10}px;">
        <MaterialDatePicker label="calendar.from_date" style="flex: 1;" value={editEvent.isoFrom || ""} on:change={e => (editEvent.isoFrom = e.detail)} />
        <MaterialTimePicker label="calendar.from_time" style="width: 200px;" disabled={!editEvent.time} value={editEvent.fromTime || ""} on:input={e => (editEvent.fromTime = e.detail)} on:change={() => updateTime("from")} />
    </InputRow>
    {#if selectedType === "event"}
        <InputRow>
            <MaterialDatePicker label="calendar.to_date" style="flex: 1;" value={editEvent.isoTo || ""} on:change={e => (editEvent.isoTo = e.detail)} />
            <MaterialTimePicker label="calendar.to_time" style="width: 200px;" disabled={!editEvent.time} value={editEvent.toTime || ""} on:input={e => (editEvent.toTime = e.detail)} on:change={() => updateTime("to")} />
        </InputRow>
    {/if}

    <MaterialToggleSwitch label="calendar.repeat" style="margin-top: 10px;" disabled={!!editEvent.group} checked={editEvent.repeat} on:change={e => (editEvent.repeat = e.detail)} />

    {#if editEvent.repeat}
        <InputRow style="background-color: var(--primary-darker);border-radius: 4px;">
            <span style="display: flex;align-items: center;font-size: 0.9em;padding: 0 10px;"><T id="calendar.repeat_every" /></span>
            <MaterialNumberInput label="edit.count" disabled={!!editEvent.group} style="width: 80px;" value={editEvent.repeatData.count} min={1} on:change={e => (editEvent.repeatData.count = e.detail)} />
            <MaterialDropdown label="edit.interval" disabled={!!editEvent.group} style="width: 100px;" options={repeats} value={editEvent.repeatData.type} on:change={e => (editEvent.repeatData.type = e.detail)} />
            <!-- TODO: select weekdays? -->
            <!-- {#if selectedRepeat.id === "week"}
                <span style="display: flex;align-items: center;padding: 0 10px;"><T id="calendar.repeat_on" /></span>
                <Dropdown style="width: 100px;" options={weekdays} value={selectedWeekday.name} on:click={(e) => (selectedWeekday = e.detail)} />
            {/if} -->
            <span style="display: flex;align-items: center;font-size: 0.9em;padding: 0 10px;"><T id="calendar.repeat_until" /></span>
            <MaterialDropdown label="calendar.type" disabled={!!editEvent.group} style="width: 130px;" options={endings} value={editEvent.repeatData.ending} on:change={e => (editEvent.repeatData.ending = e.detail)} />

            {#if editEvent.repeatData.ending === "date"}
                <MaterialDatePicker label="calendar.to_date" style="flex: 0;" disabled={!!editEvent.group} value={editEvent.repeatData.endingDate} on:change={e => (editEvent.repeatData.endingDate = e.detail)} />
            {:else if editEvent.repeatData.ending === "after"}
                <MaterialNumberInput label="edit.count" disabled={!!editEvent.group} style="width: 80px;" value={editEvent.repeatData.afterRepeats} min={1} on:change={e => (editEvent.repeatData.afterRepeats = e.detail)} />
                <span style="display: flex;align-items: center;padding: 0 10px;"><T id="calendar.ending_times" /></span>
            {/if}
        </InputRow>
    {/if}

    <InputRow style="margin-top: 20px;">
        <MaterialButton variant="contained" style="flex: 1;{cantSave ? '' : 'background-color: var(--secondary) !important;'}" disabled={cantSave} on:click={save}>
            {#if $eventEdit}
                <Icon id="save" white />
                <T id="actions.save" />
            {:else}
                <Icon id="add" white />
                <T id="timer.create" />
            {/if}
        </MaterialButton>
        {#if editEvent.group}
            <MaterialButton variant="contained" style="flex: 2;margin-left: 5px;{cantSave ? '' : 'background-color: var(--secondary) !important;'}" disabled={cantSave} on:click={saveAll}>
                <Icon id="save" white />
                <T id="calendar.save_all" />
            </MaterialButton>
        {/if}
    </InputRow>
{/if}
