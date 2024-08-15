import { get } from "svelte/store"
import { MAIN } from "../../../types/Channels"
import type { Midi } from "../../../types/Show"
import { midiIn, shows } from "../../stores"
import { send } from "../../utils/request"
import { clone } from "../helpers/array"
import { setOutput } from "../helpers/output"
import { updateOut } from "../helpers/showActions"
import { _show } from "../helpers/shows"
import { runAction } from "./actions"
import { newToast } from "../../utils/common"
import { loadShows } from "../helpers/setShow"

export function midiInListen() {
    Object.entries(get(midiIn)).forEach(([id, action]: any) => {
        action = convertOldMidiToNewAction(action)
        if (!action.midi) return

        if (!action.shows?.length) {
            console.info("MIDI INPUT LISTENER: ", action.midi)
            send(MAIN, ["RECEIVE_MIDI"], { id, ...action.midi })

            return
        }

        action.shows.forEach(async (show) => {
            if (!get(shows)[show.id]) return

            await loadShows([show.id])

            // check that current show actually has this MIDI receive action
            let layouts: any[] = _show(show.id).layouts().get()
            let found: boolean = false
            layouts.forEach((layout) => {
                layout.slides.forEach((slide) => {
                    if (slide.actions?.receiveMidi === id) found = true

                    if (slide.children) {
                        Object.values(slide.children).forEach((child: any) => {
                            if (child.actions?.receiveMidi === id) found = true
                        })
                    }
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

                console.info("MIDI INPUT LISTENER: ", action.midi)
                send(MAIN, ["RECEIVE_MIDI"], { id, ...action.midi })
            }
        })
    })
}

// WIP add more presets based on api.ts
export const defaultMidiActionChannels = {
    // presentation
    next_slide: { type: "noteon", values: { note: 0, velocity: -1, channel: 1 } },
    previous_slide: { type: "noteon", values: { note: 1, velocity: -1, channel: 1 } },
    next_project_show: { type: "noteon", values: { note: 2, velocity: -1, channel: 1 } },
    previous_project_show: { type: "noteon", values: { note: 3, velocity: -1, channel: 1 } },
    goto_group: { type: "noteon", values: { note: 4, velocity: -1, channel: 1 } },

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
}

export function receivedMidi(msg) {
    let msgAction = get(midiIn)[msg.id]
    if (!msgAction) return

    let action: Midi = convertOldMidiToNewAction(msgAction)

    // get index
    if (!msg.values) msg.values = {}
    let index = msg.values.velocity ?? -1
    if (action.midi?.values?.velocity !== undefined && action.midi.values.velocity < 0) index = -1

    // the select slide index from velocity can't select slide 0 as a NoteOn with velocity 0 is detected as NoteOff
    // velocity of 0 currently bypasses the note on/off
    const diff_type = action.midi?.type !== msg.type
    const diff_note = msg.values.note !== action.midi?.values.note
    const diff_channel = msg.values.channel !== action.midi?.values.channel
    if (!msg.bypass && (diff_type || diff_note || diff_channel) && index !== 0) return

    let hasindex = action.triggers?.[0]?.includes("index_") ?? false
    if (hasindex && index < 0) {
        newToast("$toast.midi_no_velocity")
        index = 0
    }

    // decrease index by one, to make velocity 1 select slide 0 (Labeled 1)
    if (index > 0) index--

    runAction(action, { midiIndex: index })

    let shows: any[] = action?.shows || []
    if (!shows?.length) return

    let slidePlayed: boolean = false
    shows.forEach(async ({ id }) => {
        await loadShows([id])
        let refs = _show(id).layouts().ref()

        refs.forEach((ref) => {
            ref.forEach((slideRef) => {
                if (slidePlayed) return

                let receiveMidi = slideRef.data.actions?.receiveMidi
                if (!receiveMidi || receiveMidi !== msg.id) return

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
