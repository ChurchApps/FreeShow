<script lang="ts">
    import { MAIN } from "../../../../types/Channels"
    import { activeShow, dictionary, groups, midiIn, popupData, styles } from "../../../stores"
    import { defaultMidiActionChannels, midiActions, midiInListen, midiNames, midiToNote } from "../../../utils/midi"
    import { receive, send } from "../../../utils/request"
    import { history } from "../../helpers/history"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"

    let id: string = ""
    $: if ($popupData.id) id = $popupData.id

    let midi: any = { name: "MIDI", type: "noteon", values: { note: 0, velocity: -1, channel: 1 }, defaultValues: true }
    $: if (id) setMidi()
    function setMidi() {
        if ($popupData.type === "in") midi = $midiIn[id] || midi
        else midi = _show().get("midi")?.[id] || midi
    }

    let types = [{ name: "noteon" }, { name: "noteoff" }]

    let inputs: any[] = [{ name: "—" }]
    let outputs: any[] = [{ name: "—" }]
    // request midi inputs/outputs
    $: if ($popupData.type === "in") {
        send(MAIN, ["GET_MIDI_INPUTS"])
    } else {
        send(MAIN, ["GET_MIDI_OUTPUTS"])
    }

    receive(MAIN, {
        GET_MIDI_OUTPUTS: (msg) => {
            if (!msg.length) return
            outputs = msg.map((a) => ({ name: a }))
            if (!midi.output) midi.output = msg[0]
        },
        GET_MIDI_INPUTS: (msg) => {
            if (!msg.length) return
            inputs = msg.map((a) => ({ name: a }))
            if (!midi.input) midi.input = msg[0]
        },
        RECEIVE_MIDI: (msg) => {
            if (!autoValues) return
            if (msg.id === id && msg.type === midi.type) {
                midi.values = msg.values
                if (midi.action.includes("index_")) midi.values.velocity = -1
            }
        },
    })

    let autoValues: boolean = false
    function toggleAutoValues(e: any) {
        autoValues = e.target.checked
    }

    // update show
    $: if (midi) saveMidi()

    function changeName(e: any) {
        midi.name = e.target.value
    }

    function toggleDefaultValues(e: any) {
        midi.defaultValues = e.target.checked

        if (midi.defaultValues && defaultMidiActionChannels[midi.action]) {
            midi = { ...midi, ...defaultMidiActionChannels[midi.action] }
        }
    }

    // TODO: history!
    function saveMidi() {
        if (!midi.name) return

        if ($popupData.type === "in") {
            midiIn.update((a) => {
                let shows = a[id]?.shows || []
                let showId = $popupData.index === undefined ? "" : $activeShow?.id || ""
                if (showId && !shows.find((a) => a.id === showId)) shows.push({ id: showId })
                a[id] = { ...midi, shows }
                return a
            })

            midiInListen()
        } else if ($activeShow) {
            let showMidi = _show().get("midi") || {}
            if (JSON.stringify(showMidi[id] || {}) === JSON.stringify(midi)) return
            showMidi[id] = midi

            _show().set({ key: "midi", value: showMidi })
        }
    }

    $: midiInOptions = Object.entries($midiIn)
        .filter(([_id, value]) => !value.action)
        .map(([id, value]) => ({ id, name: value.name }))

    function changeId(e: any) {
        if (!e.detail?.id) return
        if ($popupData.type !== "in") return
        if ($popupData.index === undefined) return

        // update show action id
        let ref = _show().layouts("active").ref()[0]
        let layoutSlide = ref[$popupData.index]
        let actions = layoutSlide.data.actions || {}

        id = e.detail.id
        actions.receiveMidi = id

        let override = "show#" + $activeShow?.id + "layout#" + _show().get("settings.activeLayout") + "index#" + $popupData.index
        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: [$popupData.index] }, location: { page: "show", override } })

        midiInListen()
    }

    const actionOptions = Object.keys(midiActions).map((id) => ({ id, name: "$:" + (midiNames[id] || "actions." + id) + ":$", translate: true }))

    // TODO: translate name & sort
    const groupsList = Object.keys($groups).map((id) => ({ id, name: $dictionary.groups?.[$groups[id].name] || $groups[id].name }))

    $: stylesList = getList($styles)
    function getList(styles) {
        let list = Object.entries(styles).map(([id, obj]: any) => {
            return { ...obj, id }
        })

        let sortedList = list.sort((a, b) => a.name.localeCompare(b.name))

        return [{ id: null, name: "—" }, ...sortedList]
    }

    function changeAction(e: any) {
        midi.action = e.detail.id

        if (midi.defaultValues && defaultMidiActionChannels[midi.action]) {
            midi = { ...midi, ...defaultMidiActionChannels[midi.action] }
        }

        // reset velocity
        if (midi.action.includes("index_")) midi.values.velocity = -1
    }

    $: canHaveAction = $popupData.action || midi.action
    if ($popupData.action) midi.action = Object.keys(midiActions)[0] || ""
    $: notActionOrDefaultValues = canHaveAction ? midi.defaultValues : false
</script>

<div style="min-width: 40vw;">
    {#if $popupData.type === "in" && $popupData.index !== undefined}
        <span class="id">
            <Dropdown value={midi.name || "—"} options={midiInOptions} on:click={changeId} />
        </span>
    {/if}

    <span>
        <p><T id="midi.name" /></p>
        <TextInput style="width: 70%;" value={midi.name} on:change={changeName} />
    </span>

    <span>
        {#if $popupData.type === "in"}
            <p><T id="midi.input" /></p>
            <Dropdown value={midi.input || "—"} options={inputs} on:click={(e) => (midi.input = e.detail.name)} />
        {:else}
            <p><T id="midi.output" /></p>
            <Dropdown value={midi.output || "—"} options={outputs} on:click={(e) => (midi.output = e.detail.name)} />
        {/if}
    </span>

    <br />

    {#if canHaveAction}
        <span>
            <p><T id="midi.use_default_values" /></p>
            <Checkbox checked={midi.defaultValues} on:change={toggleDefaultValues} />
        </span>
    {/if}

    {#if !notActionOrDefaultValues}
        <span>
            <p><T id="midi.auto_values" /></p>
            <Checkbox checked={autoValues} on:change={toggleAutoValues} />
        </span>

        {#if $popupData.type === "in" && !midi.action?.includes("index_")}
            <span>
                <p style="font-size: 0.7em;opacity: 0.8;">
                    <T id="midi.tip_velocity" />
                </p>
            </span>
        {/if}
    {/if}

    <span>
        <p><T id="midi.type" /></p>
        <Dropdown value={midi.type} options={types} on:click={(e) => (midi.type = e.detail.name)} disabled={notActionOrDefaultValues} />
    </span>

    <span>
        <span>
            <p><T id="midi.note" /></p>
            <span style="opacity: 0.7;">{midiToNote(midi.values.note)}</span>
        </span>
        <NumberInput value={midi.values.note} max={127} on:change={(e) => (midi.values.note = Number(e.detail))} disabled={notActionOrDefaultValues} />
    </span>
    {#if !notActionOrDefaultValues && !midi.action?.includes("index_")}
        <span>
            <p><T id="midi.velocity" /></p>
            <NumberInput value={midi.values.velocity} min={$popupData.type === "in" ? -1 : 0} max={127} on:change={(e) => (midi.values.velocity = Number(e.detail))} />
        </span>
    {/if}
    <span>
        <p><T id="midi.channel" /></p>
        <NumberInput value={midi.values.channel} max={255} on:change={(e) => (midi.values.channel = Number(e.detail))} disabled={notActionOrDefaultValues} />
    </span>

    {#if canHaveAction}
        <br />

        {#if midi.action?.includes("index_")}
            <span>
                <p style="font-size: 0.7em;opacity: 0.8;">
                    <T id="midi.tip_index_by_velocity" />
                </p>
            </span>
        {/if}

        {#if midi.action === "index_select_slide"}
            <span>
                <p style="font-size: 0.7em;opacity: 0.8;">
                    <T id="midi.tip_action" />
                </p>
            </span>
        {/if}

        <span>
            <p><T id="midi.start_action" /></p>
            <Dropdown value={midi.action ? "$:" + (midiNames[midi.action] || "actions." + midi.action) + ":$" : "—"} options={actionOptions} on:click={changeAction} />
        </span>

        {#if midi.action === "goto_group"}
            <span>
                <p><T id="actions.choose_group" /></p>
                <Dropdown value={groupsList.find((a) => a.id === midi.actionData?.group)?.name || "—"} options={groupsList} on:click={(e) => (midi.actionData = { group: e.detail.id })} />
            </span>
        {:else if midi.action === "change_output_style"}
            <span>
                <p><T id="actions.change_output_style" /></p>
                <Dropdown value={$styles[midi.actionData?.style]?.name || "—"} options={stylesList} on:click={(e) => (midi.actionData = { style: e.detail.id })} />
            </span>
        {/if}
    {/if}
</div>

<style>
    div {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    div span {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
    }

    div :global(.numberInput),
    div :global(.dropdownElem) {
        width: 70%;
    }
    div span.id :global(.dropdownElem) {
        width: 100%;
    }
</style>
