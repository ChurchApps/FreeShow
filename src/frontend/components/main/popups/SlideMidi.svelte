<script lang="ts">
    import { onMount } from "svelte"
    import { uid } from "uid"
    import { actions, activeShow, popupData } from "../../../stores"
    import MidiValues from "../../actions/MidiValues.svelte"
    import type { API_midi } from "../../actions/api"
    import { midiInListen } from "../../actions/midi"
    import { clone } from "../../helpers/array"
    import Tip from "../Tip.svelte"

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

        actions.update((a) => {
            let shows = a[id]?.shows || []
            let showId = $popupData.index === undefined && !$popupData.indexes?.length ? "" : $activeShow?.id || ""
            if (showId && !shows.find((a) => a.id === showId)) shows.push({ id: showId })
            action.shows = shows

            if (action.midi?.defaultValues) delete action.midi.defaultValues

            a[id] = clone(action)

            return a
        })

        midiInListen()
    }
</script>

<Tip type="info" value="actions.play_on_midi_tip" bottom={20} />

<MidiValues value={clone(action.midi || actionMidi)} firstActionId={action.triggers?.[0]} on:change={(e) => updateValue("midi", e)} playSlide />
