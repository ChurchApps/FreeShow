import { get } from "svelte/store"
import { CLOUD, CONTROLLER, IMPORT, MAIN, NDI, OPEN_FILE, OPEN_FOLDER, OUTPUT, OUTPUT_STREAM, REMOTE, STAGE, STORE } from "../../types/Channels"
import type { ClientMessage } from "../../types/Socket"
import { triggerAction } from "../components/actions/api"
import { receivedMidi } from "../components/actions/midi"
import { menuClick } from "../components/context/menuClick"
import { clone } from "../components/helpers/array"
import { analyseAudio } from "../components/helpers/audio"
import { addDrawerFolder } from "../components/helpers/dropActions"
import { captureCanvas } from "../components/helpers/media"
import { getActiveOutputs } from "../components/helpers/output"
import { checkNextAfterMedia } from "../components/helpers/showActions"
import { clearBackground } from "../components/output/clear"
import { defaultThemes } from "../components/settings/tabs/defaultThemes"
import { convertBebliaBible } from "../converters/bebliaBible"
import { importFSB } from "../converters/bible"
import { convertCalendar } from "../converters/calendar"
import { convertChordPro } from "../converters/chordpro"
import { convertEasyWorship } from "../converters/easyworship"
import { createImageShow } from "../converters/imageShow"
import { importShow, importSpecific } from "../converters/importHelpers"
import { convertLessonsPresentation } from "../converters/lessonsChurch"
import { convertOpenLP } from "../converters/openlp"
import { convertOpenSong, convertOpenSongBible } from "../converters/opensong"
import { convertOSISBible } from "../converters/osisBible"
import { convertPowerpoint } from "../converters/powerpoint"
import { addToProject, importProject } from "../converters/project"
import { convertProPresenter } from "../converters/propresenter"
import { convertSoftProjector } from "../converters/softprojector"
import { convertSongbeamerFiles } from "../converters/songbeamer"
import { convertTexts } from "../converters/txt"
import { convertVideopsalm } from "../converters/videopsalm"
import { convertZefaniaBible } from "../converters/zefaniaBible"
import {
    activePage,
    activePopup,
    activeShow,
    activeTimers,
    alertMessage,
    allOutputs,
    audioChannels,
    closeAd,
    colorbars,
    currentOutputSettings,
    customMessageCredits,
    dataPath,
    deviceId,
    dictionary,
    draw,
    drawSettings,
    drawTool,
    driveData,
    driveKeys,
    events,
    folders,
    gain,
    isDev,
    lessonsLoaded,
    media,
    ndiData,
    os,
    outputDisplay,
    outputs,
    overlays,
    playerVideos,
    playingVideos,
    popupData,
    presentationApps,
    presentationData,
    previewBuffers,
    projects,
    shows,
    showsCache,
    showsPath,
    special,
    stageShows,
    styles,
    tempPath,
    templates,
    textCache,
    theme,
    themes,
    timeFormat,
    timers,
    transitionData,
    variables,
    version,
    videosData,
    videosTime,
    visualizerData,
    volume,
    windowState,
} from "../stores"
import { redoHistory, undoHistory } from "./../stores"
import { newToast, startDevMode } from "./common"
import { createData } from "./createData"
import { syncDrive, validateKeys } from "./drive"
import { sendInitialOutputData } from "./listeners"
import { receive, send } from "./request"
import { closeApp, initializeClosing, save, saveComplete } from "./save"
import { client } from "./sendData"
import { previewShortcuts } from "./shortcuts"
import { restartOutputs, updateSettings, updateSyncedSettings, updateThemeValues } from "./updateSettings"

export function setupMainReceivers() {
    receive(MAIN, receiveMAIN)
    receive(OUTPUT, receiveOUTPUTasMAIN)
    receive(STORE, receiveSTORE)
    receive(IMPORT, receiveIMPORT)
    receive(OPEN_FOLDER, receiveFOLDER)
    receive(OPEN_FILE, receiveFILE)
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

const receiveMAIN: any = {
    VERSION: (a: any) => version.set(a),
    IS_DEV: (a: any) => {
        isDev.set(a)
        if (a) startDevMode()
    },
    GET_OS: (a: any) => os.set(a),
    DEVICE_ID: (a: any) => deviceId.set(a),
    GET_PATHS: (a: any) => {
        // only on first startup
        createData(a)
    },
    GET_TEMP_PATHS: (a: any) => {
        tempPath.set(a.temp)
    },
    MENU: (a: any) => menuClick(a),
    SHOWS_PATH: (a: any) => showsPath.set(a),
    DATA_PATH: (a: any) => dataPath.set(a),
    ALERT: (a: any) => {
        alertMessage.set(a || "")

        if (a === "error.display") {
            let outputIds = getActiveOutputs(get(outputs), false, true)
            currentOutputSettings.set(outputIds[0])
            popupData.set({ activateOutput: true })
            activePopup.set("choose_screen")
            return
        }

        activePopup.set("alert")
    },
    CLOSE: () => initializeClosing(),
    RECEIVE_MIDI: (msg) => receivedMidi(msg),
    DELETE_SHOWS: (a) => {
        if (!a.deleted.length) {
            newToast("$toast.delete_shows_empty")
            return
        }

        alertMessage.set("<h3>Deleted " + a.deleted.length + " files</h3><br>● " + a.deleted.join("<br>● "))
        activePopup.set("alert")
    },
    REFRESH_SHOWS: (a) => {
        let oldCount = Object.keys(get(shows)).length
        let newCount = Object.keys(a).length

        shows.set(a)

        if (get(activePopup) || get(activePage) !== "settings") return
        alertMessage.set("<h3>Updated shows</h3><br>● Old shows: " + oldCount + "<br>● New shows: " + newCount)
        activePopup.set("alert")
    },
    BACKUP: ({ finished, path }) => {
        if (!finished) return activePopup.set(null)

        alertMessage.set(get(dictionary).settings?.backup_finished + "<br><br>" + path)
        activePopup.set("alert")
    },
    RESTORE: ({ finished }) => {
        if (!finished) return activePopup.set(null)

        alertMessage.set("settings.restore_finished")
        activePopup.set("alert")
    },
    LOCATE_MEDIA_FILE: ({ path, ref }) => {
        let prevPath: string = ""

        showsCache.update((a) => {
            let media = a[ref.showId].media[ref.mediaId]
            if (ref.cloudId) {
                if (!media.cloud) a[ref.showId].media[ref.mediaId].cloud = {}
                prevPath = a[ref.showId].media[ref.mediaId].cloud![ref.cloudId]
                a[ref.showId].media[ref.mediaId].cloud![ref.cloudId] = path
            } else {
                prevPath = a[ref.showId].media[ref.mediaId].path || ""
                a[ref.showId].media[ref.mediaId].path = path
            }

            return a
        })

        // sometimes when lagging the image will be "replaced" even when it exists
        if (prevPath !== path) newToast("$toast.media_replaced")
    },
    API_TRIGGER: (data: any) => triggerAction(data),
    PRESENTATION_STATE: (data: any) => presentationData.set(data),
    SLIDESHOW_GET_APPS: (data: any) => presentationApps.set(data),

    // TOP BAR
    MAXIMIZED: (data: boolean) => windowState.set({ ...windowState, maximized: data }),

    // MEDIA CACHE
    CAPTURE_CANVAS: (data: any) => captureCanvas(data),
    LESSONS_DONE: (data: any) => lessonsLoaded.set({ ...get(lessonsLoaded), [data.showId]: data.status }),
    IMAGES_TO_SHOW: (data: any) => createImageShow(data),
}

const receiveSTORE: any = {
    SAVE: (a: any) => saveComplete(a),
    SETTINGS: (a: any) => updateSettings(a),
    SYNCED_SETTINGS: (a: any) => updateSyncedSettings(a),
    SHOWS: (a: any) => shows.set(a),
    STAGE_SHOWS: (a: any) => stageShows.set(a),
    PROJECTS: (a: any) => {
        projects.set(a.projects || {})
        folders.set(a.folders || {})
    },
    OVERLAYS: (a: any) => overlays.set(a),
    TEMPLATES: (a: any) => templates.set(a),
    EVENTS: (a: any) => events.set(a),
    DRIVE_API_KEY: (a: any) => driveKeys.set(a),
    MEDIA: (a: any) => media.set(a),
    THEMES: (a: any) => {
        themes.set(Object.keys(a).length ? a : clone(defaultThemes))

        // update if themes are loaded after settings
        if (get(theme) !== "default") updateThemeValues(get(themes)[get(theme)])
    },
    CACHE: (a: any) => {
        textCache.set(a.text || {})
    },
    HISTORY: (a: any) => {
        undoHistory.set(a.undo || [])
        redoHistory.set(a.redo || [])
    },
}

const receiveFOLDER: any = {
    MEDIA: (a: any) => addDrawerFolder(a, "media"),
    AUDIO: (a: any) => addDrawerFolder(a, "audio"),
    SHOWS: (a: any) => showsPath.set(a.path),
    DATA: (a: any) => dataPath.set(a.path),
    DATA_SHOWS: (a: any) => {
        dataPath.set(a.path)
        if (a.showsPath) showsPath.set(a.showsPath)
    },
}

const receiveFILE = {
    GOOGLE_KEYS: ({ files, content }) => {
        let path = files[0]
        let file = content[path]
        if (file) validateKeys(file)
    },
}

// OUTPUT

let clearing: boolean = false
const receiveOUTPUTasMAIN: any = {
    BUFFER: ({ id, time, buffer, size }) => {
        // this will infinitely increace if this is not in place
        let timeSinceSent = Date.now() - time
        if (timeSinceSent > 100) return // skip frames if overloaded

        previewBuffers.update((a) => {
            a[id] = { buffer, size }
            return a
        })
    },
    OUTPUTS: (a: any) => outputs.set(a),
    RESTART: () => restartOutputs(),
    DISPLAY: (a: any) => outputDisplay.set(a.enabled),
    AUDIO_MAIN: async (data: any) => {
        if (!data.id) {
            // WIP merge with existing (audio.ts)
            audioChannels.set(data.channels)
            return
        }

        playingVideos.update((a) => {
            let existing = a.findIndex((a) => a.id === data.id && a.location === "output")

            if (existing > -1) {
                let wasPaused = a[existing].paused
                a[existing] = { ...data, location: "output" }
                if (wasPaused === true && !data.paused) analyseAudio()
            } else {
                a.push({ location: "output", ...data })
                analyseAudio()
            }

            return a
        })
    },
    MOVE: (data) => {
        outputs.update((a) => {
            if (!a[data.id]) return a

            a[data.id].bounds = data.bounds
            return a
        })
    },
    UPDATE_OUTPUTS_DATA: ({ key, value, id, autoSave }) => {
        outputs.update((a) => {
            let ids = id ? [id] : Object.keys(get(outputs))
            ids.forEach((outputId) => {
                if (a[outputId]) a[outputId][key] = value
            })
            return a
        })
        if (autoSave) save()
    },
    REQUEST_DATA_MAIN: () => sendInitialOutputData(),
    MAIN_LOG: (msg: any) => console.log(msg),
    MAIN_DATA: (msg: any) => videosData.update((a) => ({ ...a, ...msg })),
    MAIN_TIME: (msg: any) => videosTime.update((a) => ({ ...a, ...msg })),
    MAIN_VIDEO_ENDED: async (msg) => {
        if (!msg || clearing) return
        clearing = true
        setTimeout(() => (clearing = false), msg.duration || 1000)

        let videoPath: string = get(outputs)[msg.id]?.out?.background?.path || get(outputs)[msg.id]?.out?.background?.id || ""
        if (!videoPath) return

        // check and execute next after media regardless of loop
        if (checkNextAfterMedia(videoPath, "media", msg.id) || msg.loop) return

        if (get(special).clearMediaOnFinish === false) return

        setTimeout(() => {
            // double check that output is still the same
            let newVideoPath: string = get(outputs)[msg.id]?.out?.background?.path || get(outputs)[msg.id]?.out?.background?.id || ""
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
}

let previousOutputs: string = ""
export const receiveOUTPUTasOUTPUT: any = {
    OUTPUTS: (a: any) => {
        // output.ts - only current output data is sent
        let id = Object.keys(a)[0]
        if (!id) {
            outputs.set(a)
            return
        }

        let active: boolean = a[id].active
        delete a[id].active

        // only update if there are any changes in this output
        let newOutputs = JSON.stringify(a)
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
        let timeSinceSent = Date.now() - time
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
    VIZUALISER_DATA: (a: any) => visualizerData.set(a),
    MEDIA: (a: any) => media.set(a),
    CUSTOM_CREDITS: (a: any) => customMessageCredits.set(a),
    TIMERS: (a: any) => clone(timers.set(a)),
    VARIABLES: (a: any) => clone(variables.set(a)),
    TIME_FORMAT: (a: any) => timeFormat.set(a),
    SPECIAL: (a: any) => clone(special.set(a)),
    ACTIVE_TIMERS: (a: any) => activeTimers.set(a),
    // POSITION: (a: any) => outputPosition.set(a),
    PLAYER_VIDEOS: (a: any) => playerVideos.set(a),
    STAGE_SHOWS: (a: any) => stageShows.set(a),

    // stage & dynamic value (video)
    VIDEO_DATA: (data) => {
        videosData.set(data.data)
        videosTime.set(data.time)
    },

    VOLUME: (a: any) => volume.set(a),
    GAIN: (a: any) => gain.set(a),

    COLORBARS: (a: any) => colorbars.set(a),
}

// NDI

const receiveNDI: any = {
    SEND_DATA: (msg) => {
        if (!msg?.id) return

        ndiData.update((a) => {
            a[msg.id] = msg

            return a
        })
    },
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

            setTimeout(closeApp, 800)
            return
        }

        driveData.update((a) => {
            a.initializeMethod = "done"
            return a
        })

        if (!changes.length) {
            newToast("$cloud.sync_complete")

            if (get(activePopup) !== "cloud_update") return

            popupData.set({})
            activePopup.set(null)

            return
        }

        // reload shows cache (because there could be some changes)
        showsCache.set({})
        activeShow.set(null)

        // show completed toast
        newToast("$cloud.sync_complete")

        // show popup if manually syncing
        if (get(activePopup) === "cloud_update") {
            popupData.set(changes)
            // activePopup.set("cloud_update")
        }

        // hide sync popup on startup/close sync
        // popupData.set({})
        // activePopup.set(null)
    },
}

// IMPORT

const receiveIMPORT: any = {
    // FreeShow
    freeshow: (a: any) => importShow(a),
    freeshow_project: (a: any) => importProject(a),
    freeshow_template: (a: any) => importSpecific(a, templates),
    freeshow_theme: (a: any) => importSpecific(a, themes),
    // Text
    txt: (a: any) => convertTexts(a),
    chordpro: (a: any) => convertChordPro(a),
    powerpoint: (a: any) => convertPowerpoint(a),
    word: (a: any) => convertTexts(a),
    // Other programs
    propresenter: (a: any) => convertProPresenter(a),
    easyworship: (a: any) => convertEasyWorship(a),
    videopsalm: (a: any) => convertVideopsalm(a),
    openlp: (a: any) => convertOpenLP(a),
    opensong: (a: any) => convertOpenSong(a),
    softprojector: (a: any) => convertSoftProjector(a),
    songbeamer: (a: any) => convertSongbeamerFiles(a),
    // Media
    pdf: (a: any) => addToProject("pdf", a),
    lessons: (a: any) => convertLessonsPresentation(a),
    // Other
    calendar: (a: any) => convertCalendar(a),
    // Bibles
    freeshow_bible: (a: any) => importFSB(a),
    zefania_bible: (a: any) => convertZefaniaBible(a),
    osis_bible: (a: any) => convertOSISBible(a),
    beblia_bible: (a: any) => convertBebliaBible(a),
    opensong_bible: (a: any) => convertOpenSongBible(a),
}
