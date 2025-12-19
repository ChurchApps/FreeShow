import { Main } from "../../../types/IPC/Main"
import type { MidiValues, TransitionType } from "../../../types/Show"
import { clearAudio } from "../../audio/audioFading"
import { AudioPlayer } from "../../audio/audioPlayer"
import { AudioPlaylist } from "../../audio/audioPlaylist"
import { convertText } from "../../converters/txt"
import { sendMain } from "../../IPC/main"
import { transposeText } from "../../utils/chordTranspose"
import { triggerFunction } from "../../utils/common"
import { syncDrive } from "../../utils/drive"
import { togglePlayingMedia } from "../../utils/shortcuts"
import { contentProviderSync } from "../../utils/startup"
import { updateTransition } from "../../utils/transitions"
import { startMetronome } from "../drawer/audio/metronome"
import { pauseAllTimers } from "../drawer/timers/timers"
import { getSlideThumbnail, getThumbnail } from "../helpers/media"
import { changeStageOutputLayout, startCamera, startScreen, toggleOutput, toggleOutputs } from "../helpers/output"
import { activateTriggerSync, changeOutputStyle, nextSlideIndividual, playSlideTimers, previousSlideIndividual, randomSlide, replaceDynamicValues, selectProjectShow, sendMidi, startShowSync } from "../helpers/showActions"
import { playSlideRecording } from "../helpers/slideRecording"
import { startTimerById, startTimerByName, stopTimers } from "../helpers/timerTick"
import { clearAll, clearBackground, clearDrawing, clearOverlay, clearOverlays, clearSlide, clearTimers, restoreOutput } from "../output/clear"
import { formatText } from "../show/formatTextEditor"
import { getPlainEditorText } from "../show/getTextEditor"
import { runActionByName, runActionId, toggleAction } from "./actions"
import { getOutput, getOutputGroupName, getOutputSlideText, getPlayingAudioData, getPlayingAudioDuration, getPlayingAudioTime, getPlayingPlaylist, getPlayingVideoDuration, getPlayingVideoState, getPlayingVideoTime, getPlaylists, getProject, getProjects, getShow, getShowLayout, getShows, getSlide, getVariable, getVariables } from "./apiGet"
import {
    addGroup,
    addToProject,
    audioSeekTo,
    changeDrawZoom,
    changeShowLayout,
    changeVariable,
    createProject,
    deleteProject,
    editTimer,
    getClearedState,
    getPDFThumbnails,
    getPlainText,
    getShowGroups,
    getTimersDetailed,
    gotoGroup,
    moveStageConnection,
    pauseAudio,
    pauseTimerById,
    pauseTimerByName,
    playAudio,
    playMedia,
    rearrangeGroups,
    removeProjectItem,
    renameProject,
    selectEffectById,
    selectOverlayById,
    selectOverlayByIndex,
    selectOverlayByName,
    selectProjectById,
    selectProjectByIndex,
    selectProjectByName,
    selectShowByName,
    selectSlideByIndex,
    selectSlideByName,
    setShowAPI,
    setTemplate,
    startPlaylistByName,
    startScripture,
    stopAudio,
    stopTimerById,
    stopTimerByName,
    timerSeekTo,
    toggleLock,
    toggleLogSongUsage,
    toggleMediaLoop,
    toggleMediaMute,
    getMediaLoopState,
    updateVolumeValues,
    videoSeekTo
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
type API_strval = { value: string }
type API_volume = { volume?: number } // no values will mute/unmute
export type API_id_index = { id: string; index: number }
export type API_slide = { showId?: string | "active"; slideId?: string }
export type API_slide_index = { showId?: string; layoutId?: string; index: number }
export type API_id_value = { id: string; value: string }
export type API_rearrange = { showId: string; from: number; to: number }
export type API_group = { showId: string; groupId: string }
export type API_layout = { showId: string; layoutId: string }
export type API_slide_thumbnail = { showId?: string; layoutId?: string; index?: number }
export type API_seek = { id?: string; seconds: number }
export type API_media = { path: string; index?: number; data?: any }
export type API_scripture = { id?: string; reference: string }
export type API_toggle = { id: string; value?: boolean }
export type API_toggle_specific = { value?: boolean }
export type API_stage_output_layout = { outputId?: string; stageLayoutId: string }
export type API_output_style = { outputId?: string; styleId?: string }
export type API_output_lock = { value?: boolean; outputId?: string }
export type API_camera = { name?: string; id: string; groupId?: string }
export type API_screen = { name?: string; id: string }
export type API_dynamic_value = { value: string; ref?: any }
export type API_draw_zoom = { size?: number; x?: number; y?: number }
export type API_edit_timer = { id: string; key: string; value: any }
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
    key?: "text" | "number" | "random_number" | "text_set" | "value" | "enabled" | "step" | "name" | "type" | "increment" | "decrement" | "expression" | "randomize" | "reset" | "next" | "previous" // default: "enabled"
    value?: string | number | boolean
    variableAction?: "increment" | "decrement"
}

export interface API_midi extends MidiValues {
    type: "noteon" | "noteoff" | "control"
    defaultValues?: boolean // only used by actions
}
export type API_metronome = {
    metadataBPM?: boolean // only used by actions
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
    templateValues?: { name: string; value: string | { note?: number; velocity?: number; channel?: number } | { controller?: number; value?: number; channel?: number } }[]
    data?: string // custom (OSC) data
}

// ADD

export type API_add_to_project = { projectId: string; id: string; data?: any }

// CREATE

export type API_create_show = { text: string; name?: string; category?: string }
export type API_create_project = { name: string; id?: string }

// EDIT

export type API_rename = { id: string; name: string }

/// ACTIONS ///

// WIP use these for Stage/Remote..?
// BC = Integrated to Bitfocus Companion.
export const API_ACTIONS = {
    // PROJECT
    id_select_project: (data: API_id) => selectProjectById(data.id),
    index_select_project: (data: API_index) => selectProjectByIndex(data.index), // BC
    name_select_project: (data: API_strval) => selectProjectByName(data.value), // BC
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
    transpose_show_up: (data: API_id) => formatText(transposeText(getPlainEditorText(data.id), 1), data.id),
    transpose_show_down: (data: API_id) => formatText(transposeText(getPlainEditorText(data.id), -1), data.id),

    // PRESENTATION
    next_slide: () => nextSlideIndividual({ key: "ArrowRight" }), // BC
    previous_slide: () => previousSlideIndividual({ key: "ArrowLeft" }), // BC
    random_slide: () => randomSlide(),
    index_select_slide: (data: API_slide_index) => selectSlideByIndex(data), // BC
    name_select_slide: (data: API_strval) => selectSlideByName(data.value), // BC
    id_select_group: (data: API_id) => gotoGroup(data.id), // BC
    start_slide_recording: () => playSlideRecording(),

    // CLEAR
    restore_output: () => restoreOutput(), // BC
    clear_all: () => clearAll(true), // BC
    clear_background: () => clearBackground(), // BC
    clear_slide: () => clearSlide(), // BC
    clear_overlays: () => clearOverlays(), // BC
    clear_overlay: (data: API_id) => clearOverlay(data.id),
    clear_audio: () => clearAudio("", { clearPlaylist: true, commonClear: true }), // BC
    clear_next_timer: () => clearTimers(), // BC
    clear_drawing: () => clearDrawing(),

    // MEDIA (Backgrounds)
    start_camera: (data: API_camera) => startCamera(data),
    start_screen: (data: API_screen) => startScreen(data),
    play_media: (data: API_media) => playMedia(data),
    toggle_playing_media: () => togglePlayingMedia(null, false, true),
    toggle_media_loop: () => toggleMediaLoop(),
    toggle_media_mute: () => toggleMediaMute(),
    get_media_loop_state: () => getMediaLoopState(),
    video_seekto: (data: API_seek) => videoSeekTo(data), // BC
    // play / pause playing

    // OVERLAYS
    id_start_effect: (data: API_id) => selectEffectById(data.id),
    index_select_overlay: (data: API_index) => selectOverlayByIndex(data.index), // BC
    name_select_overlay: (data: API_strval) => selectOverlayByName(data.value), // BC
    id_select_overlay: (data: API_id) => selectOverlayById(data.id),

    // SCRIPTURE
    start_scripture: (data: API_scripture) => startScripture(data), // BC
    scripture_next: () => triggerFunction("scripture_next"), // BC
    scripture_previous: () => triggerFunction("scripture_previous"), // BC

    // OUTPUT
    lock_output: (data: API_output_lock) => toggleLock(data), // BC
    toggle_output_windows: () => toggleOutputs(), // BC
    toggle_output: (data: API_id) => toggleOutput(data.id),
    id_select_output_style: (data: API_id) => changeOutputStyle({ styleId: data.id }), // BC
    change_output_style: (data: API_output_style) => changeOutputStyle(data),
    change_stage_output_layout: (data: API_stage_output_layout) => changeStageOutputLayout(data),
    change_transition: (data: API_transition) => updateTransition(data), // BC

    // STAGE
    id_select_stage_layout: (data: API_id) => moveStageConnection(data.id), // BC

    // AUDIO
    play_audio: (data: API_media) => playAudio(data),
    pause_audio: (data: API_media) => pauseAudio(data),
    stop_audio: (data: API_media) => stopAudio(data),
    audio_seekto: (data: API_seek) => audioSeekTo(data), // BC
    change_volume: (data: API_volume) => updateVolumeValues(data.volume), // BC
    start_audio_stream: (data: API_id) => AudioPlayer.start(data.id, { name: "" }),
    start_playlist: (data: API_id) => AudioPlaylist.start(data.id),
    name_start_playlist: (data: API_strval) => startPlaylistByName(data.value), // BC
    playlist_next: () => AudioPlaylist.next(), // BC
    start_metronome: (data: API_metronome) => startMetronome(data),
    start_audio_effect: (data: API_media) => playAudio(data),

    // TIMERS
    // control timer time
    name_start_timer: (data: API_strval) => startTimerByName(data.value), // BC
    id_start_timer: (data: API_id) => startTimerById(data.id),
    start_slide_timers: (data: API_slide) => playSlideTimers(data),
    pause_timers: () => pauseAllTimers(), // BC
    stop_timers: () => stopTimers(), // BC
    timer_seekto: (data: API_seek) => timerSeekTo(data), // BC
    edit_timer: (data: API_edit_timer) => editTimer(data),
    id_pause_timer: (data: API_id) => pauseTimerById(data.id),
    name_pause_timer: (data: API_strval) => pauseTimerByName(data.value),
    id_stop_timer: (data: API_id) => stopTimerById(data.id),
    name_stop_timer: (data: API_strval) => stopTimerByName(data.value),

    // FUNCTIONS
    change_variable: (data: API_variable) => changeVariable(data), // BC
    start_trigger: (data: API_id) => activateTriggerSync(data.id),

    // DRAW
    change_draw_zoom: (data: API_draw_zoom) => changeDrawZoom(data),

    // CONNECTION
    sync_drive: () => syncDrive(true),
    sync_content_provider: () => contentProviderSync(),

    // EMIT
    send_midi: (data: API_midi) => sendMidi(data), // DEPRECATED, use emit_action instead
    send_rest_command: (data: API_rest_command) => sendRestCommandSync(data), // DEPRECATED, use emit_action instead
    emit_action: (data: API_emitter) => emitData(data),

    // OTHER
    toggle_log_song_usage: (data: API_toggle_specific) => toggleLogSongUsage(data),

    // ACTION
    name_run_action: (data: API_strval) => runActionByName(data.value), // BC
    run_action: (data: API_id) => runActionId(data.id), // BC
    toggle_action: (data: API_toggle) => toggleAction(data),

    // ADD
    add_to_project: (data: API_add_to_project) => addToProject(data),

    // CREATE
    create_show: (data: API_create_show) => convertText({ noFormatting: true, open: false, ...data }),
    create_project: (data: API_create_project) => createProject(data),

    // DELETE
    delete_project: (data: API_id) => deleteProject(data.id),
    remove_project_item: (data: API_id_index) => removeProjectItem(data),

    // EDIT
    rename_project: (data: API_rename) => renameProject(data),

    // GET
    get_shows: () => getShows(),
    get_show: (data: API_id) => getShow(data),
    get_show_layout: (data: API_id) => getShowLayout(data),
    get_projects: () => getProjects(),
    get_project: (data: API_id) => getProject(data),
    get_plain_text: (data: API_id) => getPlainText(data.id),
    get_groups: (data: API_id) => getShowGroups(data.id),

    get_output: (data: API_id_optional) => getOutput(data),
    get_output_slide_text: () => getOutputSlideText(),
    get_output_group_name: () => getOutputGroupName(),
    get_dynamic_value: (data: API_dynamic_value) => replaceDynamicValues(data.value, data.ref || {}),

    get_playing_video_duration: () => getPlayingVideoDuration(),
    get_playing_video_state: () => getPlayingVideoState(),
    get_playing_video_time: () => getPlayingVideoTime(),
    get_playing_video_time_left: () => getPlayingVideoDuration() - getPlayingVideoTime(),
    get_playing_audio_duration: () => getPlayingAudioDuration(),
    get_playing_audio_time: () => getPlayingAudioTime(),
    get_playing_audio_time_left: () => getPlayingAudioDuration() - getPlayingAudioTime(),
    get_playing_audio_data: () => getPlayingAudioData(),

    get_variables: () => getVariables(),
    get_variable: (data: { id?: string; name?: string }) => getVariable(data),

    get_timers: () => getTimersDetailed(),

    get_playlists: () => getPlaylists(),
    get_playlist: (data: API_id_optional) => getPlayingPlaylist(data),
    get_slide: (data: API_slide) => getSlide(data),

    get_thumbnail: (data: API_media) => getThumbnail(data),
    get_slide_thumbnail: (data: API_slide_thumbnail) => getSlideThumbnail(data),
    get_pdf_thumbnails: (data: API_media) => getPDFThumbnails(data),
    get_cleared: () => getClearedState()
}

/// RECEIVER / SENDER ///

export async function triggerAction(data: API) {
    // Open Sound Control format
    if (data.action.startsWith("/")) data = oscToAPI(data)

    const id = data.action

    // API start at 1, code start at 0
    if (data.index !== undefined) data.index--

    if (!API_ACTIONS[id]) return console.error("Missing API ACTION:", id)

    const returnId = data.returnId
    delete data.returnId
    const returnData = await API_ACTIONS[id](data)
    if (!returnId || returnData === undefined) return

    sendMain(Main.API_TRIGGER, { ...data, returnId, data: returnData })
}

// export function sendDataAPI(data: any) {
//     send("API_DATA", data)
// }
