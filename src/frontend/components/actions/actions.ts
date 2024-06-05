import { get } from "svelte/store"
import { midiIn } from "../../stores"
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
                console.log(layoutRef[slideIndex], layoutRef)
                let overlayIds = layoutRef[slideIndex].data?.overlays
                triggerData = { overlayIds }
            }
        }

        API_ACTIONS[actionId](triggerData)
    }
}
