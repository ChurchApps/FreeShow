import { clearAudio } from "../components/helpers/audio"
import { changeOutputStyle, clearAll, clearBackground, clearOverlays, clearSlide, nextSlide, previousSlide, selectProjectShow } from "../components/helpers/showActions"
import { clearTimers } from "../components/output/clear"
import { gotoGroup, selectProjectByIndex, selectSlideByIndex } from "./apiHelper"
import { send } from "./request"

/// TYPES ///

interface API {
    action: string
    id?: number
    index?: number
}
type API_id = { id: string }
type API_index = { index: number }

/// ACTIONS ///

// WIP use these for MIDI and Stage/Remote..
export const API_ACTIONS = {
    // PRESENTATION
    next_slide: () => nextSlide({ key: "ArrowRight" }),
    previous_slide: () => previousSlide({ key: "ArrowLeft" }),
    next_project_show: () => selectProjectShow("next"),
    previous_project_show: () => selectProjectShow("previous"),
    goto_group: (data: API_id) => gotoGroup(data.id),

    // MEDIA CONTROLS

    // CLEAR
    clear_all: () => clearAll(),
    clear_background: () => clearBackground(),
    clear_slide: () => clearSlide(),
    clear_overlays: () => clearOverlays(),
    clear_audio: () => clearAudio(),
    clear_next_timer: () => clearTimers(),

    // VISUAL
    change_output_style: (data: API_id) => changeOutputStyle(data.id),

    // SELECT BY INDEX
    index_select_project: (data: API_index) => selectProjectByIndex(data.index),
    index_select_project_show: (data: API_index) => selectProjectShow(data.index),
    index_select_slide: (data: API_index) => selectSlideByIndex(data.index),

    // OTHER
    // trigger "action group" (macro)
}

/// RECEIVER / SENDER ///

export function triggerAction(data: API) {
    let id = data.action

    // API start at 1, code start at 0
    if (data.index !== undefined) data.index--

    if (API_ACTIONS[id]) API_ACTIONS[id](data)
    else console.log("Missing API ACTION:", id)
}

export function sendDataAPI(data: any) {
    send("API_DATA", data)
}
