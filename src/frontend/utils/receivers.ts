import { get } from "svelte/store"
import { CLOUD, CONTROLLER, NDI, OUTPUT, OUTPUT_STREAM, REMOTE, STAGE } from "../../types/Channels"
import type { ClientMessage } from "../../types/Socket"
import { AudioAnalyser } from "../audio/audioAnalyser"
import { AudioAnalyserMerger } from "../audio/audioAnalyserMerger"
import { runAction } from "../components/actions/actions"
import { clone } from "../components/helpers/array"
import { checkNextAfterMedia } from "../components/helpers/showActions"
import { clearBackground } from "../components/output/clear"
import { receiveMainGlobal } from "../IPC/main"
import {
    actions,
    activePopup,
    activeProject,
    activeShow,
    activeTimers,
    alertMessage,
    allOutputs,
    audioChannelsData,
    audioData,
    closeAd,
    colorbars,
    customMessageCredits,
    draw,
    drawSettings,
    drawTool,
    driveData,
    dynamicValueData,
    effects,
    equalizerConfig,
    events,
    gain,
    livePrepare,
    media,
    metronome,
    metronomeTimer,
    ndiData,
    outputDisplay,
    outputs,
    outputSlideCache,
    outputState,
    overlays,
    playerVideos,
    playingAudioPaths,
    playingVideos,
    popupData,
    previewBuffers,
    projects,
    shows,
    showsCache,
    slideVideoData,
    special,
    stageShows,
    styles,
    templates,
    timeFormat,
    timers,
    transitionData,
    variables,
    videosData,
    videosTime,
    visualizerData,
    volume
} from "../stores"
import { newToast } from "./common"
import { syncDrive } from "./drive"
import { setLanguage } from "./language"
import { sendInitialOutputData } from "./listeners"
import { receive, send } from "./request"
import { closeApp, save } from "./save"
import { client } from "./sendData"
import { playFolder, previewShortcuts } from "./shortcuts"
import { restartOutputs } from "./updateSettings"
import { setEqualizerEnabled, updateEqualizerBands } from "../audio/audioEqualizer"

export function setupMainReceivers() {
    receiveMainGlobal()

    receive(OUTPUT, receiveOUTPUTasMAIN)
    receive(NDI, receiveNDI)
    receive(CLOUD, receiveCLOUD)
}

export function remoteListen() {
    // FROM CLIENT (EXPRESS SERVERS)
    window.api.receive(REMOTE, (msg: ClientMessage) => client(REMOTE, msg))
    window.api.receive(STAGE, (msg: ClientMessage) => client(STAGE, msg))
    window.api.receive(CONTROLLER, (msg: ClientMessage) => client(CONTROLLER, msg))
    window.api.receive(OUTPUT_STREAM, (msg: ClientMessage) => client(OUTPUT_STREAM, msg))
}

// OUTPUT

const clearing: string[] = []
const receiveOUTPUTasMAIN: any = {
    BUFFER: ({ id, time, buffer, size }) => {
        // this will infinitely increace if this is not in place
        const timeSinceSent = Date.now() - time
        if (timeSinceSent > 100) return // skip frames if overloaded

        previewBuffers.update((a) => {
            a[id] = { buffer, size }
            return a
        })
    },
    OUTPUTS: (a: any) => outputs.set(a),
    RESTART: ({ id }) => restartOutputs(id),
    // DISPLAY: (a: any) => outputDisplay.set(a.enabled),
    OUTPUT_STATE: (newStates: { id: string; active: boolean | "invisible" }[]) => {

        outputState.update(a => {
            newStates.forEach(newState => {
                const stateIndex = a.findIndex(state => state.id === newState.id)
                if (stateIndex < 0) a.push(newState)
                else a[stateIndex] = newState
            })

            // only enabled ones & not invisible
            a = a.filter(state => get(outputs)[state.id]?.enabled && !get(outputs)[state.id]?.invisible)

            const getVisibleState = [...new Set((a.filter(state => typeof state.active === "boolean").map((state) => state.active) as boolean[]))]
            if (getVisibleState.length === 1) outputDisplay.set(getVisibleState[0])

            return a
        })
    },
    ACTION_MAIN: (a: { id: string }) => runAction(get(actions)[a.id]),
    AUDIO_MAIN: (data: any) => {
        if (!data.id) return

        if (data.channels) AudioAnalyserMerger.addChannels(data.id, data.channels)

        playingVideos.update((playingVideo) => {
            const existing = playingVideo.findIndex((a) => a.id === data.id)

            if (data.stop) {
                if (existing > -1) playingVideo.splice(existing, 1)
                return playingVideo
            }

            if (existing > -1) {
                playingVideo[existing] = { ...data, location: "output" }
            } else if (get(outputs)[data.id]?.out?.background) {
                playingVideo.push({ location: "output", ...data })
            }

            return playingVideo
        })

        if (data.stop && !AudioAnalyser.shouldAnalyse()) {
            AudioAnalyserMerger.stop()
        }
    },
    MOVE: (data) => {
        outputs.update((a) => {
            if (!a[data.id] || a[data.id].boundsLocked) return a

            a[data.id].bounds = data.bounds
            return a
        })
    },
    UPDATE_OUTPUTS_DATA: ({ key, value, id, autoSave }) => {
        outputs.update((a) => {
            const ids = id ? [id] : Object.keys(get(outputs))
            ids.forEach((outputId) => {
                if (a[outputId]) a[outputId][key] = value
            })
            return a
        })
        if (autoSave) save()
    },
    REQUEST_DATA_MAIN: () => sendInitialOutputData(),
    MAIN_LOG: (msg: any) => console.info(msg),
    MAIN_DATA: (msg: any) => videosData.update((a) => ({ ...a, ...msg })),
    MAIN_TIME: (msg: any) => videosTime.update((a) => ({ ...a, ...msg })),
    MAIN_VIDEO_ENDED: (msg) => {
        if (!msg || clearing.includes(msg.id)) return
        clearing.push(msg.id)
        setTimeout(() => clearing.splice(clearing.indexOf(msg.id), 1), msg.duration || 1000)

        const background = get(outputs)[msg.id]?.out?.background
        const videoPath: string = background?.path || background?.id || ""
        if (!videoPath) return

        // project media folder
        if (background?.folderPath) {
            playFolder(background.folderPath)
            return
        }

        // check and execute next after media regardless of loop
        if (checkNextAfterMedia(videoPath, "media", msg.id) || msg.loop) return

        if (get(special).clearMediaOnFinish === false) return

        setTimeout(() => {
            // double check that output is still the same
            const newVideoPath: string = get(outputs)[msg.id]?.out?.background?.path || get(outputs)[msg.id]?.out?.background?.id || ""
            if (newVideoPath !== videoPath) return

            clearBackground(msg.id)
        }, 200) // WAIT FOR NEXT AFTER MEDIA TO FINISH
    },
    // stage
    MAIN_REQUEST_VIDEO_DATA: (data: any) => {
        if (!data.id) return
        send(OUTPUT, ["VIDEO_DATA"], { id: data.id, data: get(videosData), time: get(videosTime) })
    },
    ALERT_MAIN: (data: string) => {
        if (!data) return

        alertMessage.set(data)
        activePopup.set("alert")
    },
    MAIN_SHORTCUT: (data: { key: string }) => {
        if (previewShortcuts[data.key]) {
            previewShortcuts[data.key]({ ...data, preventDefault: () => "" })
        }
    },
    MAIN_SHOWS_DATA: () => send(OUTPUT, ["SHOWS_DATA"], get(shows)),
    MAIN_SLIDE_VIDEO: (data: { id: string; path: string; data: any }) => {
        slideVideoData.update(a => {
            if (!a[data.id]) a = { [data.id]: {} }
            a[data.id][data.path] = data.data
            return a
        })
    }
}

let previousOutputs = ""
export const receiveOUTPUTasOUTPUT: any = {
    OUTPUTS: (a: any) => {
        // output.ts - only current output data is sent
        const id = Object.keys(a)[0]
        if (!id) {
            outputs.set(a)
            return
        }

        const active: boolean = a[id].active
        delete a[id].active

        // only update if there are any changes in this output
        const newOutputs = JSON.stringify(a)
        if (previousOutputs === newOutputs) return

        a[id].active = active
        outputs.set(a)
        previousOutputs = newOutputs
    },
    ALL_OUTPUTS: (a: any) => {
        // used for stage mirror data (hacky fix)
        allOutputs.set(a)
    },
    // only received by stage screen outputs
    BUFFER: ({ id, time, buffer, size }) => {
        const timeSinceSent = Date.now() - time
        if (timeSinceSent > 100) return // skip frames if overloaded

        // WIP only receive the "output capture" from this outputs "stageOutput id"
        // let outputId = Object.keys(get(outputs))[0]
        // if (id !== outputId) return

        previewBuffers.update((a) => {
            a[id] = { buffer, size }
            return a
        })
    },
    CLOSE_AD: () => closeAd.set(true),
    LANGUAGE: (a: any) => setLanguage(a),
    STYLES: (a: any) => styles.set(a),
    // BACKGROUND: (a: any) => outBackground.set(a),
    TRANSITION: (a: any) => transitionData.set(a),
    // SLIDE: (a: any) => outSlide.set(a),
    // OVERLAYS: (a: any) => outOverlays.set(a),
    // OVERLAY: (a: any) => overlays.set(a),
    // META: (a: any) => displayMetadata.set(a),
    // COLOR: (a: any) => backgroundColor.set(a),
    // SCREEN: (a: any) => screen.set(a),
    SHOWS: (a: any) => showsCache.set(a),

    TEMPLATES: (a: any) => templates.set(a),
    OVERLAYS: (a: any) => clone(overlays.set(a)),
    EVENTS: (a: any) => events.set(a),

    DRAW: (a: any) => draw.set(a.data),
    DRAW_TOOL: (a: any) => drawTool.set(a.data),
    DRAW_SETTINGS: (a: any) => drawSettings.set(a),
    VISUALIZER_DATA: (a: any) => visualizerData.set(a),
    MEDIA: (a: any) => media.set(a),
    OUT_SLIDE_CACHE: (a: any) => outputSlideCache.set(a),
    CUSTOM_CREDITS: (a: any) => customMessageCredits.set(a),
    EFFECTS: (a: any) => clone(effects.set(a)),
    TIMERS: (a: any) => clone(timers.set(a)),
    VARIABLES: (a: any) => clone(variables.set(a)),
    TIME_FORMAT: (a: any) => timeFormat.set(a),
    SPECIAL: (a: any) => clone(special.set(a)),
    ACTIVE_TIMERS: (a: any) => activeTimers.set(a),
    // POSITION: (a: any) => outputPosition.set(a),
    PLAYER_VIDEOS: (a: any) => playerVideos.set(a),
    STAGE_SHOWS: (a: any) => stageShows.set(a),

    // for dynamic values
    PROJECTS: (a: any) => projects.set(a),
    ACTIVE_PROJECT: (a: any) => activeProject.set(a),
    SHOWS_DATA: (a: any) => shows.set(a),

    // stage & dynamic value (video)
    VIDEO_DATA: (data) => {
        videosData.set(data.data)
        videosTime.set(data.time)
    },

    VOLUME: (a: any) => volume.set(a),
    GAIN: (a: any) => gain.set(a),
    AUDIO_CHANNELS_DATA: (a: any) => audioChannelsData.set(a),

    EQUALIZER_CONFIG: (a: any) => {
        equalizerConfig.set(a)
        setEqualizerEnabled(a.enabled)
        updateEqualizerBands(a.bands)
    },

    METRONOME: (a: any) => metronome.set(a),
    METRONOME_TIMER: (a: any) => metronomeTimer.set(a),

    // dynamic values
    PLAYING_AUDIO: (a: any) => playingAudioPaths.set(a),
    AUDIO_DATA: (a: any) => audioData.set(a),
    DYNAMIC_VALUE_DATA: (a: any) => dynamicValueData.set(a),

    COLORBARS: (a: any) => colorbars.set(a),
    LIVE_PREPARE: (a: any) => livePrepare.set(a)
}

// NDI

const receiveNDI: any = {
    SEND_DATA: (msg) => {
        if (!msg?.id) return

        ndiData.update((a) => {
            a[msg.id] = msg

            return a
        })
    }
}

// CLOUD

const receiveCLOUD = {
    DRIVE_CONNECT: ({ status, error }: any) => {
        if (error) {
            newToast(error)
            return
        }
        if (status !== "connected") return

        // WIP set connected status, and see in settings

        if (get(driveData)?.mainFolderId) {
            driveData.update((a) => {
                a.initializeMethod = "done"
                return a
            })

            syncDrive(false, false, true)
            return
        }

        send(CLOUD, ["GET_MAIN_FOLDER"], { method: get(driveData).initializeMethod })
    },
    GET_MAIN_FOLDER: ({ id, error, existingData }: any) => {
        if (error) {
            newToast(error)
            return
        }
        if (!id) return

        driveData.update((a) => {
            a.mainFolderId = id
            return a
        })

        let method = get(driveData).initializeMethod
        if (get(driveData).disableUpload) method = "download"
        if (!method) {
            // this is not needed for the shows, but for all the other data
            if (existingData) {
                activePopup.set("cloud_method")
                return
            }

            driveData.update((a) => {
                a.initializeMethod = existingData ? "done" : "upload"
                return a
            })
        }

        syncDrive(true)
    },
    SYNC_DATA: ({ changes, closeWhenFinished }) => {
        if (changes.error) {
            newToast(changes.error)
            if (!closeWhenFinished) return
        }

        if (closeWhenFinished) {
            popupData.set(changes)
            activePopup.set("cloud_update")

            // timeout so user can see the sync has finished before it closes!
            setTimeout(closeApp, 800)
            return
        }

        driveData.update((a) => {
            a.initializeMethod = "done"
            return a
        })

        if (!changes.length) {
            newToast("cloud.sync_complete")

            if (get(activePopup) !== "cloud_update") return

            popupData.set({})
            activePopup.set(null)

            return
        }

        // reload shows cache (because there could be some changes)
        showsCache.set({})
        activeShow.set(null)

        // show completed toast
        newToast("cloud.sync_complete")

        // show popup if manually syncing
        if (get(activePopup) === "cloud_update") {
            popupData.set(changes)
            // activePopup.set("cloud_update")
        }

        // hide sync popup on startup/close sync
        // popupData.set({})
        // activePopup.set(null)
    }
}
