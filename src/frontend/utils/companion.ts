import { midiActions } from "./midi"

export function triggerAction(data) {
    let id = data.action

    if (id === "index_select_slide") data = data.index - 1

    if (midiActions[id]) midiActions[id](data, data)
    else console.log("Missing Companion Action:", id)
}
