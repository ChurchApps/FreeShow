import { get } from "svelte/store"
import { MAIN } from "../../types/Channels"
import { clearAudio } from "../components/helpers/audio"
import { getActiveOutputs, setOutput } from "../components/helpers/output"
import { changeOutputStyle, clearAll, clearOverlays, nextSlide, playNextGroup, previousSlide, selectProjectShow, updateOut } from "../components/helpers/showActions"
import { _show } from "../components/helpers/shows"
import { clearTimers } from "../components/output/clear"
import { activeProject, activeShow, dictionary, groups, midiIn, outLocked, outputs, projects, shows } from "../stores"
import { send } from "./request"
import { keysToID } from "../components/helpers/array"
import { newToast } from "./messages"

export function midiInListen() {
    console.log("MIDI IN LISTEN")

    console.log(get(midiIn))

    Object.entries(get(midiIn)).forEach(([id, midi]: any) => {
        if (midi.shows?.length) {
            midi.shows.forEach((show) => {
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
                    if (!midi.input) return
                    send(MAIN, ["RECEIVE_MIDI"], { id, ...midi })
                }
            })
        } else {
            send(MAIN, ["RECEIVE_MIDI"], { id, ...midi })
        }
    })
}

export const midiActions = {
    next_slide: () => {
        nextSlide({ key: " " }, true)
    },
    previous_slide: () => {
        previousSlide({ key: " " })
    },
    next_project_show: () => {
        selectProjectShow("next")
    },
    previous_project_show: () => {
        selectProjectShow("previous")
    },
    goto_group: (data: any) => {
        // WIP duplicate of Preview.svelte checkGroupShortcuts()

        let outputId = getActiveOutputs(get(outputs))[0]
        let currentOutput: any = outputId ? get(outputs)[outputId] || {} : {}
        let outSlide = currentOutput.out?.slide
        let currentShowId = outSlide?.id || (get(activeShow) !== null ? (get(activeShow)!.type === undefined || get(activeShow)!.type === "show" ? get(activeShow)!.id : null) : null)
        if (!currentShowId) return

        let showRef = _show(currentShowId).layouts("active").ref()[0] || []
        let groupIds = showRef.map((a) => a.id)
        let showGroups = groupIds.length ? _show(currentShowId).slides(groupIds).get() : []
        if (!showGroups.length) return

        let globalGroupIds: string[] = []
        Object.keys(get(groups)).forEach((groupId: string) => {
            if (groupId !== data.group) return
            showGroups.forEach((slide) => {
                if (slide.globalGroup === groupId) globalGroupIds.push(slide.id)
            })
        })

        playNextGroup(globalGroupIds, { showRef, outSlide, currentShowId })
    },

    clear_all: () => {
        clearAll()
    },
    clear_background: () => {
        // callVideoClear = true
        setOutput("background", null)
    },
    clear_slide: () => {
        setOutput("slide", null)
    },
    clear_overlays: () => {
        clearOverlays()
    },
    clear_audio: () => {
        clearAudio()
    },
    clear_next_timer: () => {
        clearTimers()
    },

    change_output_style: (data: any) => changeOutputStyle(data.style),

    index_select_project: (_, index: number) => {
        if (index < 0) return
        // select project
        let selectedProject = keysToID(get(projects)).sort((a, b) => a.name.localeCompare(b.name))[index]
        if (!selectedProject) {
            newToast(get(dictionary).toast?.midi_no_project + " " + index)
            return
        }

        activeProject.set(selectedProject.id)
    },
    index_select_project_show: (_, index: number) => {
        if (index < 0) return
        selectProjectShow(index)
    },
    index_select_slide: (_, index: number) => {
        let showRef = _show().layouts("active").ref()[0]
        if (!showRef) {
            newToast("$toast.midi_no_show")
            return
        }

        let slideRef = showRef[index]
        if (!slideRef) {
            newToast(get(dictionary).toast?.midi_no_slide + " " + index)
            return
        }

        // WIP duplicate of Slides.svelte:57 (slideClick)
        if (get(outLocked)) return

        updateOut("active", index, showRef)
        let showId = get(activeShow)!.id
        let activeLayout = _show().get("settings.activeLayout")
        setOutput("slide", { id: showId, layout: activeLayout, index, line: 0 })
    },
}
export const midiNames = {
    next_slide: "preview._next_slide",
    previous_slide: "preview._previous_slide",
    next_project_show: "preview._next_show",
    previous_project_show: "preview._previous_show",
    clear_all: "clear.all",
    clear_background: "clear.background",
    clear_slide: "clear.slide",
    clear_overlays: "clear.overlays",
    clear_audio: "clear.audio",
    clear_next_timer: "clear.nextTimer",
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

export function playMidiIn(msg) {
    let midi = get(midiIn)[msg.id]
    if (!midi) return

    if (midi.values.velocity < 0) msg.values.velocity = midi.values.velocity
    if (JSON.stringify(midi.values) !== JSON.stringify(msg.values)) return

    if (midi.action) {
        let index = midi.values.velocity
        if (midi.action.includes("index_") && index < 0) {
            newToast("$toast.midi_no_velocity")
            index = 0
        }
        midiActions[midi.action](midi.actionData, index)
        return
    }

    let shows: any[] = midi?.shows || []
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

export function midiToNote(midi: number) {
    if (midi === undefined) return ""

    const octave = Math.floor(midi / 12) - 2
    const scaleIndexToNote = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    const note = midi % 12

    return scaleIndexToNote[note] + "(" + octave.toString() + ")"
}
