import { get } from "svelte/store"
import { uid } from "uid"
import { actionHistory, audioPlaylists, audioStreams, midiIn, outputs, runningActions, shows, stageShows, styles, triggers } from "../../stores"
import { clone } from "../helpers/array"
import { history } from "../helpers/history"
import { _show } from "../helpers/shows"
import { API_ACTIONS, API_toggle } from "./api"
import { convertOldMidiToNewAction } from "./midi"
import { getActiveOutputs } from "../helpers/output"
import { newToast, wait } from "../../utils/common"
import { actionData } from "./actionData"
import { getLayoutRef } from "../helpers/show"

export function runActionId(id: string) {
    runAction(get(midiIn)[id])
}

export async function runAction(action, { midiIndex = -1, slideIndex = -1 } = {}) {
    // console.log(action)
    if (!action) return
    action = convertOldMidiToNewAction(action)

    const triggers = action.triggers || []
    if (!triggers.length) return

    const data = action.actionValues || {}

    // set to active
    runningActions.set([...get(runningActions), action.id])

    for (const actionId of triggers) {
        await runTrigger(actionId)
    }

    // remove from active (timeout to show outline)
    setTimeout(() => {
        runningActions.update((a) => {
            const currentIndex = a.findIndex((id) => action.id === id)
            if (currentIndex < 0) return a
            a.splice(currentIndex, 1)
            return a
        })
    }, 20)

    async function runTrigger(actionId: string) {
        let triggerData = data[actionId] || {}
        if (midiIndex > -1) triggerData = { ...triggerData, index: midiIndex }

        actionId = getActionTriggerId(actionId)

        if (actionId === "wait") {
            await wait(triggerData.number * 1000)
            return
        }

        if (!API_ACTIONS[actionId]) {
            console.log("Missing API for trigger")
            return
        }

        if (actionId === "start_slide_timers" && slideIndex > -1) {
            const outputRef = get(outputs)[getActiveOutputs()[0]]?.out?.slide
            const showId = outputRef?.id || "active"
            const layoutRef = _show(showId)
                .layouts(outputRef?.layout ? [outputRef.layout] : "active")
                .ref()[0]
            if (layoutRef) {
                const overlayIds = layoutRef[slideIndex].data?.overlays
                triggerData = { overlayIds }
            }
        } else if (actionId === "send_midi" && triggerData.midi) triggerData = triggerData.midi

        if (actionId === "clear_slide") {
            // without this slide content might get "stuck", if cleared when transitioning
            await wait(10)
        }

        API_ACTIONS[actionId](triggerData)

        // add to history
        // WIP add source (Action/Event/Remote/API)
        actionHistory.update((a) => {
            const time = Date.now()

            const previous = clone(a[0] || {})
            previous.count = 1
            previous.time = time

            const data = { action: actionId, data: triggerData, time, count: 1 }
            const matchingPrevious = JSON.stringify(previous) === JSON.stringify(data)

            if (matchingPrevious) {
                a[0].time = time
                a[0].count++
            } else {
                a.unshift(data)
            }

            return a
        })
    }
}

export function toggleAction(data: API_toggle) {
    if (!data.id) return

    midiIn.update((a) => {
        if (!a[data.id]) return a

        const previousValue = a[data.id].enabled ?? true
        a[data.id].enabled = data.value ?? !previousValue

        return a
    })
}

export function checkStartupActions() {
    // WIP only for v1.1.7 (can be removed)
    midiIn.update((a) => {
        Object.keys(a).forEach((actionId) => {
            const action = a[actionId]
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
    let actionTriggered = false
    Object.keys(get(midiIn)).forEach((actionId) => {
        const action = get(midiIn)[actionId]
        const customActivation = id.split("___")[0]
        const specificActivation = id.split("___")[1]

        if (action.customActivation !== customActivation || action.enabled === false) return
        if (specificActivation && action.specificActivation?.includes(customActivation) && action.specificActivation.split("__")[1] !== specificActivation) return

        runAction(action)
        actionTriggered = true
    })

    if (actionTriggered && id === "startup") {
        newToast("$toast.starting_action")
    }
}

export function addSlideAction(slideIndex: number, actionId: string, actionValue: any = {}, allowMultiple = false) {
    if (slideIndex < 0) return

    const ref = getLayoutRef()
    if (!ref[slideIndex]) return

    const actions = clone(ref[slideIndex].data?.actions) || {}

    const id = uid()
    if (!actions.slideActions) actions.slideActions = []
    const actionValues: { [key: string]: any } = {}
    if (actionValue) actionValues[actionId] = actionValue

    const action = { id, triggers: [actionId], actionValues }

    const existingIndex = actions.slideActions.findIndex((a) => a.triggers?.[0] === actionId)
    if (allowMultiple || existingIndex < 0) actions.slideActions.push(action)
    else actions.slideActions[existingIndex] = action

    history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: [slideIndex] } })
}

export function slideHasAction(actions: any, key: string) {
    return actions?.slideActions?.find((a) => a.triggers?.includes(key))
}

export function getActionIcon(id: string) {
    const actions = get(midiIn)[id]?.triggers || {}
    if (actions.length > 1) return "actions"

    const trigger = getActionTriggerId(actions[0])
    return actionData[trigger]?.icon || "actions"
}

export function getActionTriggerId(id: string) {
    let trigger = id || ""
    if (trigger.includes(":")) trigger = trigger.slice(0, trigger.indexOf(":"))
    return trigger
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
        const beats = (actionValue.beats || 4) === 4 ? "" : " | " + actionValue.beats
        return (actionValue.tempo || 120) + beats
    }

    if (actionId === "change_volume") {
        return Number(actionValue.volume || 1) * 100
    }

    if (!namedObjects[actionId]) return

    return namedObjects[actionId]()[actionValue.id]?.name
}
