import { get } from "svelte/store"
import { MAIN } from "../../types/Channels"
import { getActiveOutputs, setOutput } from "../components/helpers/output"
import { changeOutputStyle, clearAll, nextSlide, playNextGroup, previousSlide, updateOut } from "../components/helpers/showActions"
import { _show } from "../components/helpers/shows"
import { activeShow, groups, midiIn, outputs, shows } from "../stores"
import { send } from "./request"

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
        // nextSlide({ key: " " }, true)
        nextSlide({})
    },
    previous_slide: () => {
        previousSlide()
    },
    clear_all: () => {
        clearAll()
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
    change_output_style: (data: any) => changeOutputStyle(data.style),
}
export const midiNames = {
    next_slide: "preview._next_slide",
    previous_slide: "preview._previous_slide",
    clear_all: "clear.all",
}
export const defaultMidiActionChannels = {
    next_slide: { type: "noteon", values: { note: 1, velocity: -1, channel: 1 } },
    previous_slide: { type: "noteon", values: { note: 2, velocity: -1, channel: 1 } },
    clear_all: { type: "noteon", values: { note: 3, velocity: -1, channel: 1 } },
    goto_group: { type: "noteon", values: { note: 10, velocity: -1, channel: 1 } },
    change_output_style: { type: "noteoff", values: { note: 1, velocity: -1, channel: 1 } },
}

export function playMidiIn(msg) {
    let midi = get(midiIn)[msg.id]
    if (!midi) return

    if (midi.values.velocity < 0) msg.values.velocity = midi.values.velocity
    if (JSON.stringify(midi.values) !== JSON.stringify(msg.values)) return

    if (midi.action) {
        midiActions[midi.action](midi.actionData)
        return
    }

    let shows: any[] = midi?.shows || []
    shows.forEach(({ id }) => {
        let refs = _show(id).layouts().ref()
        refs.forEach((ref) => {
            ref.forEach((slideRef) => {
                let receiveMidi = slideRef.data.actions?.receiveMidi
                if (!receiveMidi) return
                if (receiveMidi !== msg.id) return
                // start slide
                updateOut(id, slideRef.layoutIndex, ref)
                setOutput("slide", { id, layout: slideRef.layoutId, index: slideRef.layoutIndex, line: 0 })
            })
        })
    })
}
