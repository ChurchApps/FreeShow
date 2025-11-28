import { get } from "svelte/store"
import { uid } from "uid"
import { actionHistory, actions, audioPlaylists, audioStreams, runningActions, shows, stageShows, styles, triggers } from "../../stores"
import { newToast, wait } from "../../utils/common"
import { getShowBPM } from "../drawer/audio/metronome"
import { getDynamicValue } from "../edit/scripts/itemHelpers"
import { clone, keysToID } from "../helpers/array"
import { history } from "../helpers/history"
import { getFirstActiveOutput } from "../helpers/output"
import { getLayoutRef } from "../helpers/show"
import { _show } from "../helpers/shows"
import { actionData } from "./actionData"
import type { API_toggle } from "./api"
import { API_ACTIONS } from "./api"
import { sortByClosestMatch } from "./apiHelper"
import { convertOldMidiToNewAction } from "./midi"

export function runActionId(id: string) {
    runAction(get(actions)[id])
}

export function runActionByName(name: string) {
    if (name.includes("{")) name = getDynamicValue(name)
    const sortedActions = sortByClosestMatch(keysToID(get(actions)), name)
    if (!sortedActions.length) return
    runAction(sortedActions[0])
}

export async function runAction(action, { midiIndex = -1, slideIndex = -1 } = {}, isCategoryAction = false) {
    // console.log(action)
    if (!action) return
    action = convertOldMidiToNewAction(action)

    const actionTriggers = action.triggers || []
    if (!actionTriggers.length) return

    const actionValues = action.actionValues || {}

    // set to active
    runningActions.set([...get(runningActions), action.id])

    for (const actionId of actionTriggers) {
        await runTrigger(actionId)
    }

    // remove from active (timeout to show outline)
    setTimeout(() => {
        runningActions.update(a => {
            const currentIndex = a.findIndex(id => action.id === id)
            if (currentIndex < 0) return a
            a.splice(currentIndex, 1)
            return a
        })
    }, 20)

    async function runTrigger(actionId: string) {
        let triggerData = actionValues[actionId] || {}
        if (midiIndex > -1) triggerData = { ...triggerData, index: midiIndex }

        actionId = getActionTriggerId(actionId)

        if (actionId === "wait") {
            await wait((triggerData.number || 0) * 1000)
            return
        }

        if (!API_ACTIONS[actionId]) {
            console.error("Missing API for trigger")
            return
        }

        if (actionId === "start_slide_timers" && slideIndex > -1) {
            const outputRef = getFirstActiveOutput()?.out?.slide
            const showId = outputRef?.id || "active"
            const layoutRef = _show(showId)
                .layouts(outputRef?.layout ? [outputRef.layout] : "active")
                .ref()[0]
            if (layoutRef) {
                const overlayIds = layoutRef[slideIndex].data?.overlays
                triggerData = { overlayIds }
            }
        } else if (actionId === "send_midi" && triggerData.midi) triggerData = triggerData.midi

        if (actionId === "clear_slide" && !isCategoryAction) {
            // without this slide content might get "stuck", if cleared when transitioning
            await wait(10)
        }

        API_ACTIONS[actionId](triggerData)

        // add to history
        // WIP add source (Action/Event/Remote/API)
        actionHistory.update(a => {
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

    actions.update(a => {
        if (!a[data.id]) return a

        const previousValue = a[data.id].enabled ?? true
        a[data.id].enabled = data.value ?? !previousValue

        return a
    })
}

export function checkStartupActions() {
    customActionActivation("startup")
}

export function customActionActivation(id: string, specificActivation: any = null) {
    let actionTriggered = false
    Object.keys(get(actions)).forEach(actionId => {
        const action = get(actions)[actionId]

        if (action.customActivation !== id || action.enabled === false) return
        if (specificActivation && action.specificActivation?.includes(id) && (!action.specificActivation.split("__")[1] || action.specificActivation.split("__")[1] !== specificActivation)) return

        runAction(action)
        actionTriggered = true
    })

    if (actionTriggered && id === "startup") {
        newToast("toast.starting_action")
    }
}

export function addSlideAction(slideIndex: number, actionId: string, actionValue: any = {}, allowMultiple = false) {
    if (slideIndex < 0) return

    const ref = getLayoutRef()
    if (!ref[slideIndex]) return

    const slideActions = clone(ref[slideIndex].data?.actions) || {}

    const id = uid()
    if (!slideActions.slideActions) slideActions.slideActions = []
    const actionValues: { [key: string]: any } = {}
    if (actionValue) actionValues[actionId] = actionValue

    const action = { id, triggers: [actionId], actionValues }

    // Check if this action type can have multiple instances
    const data = actionData[actionId]
    const canAddMultiple = data?.canAddMultiple || allowMultiple

    const existingIndex = slideActions.slideActions.findIndex(a => a.triggers?.[0] === actionId)
    if (canAddMultiple || existingIndex < 0) slideActions.slideActions.push(action)
    else slideActions.slideActions[existingIndex] = action

    history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: slideActions, indexes: [slideIndex] } })
}

export function slideHasAction(slideActions: any, key: string) {
    return slideActions?.slideActions?.find(a => a.triggers?.includes(key))
}

export function getActionIcon(id: string) {
    const actionTriggers = get(actions)[id]?.triggers || {}
    if (actionTriggers.length > 1) return "actions"

    const trigger = getActionTriggerId(actionTriggers[0])
    return actionData[trigger]?.icon || "actions"
}

export function getActionTriggerId(id: string) {
    let trigger = id || ""
    if (trigger.includes(":")) trigger = trigger.slice(0, trigger.indexOf(":"))
    return trigger
}

// extra names

const namedObjects = {
    run_action: () => get(actions),
    start_show: () => get(shows),
    start_trigger: () => get(triggers),
    start_audio_stream: () => get(audioStreams),
    start_playlist: () => get(audioPlaylists),
    id_select_stage_layout: () => get(stageShows)
}
export function getActionName(actionId: string, actionValue: any): string {
    if (!actionValue) return ""

    if (actionId === "change_output_style") {
        return get(styles)[actionValue.outputStyle]?.name || ""
    }

    if (actionId === "start_metronome") {
        const beats = (actionValue.beats || 4) === 4 ? "" : " | " + actionValue.beats
        if (actionValue.metadataBPM) actionValue.tempo = getShowBPM()
        return (actionValue.tempo || 120) + beats
    }

    if (actionId === "change_volume") {
        return (Number(actionValue.volume || 1) * 100).toString()
    }

    if (!namedObjects[actionId]) return ""

    return namedObjects[actionId]()[actionValue.id]?.name || ""
}
