import type { TransitionType } from "../../../types/Show"
import { clearAudio, updateVolume } from "../helpers/audio"
import { displayOutputs } from "../helpers/output"
import { changeOutputStyle, clearAll, clearBackground, clearOverlays, clearSlide, nextSlide, previousSlide, restoreOutput, selectProjectShow } from "../helpers/showActions"
import { clearTimers } from "../output/clear"
import { changeVariable, gotoGroup, moveStageConnection, selectOverlayByIndex, selectOverlayByName, selectProjectByIndex, selectShowByName, selectSlideByIndex, selectSlideByName, toggleLock } from "./apiHelper"
import { send } from "../../utils/request"
import { updateTransition } from "../../utils/transitions"

/// TYPES ///

interface API {
    action: string
    id?: number
    index?: number
}
type API_id = { id: string }
type API_index = { index: number }
type API_boolval = { value?: boolean }
type API_strval = { value: string }
type API_volume = { volume?: number; gain?: number } // no values will mute/unmute
export type API_transition = {
    id?: "text" | "media" // default: "text"
    type?: TransitionType // default: "fade"
    duration?: number // default: 500
    easing?: string // default: "sine"
}
export type API_variable = {
    name?: string
    index?: number
    // no values will toggle on/off:
    key?: "text" | "number" | "enabled" | "step" | "name" | "type" // default: "enabled"
    value?: string | number
    variableAction?: "increment" | "decrement"
}

/// ACTIONS ///

// WIP use these for MIDI and Stage/Remote..
export const API_ACTIONS = {
    // PROJECT
    index_select_project: (data: API_index) => selectProjectByIndex(data.index),
    next_project_item: () => selectProjectShow("next"),
    previous_project_item: () => selectProjectShow("previous"),
    index_select_project_item: (data: API_index) => selectProjectShow(data.index),

    // SHOWS
    name_select_show: (data: API_strval) => selectShowByName(data.value),

    // PRESENTATION
    next_slide: () => nextSlide({ key: "ArrowRight" }),
    previous_slide: () => previousSlide({ key: "ArrowLeft" }),
    index_select_slide: (data: API_index) => selectSlideByIndex(data.index),
    name_select_slide: (data: API_strval) => selectSlideByName(data.value),
    lock_output: (data: API_boolval) => toggleLock(data.value),
    toggle_output_windows: () => displayOutputs(),
    // WIP disable stage ?
    // WIP disable NDI ?
    id_select_group: (data: API_id) => gotoGroup(data.id),
    // index_select_layout | name_select_layout

    // STAGE
    id_select_stage_layout: (data: API_id) => moveStageConnection(data.id),

    // CLEAR
    restore_output: () => restoreOutput(),
    clear_all: () => clearAll(),
    clear_background: () => clearBackground(),
    clear_slide: () => clearSlide(),
    clear_overlays: () => clearOverlays(),
    clear_audio: () => clearAudio(),
    clear_next_timer: () => clearTimers(),

    // MEDIA (Backgrounds)
    // play / pause playing
    // control time
    // folder_select_media
    // index_select_camera
    // index_select_screen...
    // path_select_media (can be url)

    // OVERLAYS
    index_select_overlay: (data: API_index) => selectOverlayByIndex(data.index),
    name_select_overlay: (data: API_strval) => selectOverlayByName(data.value),

    // AUDIO
    // play / pause playing audio
    // control audio time
    // start specific folder (playlist)
    // folder_select_audio: () => ,
    change_volume: (data: API_volume) => updateVolume(data.volume ?? data.gain, data.gain !== undefined),

    // TIMERS
    // play / pause playing timers
    // control timer time
    // start specific timer (by name / index)

    // VISUAL
    id_select_output_style: (data: API_id) => changeOutputStyle(data.id),
    change_transition: (data: API_transition) => updateTransition(data),

    // OTHER
    change_variable: (data: API_variable) => changeVariable(data),
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
