import { get } from "svelte/store"
import { uid } from "uid"
import { midiIn } from "../../stores"
import { clone } from "../helpers/array"
import { history } from "../helpers/history"
import { _show } from "../helpers/shows"
import { API_ACTIONS } from "./api"
import { convertOldMidiToNewAction } from "./midi"

export function runActionId(id: string) {
    runAction(get(midiIn)[id])
}

export function runAction(action, { midiIndex = -1, slideIndex = -1 } = {}) {
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
            let layoutRef = _show("active").layouts().ref()[0]
            if (layoutRef) {
                let overlayIds = layoutRef[slideIndex].data?.overlays
                triggerData = { overlayIds }
            }
        } else if (actionId === "send_midi" && triggerData.midi) triggerData = triggerData.midi

        API_ACTIONS[actionId](triggerData)
    }
}

export function checkStartupActions() {
    Object.keys(get(midiIn)).forEach((actionId) => {
        let action = get(midiIn)[actionId]
        if (action.startupEnabled) runAction(action)
    })
}

export function addSlideAction(slideIndex: number, actionId: string, actionValue: any = {}) {
    if (slideIndex < 0) return

    let ref = _show().layouts("active").ref()[0]
    if (!ref[slideIndex]) return

    let actions = clone(ref[slideIndex].data?.actions) || {}

    let id = uid()
    if (!actions.slideActions) actions.slideActions = []
    let actionValues: any = {}
    if (actionValue) actionValues[actionId] = actionValue

    let action = { id, triggers: [actionId], actionValues }
    actions.slideActions.push(action)

    history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: [slideIndex] } })
}
