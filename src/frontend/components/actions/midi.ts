import { get } from "svelte/store"
import { MAIN } from "../../../types/Channels"
import type { Midi } from "../../../types/Show"
import { midiIn, shows } from "../../stores"
import { newToast } from "../../utils/messages"
import { send } from "../../utils/request"
import { clone } from "../helpers/array"
import { setOutput } from "../helpers/output"
import { updateOut } from "../helpers/showActions"
import { _show } from "../helpers/shows"
import { runAction } from "./actions"

// WIP MIDI listener
export function midiInListen() {
    console.log("MIDI IN LISTEN")

    Object.entries(get(midiIn)).forEach(([id, action]: any) => {
        action = convertOldMidiToNewAction(action)
        if (!action.midi) return

        if (!action.shows?.length) {
            send(MAIN, ["RECEIVE_MIDI"], { id, ...action.midi })
            return
        }

        action.shows.forEach((show) => {
            if (!shows[show.id]) return

            // find all slides in current show with this MIDI
            let layouts: any[] = _show(show.id).layouts().get()
            let found: boolean = false
            layouts.forEach((layout) => {
                layout.slides.forEach((slide) => {
                    if (slide.actions?.receiveMidi === id) found = true
                })
            })

            if (!found) {
                // remove from midi
                midiIn.update((a) => {
                    delete a[id]
                    return a
                })
            } else {
                if (!action.midi?.input) return
                send(MAIN, ["RECEIVE_MIDI"], { id, ...action.midi })
            }
        })
    })
}

export const defaultMidiActionChannels = {
    // presentation
    next_slide: { type: "noteon", values: { note: 0, velocity: -1, channel: 1 } },
    previous_slide: { type: "noteon", values: { note: 1, velocity: -1, channel: 1 } },
    next_project_show: { type: "noteon", values: { note: 2, velocity: -1, channel: 1 } },
    previous_project_show: { type: "noteon", values: { note: 3, velocity: -1, channel: 1 } },
    goto_group: { type: "noteon", values: { note: 4, velocity: -1, channel: 1 } },

    // media controls
    // TODO: midi video action (to beginning, play/pause, play, pause)

    // clear
    clear_all: { type: "noteon", values: { note: 0, velocity: -1, channel: 3 } },
    clear_background: { type: "noteon", values: { note: 1, velocity: -1, channel: 3 } },
    clear_slide: { type: "noteon", values: { note: 2, velocity: -1, channel: 3 } },
    clear_overlays: { type: "noteon", values: { note: 3, velocity: -1, channel: 3 } },
    clear_audio: { type: "noteon", values: { note: 4, velocity: -1, channel: 3 } },
    clear_next_timer: { type: "noteon", values: { note: 5, velocity: -1, channel: 3 } },

    // change looks
    change_output_style: { type: "noteon", values: { note: 0, velocity: -1, channel: 4 } },

    // select by index (use velocity to set index, starting at 0)
    index_select_project: { type: "noteon", values: { note: 0, velocity: -1, channel: 5 } },
    index_select_project_show: { type: "noteon", values: { note: 1, velocity: -1, channel: 5 } },
    index_select_slide: { type: "noteon", values: { note: 2, velocity: -1, channel: 5 } },
    // index_select_media: { type: "noteon", values: { note: 3, velocity: -1, channel: 5 } },
    // index_select_audio: { type: "noteon", values: { note: 4, velocity: -1, channel: 5 } },
    // index_select_overlay: { type: "noteon", values: { note: 5, velocity: -1, channel: 5 } },
    // this can be done from slide action:
    // index_start_timer: { type: "noteon", values: { note: 6, velocity: -1, channel: 5 } },
    // index_stop_timer: { type: "noteon", values: { note: 7, velocity: -1, channel: 5 } },
    // index_reset_timer: { type: "noteon", values: { note: 8, velocity: -1, channel: 5 } },
}

export function receivedMidi(msg) {
    console.log(msg)
    let msgAction = get(midiIn)[msg.id]
    if (!msgAction) return

    let action: Midi = convertOldMidiToNewAction(msgAction)

    // get index
    let hasindex = action.triggers?.[0]?.includes("index_") ?? false
    let index = msg.values.velocity ?? -1
    if (action.midi?.values?.velocity && action.midi.values.velocity < 0) index = -1

    // the select slide index from velocity can't select slide 0 as a NoteOn with velocity 0 is detected as NoteOff
    // velocity of 0 currently bypasses the note on/off
    if (action.midi?.type !== msg.type && index !== 0) return

    if (hasindex && index < 0) {
        newToast("$toast.midi_no_velocity")
        index = 0
    }

    runAction(action, { midiIndex: index })

    let shows: any[] = action?.shows || []
    if (!shows?.length) return

    let slidePlayed: boolean = false
    shows.forEach(({ id }) => {
        let refs = _show(id).layouts().ref()
        refs.forEach((ref) => {
            ref.forEach((slideRef) => {
                let receiveMidi = slideRef.data.actions?.receiveMidi
                if (!receiveMidi) return
                if (slidePlayed || receiveMidi !== msg.id) return

                // start slide
                slidePlayed = true
                updateOut(id, slideRef.layoutIndex, ref)
                setOutput("slide", { id, layout: slideRef.layoutId, index: slideRef.layoutIndex, line: 0 })
            })
        })
    })
}

// <= 1.1.6
export function convertOldMidiToNewAction(action) {
    if (action.action) {
        action.triggers = [action.action]
        delete action.action
    }

    if (action.values) {
        if (action.values.channel !== undefined) action.values.channel++
        action.midi = clone(action)
        action.midiEnabled = true
        delete action.type
        delete action.values
        delete action.defaultValues
    }

    return action
}

export function midiToNote(midi: number) {
    if (midi === undefined) return ""

    const octave = Math.floor(midi / 12) - 2
    const scaleIndexToNote = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    const note = midi % 12

    return scaleIndexToNote[note] + "(" + octave.toString() + ")"
}
