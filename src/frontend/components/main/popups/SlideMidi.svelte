<script lang="ts">
    import { onMount } from "svelte"
    import { uid } from "uid"
    import { actions, activeShow, popupData } from "../../../stores"
    import MidiValues from "../../actions/MidiValues.svelte"
    import type { API_midi } from "../../actions/api"
    import { midiInListen } from "../../actions/midi"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"

    $: id = $popupData.id || ""

    let action: any = { name: "", triggers: [] }
    let actionMidi: API_midi = { type: "noteon", values: { note: 0, velocity: -1, channel: 1 }, defaultValues: true }

    let loaded = false
    onMount(setAction)
    function setAction() {
        if (!id) {
            id = uid()
            popupData.set({ ...$popupData, id })
        } else {
            action = $actions[id] || action
        }

        // action.midiEnabled = true
        loaded = true
    }

    function updateValue(key: string, e: any) {
        let value = e.detail ?? e

        action[key] = value

        saveAction()
    }

    function saveAction() {
        if (!loaded) return

        actions.update(a => {
            let shows = a[id]?.shows || []
            let showId = $popupData.index === undefined && !$popupData.indexes?.length ? "" : $activeShow?.id || ""
            if (showId && !shows.find(a => a.id === showId)) shows.push({ id: showId })
            action.shows = shows

            if (action.midi?.defaultValues) delete action.midi.defaultValues

            a[id] = clone(action)

            return a
        })

        midiInListen()
    }
</script>

<p style="opacity: 0.8;font-size: 0.8em;text-align: center;margin-bottom: 20px;"><T id="actions.play_on_midi_tip" /></p>

<MidiValues value={clone(action.midi || actionMidi)} firstActionId={action.triggers?.[0]} on:change={e => updateValue("midi", e)} playSlide />
