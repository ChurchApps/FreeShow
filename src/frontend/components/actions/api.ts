import { MAIN } from "../../../types/Channels"
import type { MidiValues, TransitionType } from "../../../types/Show"
import { send } from "../../utils/request"
import { updateTransition } from "../../utils/transitions"
import { startMetronome } from "../drawer/audio/metronome"
import { audioPlaylistNext, clearAudio, startPlaylist, updateVolume } from "../helpers/audio"
import { getSlideThumbnail, getThumbnail } from "../helpers/media"
import { changeStageOutputLayout, displayOutputs, startCamera, toggleOutput } from "../helpers/output"
import { activateTriggerSync, changeOutputStyle, nextSlideIndividual, playSlideTimers, previousSlideIndividual, randomSlide, selectProjectShow, sendMidi, startAudioStream, startShowSync } from "../helpers/showActions"
import { playSlideRecording } from "../helpers/slideRecording"
import { startTimerById, startTimerByName, stopTimers } from "../helpers/timerTick"
import { clearAll, clearBackground, clearOverlays, clearSlide, clearTimers, restoreOutput } from "../output/clear"
import { formatText } from "../show/formatTextEditor"
import { runActionId, toggleAction } from "./actions"
import { getOutput, getPlayingAudioTime, getPlayingPlaylist, getPlayingVideoTime, getPlaylists, getProject, getProjects, getShow, getShowLayout, getShows, getSlide } from "./apiGet"
import {
    addGroup,
    changeShowLayout,
    changeVariable,
    getClearedState,
    getPlainText,
    getShowGroups,
    gotoGroup,
    moveStageConnection,
    playMedia,
    rearrangeGroups,
    selectOverlayByIndex,
    selectOverlayByName,
    selectProjectByIndex,
    selectShowByName,
    selectSlideByIndex,
    selectSlideByName,
    setShowAPI,
    setTemplate,
    startScripture,
    toggleLock,
} from "./apiHelper"
import { oscToAPI } from "./apiOSC"
import { emitData } from "./emitters"
import { sendRestCommandSync } from "./rest"

/// STEPS TO CREATE A CUSTOM API ACTION ///

// 1. Create an ID like this: "next_slide" & put it in this file with a custom function
// 2. Assign an existing data type or create a new one if it's needed

// It can now be called with Companion/WebSocket/REST
// Follow the next steps to integrate it into "Actions" in the program as well

// 3. In actionData.ts add an entry with the action ID, "name", "icon" & "input"
// 4. Add a string entry in en.json>"actions">ID, and find a fitting icon in icons.ts
// 5. If it should be excluded from the default slide actions, add the ID in CreateAction.svelte
// 6. If a special custom "input" is needed, add it to CustomInput.svelte

// Now you're all set! :)

/// TYPES ///

interface API {
    action: string
    id?: number
    index?: number
    returnId?: string
}
type API_id = { id: string }
export type API_id_optional = { id?: string }
type API_index = { index: number }
type API_boolval = { value?: boolean }
type API_strval = { value: string }
type API_volume = { volume?: number; gain?: number } // no values will mute/unmute
export type API_slide = { showId?: string | "active"; slideId?: string }
export type API_slide_index = { showId?: string; layoutId?: string; index: number }
export type API_id_value = { id: string; value: string }
export type API_rearrange = { showId: string; from: number; to: number }
export type API_group = { showId: string; groupId: string }
export type API_layout = { showId: string; layoutId: string }
export type API_slide_thumbnail = { showId?: string; layoutId?: string; index?: number }
export type API_media = { path: string }
export type API_scripture = { id: string; reference: string }
export type API_toggle = { id: string; value?: boolean }
export type API_stage_output_layout = { outputId?: string; stageLayoutId: string }
export type API_output_style = { outputStyle?: string; styleOutputs?: any }
export type API_camera = { name?: string; id: string; groupId?: any }
export type API_transition = {
    id?: "text" | "media" // default: "text"
    type?: TransitionType // default: "fade"
    duration?: number // default: 500
    easing?: string // default: "sine"
}
export type API_variable = {
    id?: string
    name?: string
    index?: number
    // no values will toggle on/off:
    key?: "text" | "number" | "value" | "enabled" | "step" | "name" | "type" // default: "enabled"
    value?: string | number | boolean
    variableAction?: "increment" | "decrement"
}
export interface API_midi extends MidiValues {
    type: "noteon" | "noteoff"
    defaultValues?: boolean // only used by actions
}
export type API_metronome = {
    tempo?: number
    beats?: number
    volume?: number
    // notesPerBeat?: number
    audioOutput?: string
}
export type API_rest_command = {
    url: string
    method: string
    contentType: string
    payload: string
}
export type API_emitter = {
    emitter: string
    template?: string
    templateValues?: { name: string; value: string }[]
}

/// ACTIONS ///

// WIP use these for Stage/Remote..?
// BC = Integrated to Bitfocus Companion.
export const API_ACTIONS = {
    // PROJECT
    index_select_project: (data: API_index) => selectProjectByIndex(data.index), // BC
    next_project_item: () => selectProjectShow("next"), // BC
    previous_project_item: () => selectProjectShow("previous"), // BC
    index_select_project_item: (data: API_index) => selectProjectShow(data.index), // BC

    // SHOWS
    name_select_show: (data: API_strval) => selectShowByName(data.value), // BC
    start_show: (data: API_id) => startShowSync(data.id),
    change_layout: (data: API_layout) => changeShowLayout(data),
    set_plain_text: (data: API_id_value) => formatText(data.value, data.id),
    set_show: (data: API_id_value) => setShowAPI(data.id, data.value),
    rearrange_groups: (data: API_rearrange) => rearrangeGroups(data),
    add_group: (data: API_group) => addGroup(data),
    set_template: (data: API_id) => setTemplate(data.id),

    // PRESENTATION
    next_slide: () => nextSlideIndividual({ key: "ArrowRight" }), // BC
    previous_slide: () => previousSlideIndividual({ key: "ArrowLeft" }), // BC
    random_slide: () => randomSlide(), // BC
    index_select_slide: (data: API_slide_index) => selectSlideByIndex(data), // BC
    name_select_slide: (data: API_strval) => selectSlideByName(data.value), // BC
    id_select_group: (data: API_id) => gotoGroup(data.id), // BC
    lock_output: (data: API_boolval) => toggleLock(data.value), // BC
    toggle_output_windows: () => displayOutputs(), // BC
    // WIP disable stage ?
    // WIP disable NDI ?
    // index_select_layout | name_select_layout
    start_scripture: (data: API_scripture) => startScripture(data),

    // STAGE
    id_select_stage_layout: (data: API_id) => moveStageConnection(data.id), // BC

    // CLEAR
    restore_output: () => restoreOutput(), // BC
    clear_all: () => clearAll(), // BC
    clear_background: () => clearBackground(), // BC
    clear_slide: () => clearSlide(), // BC
    clear_overlays: () => clearOverlays(), // BC
    clear_audio: () => clearAudio(), // BC
    clear_next_timer: () => clearTimers(), // BC

    // MEDIA (Backgrounds)
    start_camera: (data: API_camera) => startCamera(data),
    play_media: (data: API_media) => playMedia(data),
    // play / pause playing
    // control time
    // folder_select_media
    // index_select_camera
    // index_select_screen...
    // path_select_media (can be url)

    // OVERLAYS
    index_select_overlay: (data: API_index) => selectOverlayByIndex(data.index), // BC
    name_select_overlay: (data: API_strval) => selectOverlayByName(data.value), // BC

    // AUDIO
    // play / pause playing audio
    // control audio time
    // start specific folder (playlist)
    // folder_select_audio: () => ,
    change_volume: (data: API_volume) => updateVolume(data.volume ?? data.gain, data.gain !== undefined), // BC
    start_audio_stream: (data: API_id) => startAudioStream(data),
    start_playlist: (data: API_id) => startPlaylist(data.id),
    playlist_next: () => audioPlaylistNext(),
    start_metronome: (data: API_metronome) => startMetronome(data),

    // TIMERS
    // play / pause playing timers
    // control timer time
    // start specific timer (by name / index)
    name_start_timer: (data: API_strval) => startTimerByName(data.value),
    id_start_timer: (data: API_id) => startTimerById(data.id),
    start_slide_timers: (data: API_slide) => playSlideTimers(data),
    stop_timers: () => stopTimers(),
    start_slide_recording: () => playSlideRecording(),

    // VISUAL
    id_select_output_style: (data: API_id) => changeOutputStyle({ outputStyle: data.id }), // BC
    change_output_style: (data: API_output_style) => changeOutputStyle(data), // BC
    change_stage_output_layout: (data: API_stage_output_layout) => changeStageOutputLayout(data),
    change_transition: (data: API_transition) => updateTransition(data), // BC

    // OTHER
    change_variable: (data: API_variable) => changeVariable(data), // BC
    start_trigger: (data: API_id) => activateTriggerSync(data.id),
    send_midi: (data: API_midi) => sendMidi(data),
    run_action: (data: API_id) => runActionId(data.id),
    toggle_action: (data: API_toggle) => toggleAction(data),
    toggle_output: (data: API_id) => toggleOutput(data.id),
    send_rest_command: (data: API_rest_command) => sendRestCommandSync(data), // DEPRECATED, use emit_action instead

    emit_action: (data: API_emitter) => emitData(data),

    // GET
    get_shows: () => getShows(),
    get_show: (data: API_id) => getShow(data),
    get_show_layout: (data: API_id) => getShowLayout(data),
    get_projects: () => getProjects(),
    get_project: (data: API_id) => getProject(data),
    get_plain_text: (data: API_id) => getPlainText(data.id),
    get_groups: (data: API_id) => getShowGroups(data.id),

    get_output: (data: API_id_optional) => getOutput(data),
    get_playing_video_time: () => getPlayingVideoTime(),
    get_playing_audio_time: () => getPlayingAudioTime(),
    get_playlists: () => getPlaylists(),
    get_playlist: (data: API_id_optional) => getPlayingPlaylist(data),
    get_slide: (data: API_slide) => getSlide(data),

    get_thumbnail: (data: API_media) => getThumbnail(data),
    get_slide_thumbnail: (data: API_slide_thumbnail) => getSlideThumbnail(data),
    get_cleared: () => getClearedState(),
}

/// RECEIVER / SENDER ///

export async function triggerAction(data: API) {
    // Open Sound Control format
    if (data.action.startsWith("/")) data = oscToAPI(data)

    let id = data.action

    // API start at 1, code start at 0
    if (data.index !== undefined) data.index--

    if (!API_ACTIONS[id]) return console.log("Missing API ACTION:", id)

    let returnId = data.returnId
    delete data.returnId
    const returnData = await API_ACTIONS[id](data)
    if (!returnId || returnData === undefined) return

    send(MAIN, ["API_TRIGGER"], { ...data, returnId, data: returnData })
}

export function sendDataAPI(data: any) {
    send("API_DATA", data)
}
