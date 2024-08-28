import { get } from "svelte/store"
import { uid } from "uid"
import { audioPlaylists, audioStreams, midiIn, outputs, shows, stageShows, styles, triggers } from "../../stores"
import { clone } from "../helpers/array"
import { history } from "../helpers/history"
import { _show } from "../helpers/shows"
import { API_ACTIONS, API_toggle } from "./api"
import { convertOldMidiToNewAction } from "./midi"
import { getActiveOutputs } from "../helpers/output"

export function runActionId(id: string) {
    runAction(get(midiIn)[id])
}

export function runAction(action, { midiIndex = -1, slideIndex = -1 } = {}) {
    console.log(action)
    if (!action) return
    action = convertOldMidiToNewAction(action)

    let triggers = action.triggers || []
    if (!triggers.length) return

    let data = action.actionValues || {}

    triggers.forEach(runTrigger)
    function runTrigger(actionId) {
        if (!API_ACTIONS[actionId]) {
            console.log("Missing API for trigger")
            return
        }

        let triggerData = data[actionId] || {}
        if (midiIndex > -1) triggerData = { ...triggerData, index: midiIndex }

        if (actionId === "start_slide_timers" && slideIndex > -1) {
            let outputRef: any = get(outputs)[getActiveOutputs()[0]]?.out?.slide || {}
            let showId = outputRef.id || "active"
            let layoutRef = _show(showId)
                .layouts(outputRef.layout ? [outputRef.layout] : "active")
                .ref()[0]
            if (layoutRef) {
                let overlayIds = layoutRef[slideIndex].data?.overlays
                triggerData = { overlayIds }
            }
        } else if (actionId === "send_midi" && triggerData.midi) triggerData = triggerData.midi

        API_ACTIONS[actionId](triggerData)
    }
}

export function toggleAction(data: API_toggle) {
    if (!data.id) return

    midiIn.update((a) => {
        if (!a[data.id]) return a

        let previousValue = a[data.id].enabled ?? true
        a[data.id].enabled = data.value ?? !previousValue

        return a
    })
}

export function checkStartupActions() {
    // WIP only for v1.1.7 (can be removed)
    midiIn.update((a) => {
        Object.keys(a).forEach((actionId) => {
            let action: any = a[actionId]
            if (action.startupEnabled && !action.customActivation) {
                delete action.startupEnabled
                action.customActivation = "startup"
            }
        })
        return a
    })

    customActionActivation("startup")
}

export function customActionActivation(id: string) {
    Object.keys(get(midiIn)).forEach((actionId) => {
        let action: any = get(midiIn)[actionId]
        if (action.customActivation === id && action.enabled !== false) runAction(action)
    })
}

export function addSlideAction(slideIndex: number, actionId: string, actionValue: any = {}, allowMultiple: boolean = false) {
    if (slideIndex < 0) return

    let ref = _show().layouts("active").ref()[0]
    if (!ref[slideIndex]) return

    let actions = clone(ref[slideIndex].data?.actions) || {}

    let id = uid()
    if (!actions.slideActions) actions.slideActions = []
    let actionValues: any = {}
    if (actionValue) actionValues[actionId] = actionValue

    let action = { id, triggers: [actionId], actionValues }

    let existingIndex = actions.slideActions.findIndex((a) => a.triggers?.[0] === actionId)
    if (allowMultiple || existingIndex < 0) actions.slideActions.push(action)
    else actions.slideActions[existingIndex] = action

    history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: [slideIndex] } })
}

export function slideHasAction(actions: any, key: string) {
    return actions?.slideActions?.find((a) => a.triggers?.includes(key))
}

// extra names

const namedObjects = {
    run_action: () => get(midiIn),
    start_show: () => get(shows),
    start_trigger: () => get(triggers),
    start_audio_stream: () => get(audioStreams),
    start_playlist: () => get(audioPlaylists),
    id_select_stage_layout: () => get(stageShows),
}
export function getActionName(actionId: string, actionValue: any) {
    if (actionId === "change_output_style") {
        return get(styles)[actionValue.outputStyle]?.name
    }

    if (actionId === "start_metronome") {
        let beats = (actionValue.beats || 4) === 4 ? "" : " | " + actionValue.beats
        return (actionValue.tempo || 120) + beats
    }

    if (!namedObjects[actionId]) return

    return namedObjects[actionId]()[actionValue.id]?.name
}
