<script lang="ts">
    import { uid } from "uid"
    import { activeShow, midiIn, popupData } from "../../../stores"
    import CreateAction from "../../actions/CreateAction.svelte"
    import MidiValues from "../../actions/MidiValues.svelte"
    import { actionData } from "../../actions/actionData"
    import { convertOldMidiToNewAction, defaultMidiActionChannels, midiInListen } from "../../actions/midi"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { _show } from "../../helpers/shows"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import TextInput from "../../inputs/TextInput.svelte"
    import { onMount } from "svelte"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { translate } from "../../../utils/language"

    $: id = $popupData.id || ""
    $: mode = $popupData.mode || ""
    $: console.log($popupData)
    // id, type, mode, ((isShow)), index // slide data

    let action: any = { name: "", triggers: [] }
    let actionMidi = { type: "noteon", values: { note: 0, velocity: mode === "slide" ? 0 : -1, channel: 1 }, defaultValues: true }

    onMount(setAction)
    function setAction() {
        if (!id) id = uid()
        else {
            let showMidi = _show().get("midi")?.[id]
            action = $midiIn[id] || showMidi || action

            action = convertOldMidiToNewAction(action)
        }

        if (mode === "slide_midi") action.midiEnabled = true
    }

    function updateValue(key: string, e: any) {
        let value = e.detail ?? e.target?.value ?? e
        action[key] = value
    }

    function changeAction(e) {
        let actionId = e.detail.id || ""
        if (!actionId) return

        action.triggers.push(actionId)

        // set all MIDI values
        if (action.midiEnabled && action.midi?.defaultValues && defaultMidiActionChannels[actionId]) {
            action.midi = { ...action.midi, ...defaultMidiActionChannels[actionId] }
        }

        // auto name
        if (!action.name && action.triggers.length === 1) {
            action.name = translate(actionData[actionId]?.name || "") || actionId
        }

        // reset velocity
        if (actionId.includes("index_") && action.midi?.values) {
            action.midi.values.velocity = mode === "slide" ? 0 : -1
        }

        // update
        action = action
        addTrigger = false
    }

    $: console.log(action)

    // TODO: history!
    $: if (action) saveAction()
    function saveAction() {
        if (!action.name) return

        if (mode !== "slide") {
            midiIn.update((a) => {
                if (mode === "slide_midi") {
                    let shows = a[id]?.shows || []
                    let showId = $popupData.index === undefined ? "" : $activeShow?.id || ""
                    if (showId && !shows.find((a) => a.id === showId)) shows.push({ id: showId })
                    action.shows = shows
                }

                a[id] = clone(action)

                return a
            })

            midiInListen()
        } else if ($activeShow) {
            // WIP move this from show to action
            let showMidi = _show().get("midi") || {}
            if (showMidi[id]) {
                if (JSON.stringify(showMidi[id] || {}) === JSON.stringify(action)) return
                showMidi[id] = action
                _show().set({ key: "midi", value: showMidi })
                return
            }

            let layoutSlide: number = $popupData.index
            if (layoutSlide === undefined) return

            let ref = _show().layouts("active").ref()[0]
            if (!ref[layoutSlide]) return

            let actions = clone(ref[layoutSlide].data?.actions) || {}
            if (!actions.slideActions) actions.slideActions = []

            let currentSlideActionIndex = actions.slideActions.findIndex((a) => a.id === id)
            if (currentSlideActionIndex < 0) return
            actions.slideActions[currentSlideActionIndex] = action

            history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: [layoutSlide] } })
        }

        console.log("SAVE", action)
    }

    let addTrigger: boolean = false
</script>

<div style="min-width: 45vw;">
    {#if mode === "slide"}
        <CreateAction actionId={action.triggers?.[0] || ""} trigger={action.triggers?.[0] || ""} on:change={changeAction} list />
    {:else}
        <CombinedInput>
            <p><T id="midi.name" /></p>
            <TextInput style="width: 70%;" value={action.name} on:change={(e) => updateValue("name", e)} />
        </CombinedInput>

        <!-- multiple actions -->
        {#each action.triggers as actionId}
            <CreateAction {actionId} on:change={changeAction} />
        {/each}
        {#if !action.triggers?.length || addTrigger}
            <CreateAction actionId="" on:change={changeAction} />
        {:else}
            <Button on:click={() => (addTrigger = true)}>
                <Icon id="add" right />
                <T id="settings.add" />
            </Button>
        {/if}
        <!-- {#if action.triggers?.length && !addTrigger}
        {/if} -->

        <!-- MIDI -->

        <!-- if not slide specific trigger action -->
        {#if !mode}
            <CombinedInput>
                <p><T id="midi.activate" /></p>
                <div class="alignRight">
                    <Checkbox checked={action.midiEnabled} on:change={(e) => updateValue("midiEnabled", e)} />
                </div>
            </CombinedInput>
        {/if}

        {#if action.midi}
            <!-- WIP MIDI set initial value + update action on update -->
            <MidiValues midi={action.midi || actionMidi} on:change={(e) => updateValue("midi", e)} />
        {/if}
    {/if}
</div>
