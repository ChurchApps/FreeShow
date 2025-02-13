import { get } from "svelte/store"
import { CLOUD, CONTROLLER, IMPORT, MAIN, NDI, OPEN_FILE, OPEN_FOLDER, OUTPUT, OUTPUT_STREAM, REMOTE, STAGE, STORE } from "../../types/Channels"
import type { Project } from "../../types/Projects"
import type { ClientMessage } from "../../types/Socket"
import { triggerAction } from "../components/actions/api"
import { receivedMidi } from "../components/actions/midi"
import { menuClick } from "../components/context/menuClick"
import { clone } from "../components/helpers/array"
import { analyseAudio } from "../components/helpers/audio"
import { addDrawerFolder } from "../components/helpers/dropActions"
import { history } from "../components/helpers/history"
import { captureCanvas, setMediaTracks } from "../components/helpers/media"
import { getActiveOutputs } from "../components/helpers/output"
import { loadShows, saveTextCache } from "../components/helpers/setShow"
import { checkName } from "../components/helpers/show"
import { checkNextAfterMedia } from "../components/helpers/showActions"
import { clearBackground } from "../components/output/clear"
import { defaultThemes } from "../components/settings/tabs/defaultThemes"
import { importBibles } from "../converters/bible"
import { convertCalendar } from "../converters/calendar"
import { convertChordPro } from "../converters/chordpro"
import { convertEasyslides } from "../converters/easyslides"
import { convertEasyWorship } from "../converters/easyworship"
import { createImageShow } from "../converters/imageShow"
import { createCategory, importShow, importSpecific, setTempShows } from "../converters/importHelpers"
import { convertLessonsPresentation } from "../converters/lessonsChurch"
import { convertOpenLP } from "../converters/openlp"
import { convertOpenSong } from "../converters/opensong"
import { convertPowerpoint } from "../converters/powerpoint"
import { addToProject, importProject } from "../converters/project"
import { convertProPresenter } from "../converters/propresenter"
import { convertQuelea } from "../converters/quelea"
import { convertSoftProjector } from "../converters/softprojector"
import { convertSongbeamerFiles } from "../converters/songbeamer"
import { convertTexts } from "../converters/txt"
import { convertVerseVIEW } from "../converters/verseview"
import { convertVideopsalm } from "../converters/videopsalm"
import {
    activeEdit,
    activePage,
    activePopup,
    activeProject,
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
    pcoConnected,
    playerVideos,
    playingVideos,
    popupData,
    presentationApps,
    presentationData,
    previewBuffers,
    projectTemplates,
    projectView,
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
    usageLog,
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
import { setLanguage } from "./language"
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
    TOAST: (data) => newToast(data),
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

        console.log("Backed up to:", path)
        newToast(get(dictionary).settings?.backup_finished || "") // + ": " + path)
        // if (changeUserData) send(STORE, ["UPDATE_PATH"], changeUserData)
    },
    RESTORE: ({ finished, starting }) => {
        if (!finished) return activePopup.set(null)
        if (starting) return newToast("$settings.restore_started")

        // close opened
        activeEdit.set({ items: [] })
        activeShow.set(null)
        activePage.set("show")

        newToast("$settings.restore_finished")
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
    MEDIA_TRACKS: (data: any) => setMediaTracks(data),
    API_TRIGGER: (data: any) => triggerAction(data),
    PRESENTATION_STATE: (data: any) => presentationData.set(data),
    SLIDESHOW_GET_APPS: (data: any) => presentationApps.set(data),

    // TOP BAR
    MAXIMIZED: (data: boolean) => windowState.set({ ...windowState, maximized: data }),

    // MEDIA CACHE
    CAPTURE_CANVAS: (data: any) => captureCanvas(data),
    LESSONS_DONE: (data: any) => lessonsLoaded.set({ ...get(lessonsLoaded), [data.showId]: data.status }),
    IMAGES_TO_SHOW: (data: any) => createImageShow(data),

    // CONNECTION
    PCO_CONNECT: (data: any) => {
        if (!data.success) return
        pcoConnected.set(true)
        if (data.isFirstConnection) newToast("$main.finished")
    },
    PCO_DISCONNECT: (data: any) => {
        if (!data.success) return
        pcoConnected.set(false)
    },
    PCO_PROJECTS: (data: any) => {
        if (!data.projects) return

        // CREATE CATEGORY
        createCategory("Planning Center")

        // CREATE SHOWS
        let tempShows: any = []
        data.shows.forEach((show) => {
            let id = show.id
            delete show.id
            tempShows.push({ id, show: { ...show, name: checkName(show.name, id), locked: true } })
        })
        setTempShows(tempShows)

        data.projects.forEach((pcoProject) => {
            // CREATE PROJECT FOLDER
            let folderId = pcoProject.folderId
            if (folderId && (!get(folders)[folderId] || get(folders)[folderId].deleted)) {
                history({ id: "UPDATE", newData: { replace: { parent: "/", name: pcoProject.folderName } }, oldData: { id: folderId }, location: { page: "show", id: "project_folder" } })
            }

            // CREATE PROJECT
            let project: Project = {
                name: pcoProject.name,
                created: pcoProject.created,
                used: Date.now(), // show on top in last used list
                parent: folderId || "/",
                shows: pcoProject.items || [],
            }

            let projectId = pcoProject.id
            history({ id: "UPDATE", newData: { data: project }, oldData: { id: projectId }, location: { page: "show", id: "project" } })
        })

        // open closest to today
        activeProject.set(data.projects.sort((a, b) => a.scheduledTo - b.scheduledTo)[0]?.id)
        projectView.set(false)
    },
}

const receiveSTORE: any = {
    SAVE: (a: any) => saveComplete(a),
    SETTINGS: (a: any) => updateSettings(a),
    SYNCED_SETTINGS: (a: any) => updateSyncedSettings(a),
    SHOWS: async (a: any) => {
        let difference = Object.keys(a).length - Object.keys(get(shows)).length
        if (difference < 15 && Object.keys(get(shows)).length && difference > 0) {
            // get new shows & cache their content
            let newShowIds = Object.keys(a).filter((id) => !get(shows)[id])
            await loadShows(newShowIds)
            newShowIds.forEach((id) => saveTextCache(id, get(showsCache)[id]))
        }

        shows.set(a)
    },
    STAGE_SHOWS: (a: any) => stageShows.set(a),
    PROJECTS: (a: any) => {
        projects.set(a.projects || {})
        folders.set(a.folders || {})
        projectTemplates.set(a.projectTemplates || {})
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
    USAGE: (a: any) => usageLog.set(a),
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

let clearing: string[] = []
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
            } else if (get(outputs)[data.id]?.out?.background) {
                a.push({ location: "output", ...data })
                analyseAudio()
            }

            return a
        })
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
        if (!msg || clearing.includes(msg.id)) return
        clearing.push(msg.id)
        setTimeout(() => clearing.splice(clearing.indexOf(msg.id), 1), msg.duration || 1000)

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

            // timeout so user can see the sync has finished before it closes!
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
    quelea: (a: any) => convertQuelea(a),
    softprojector: (a: any) => convertSoftProjector(a),
    songbeamer: (a: any) => convertSongbeamerFiles(a),
    easyslides: (a: any) => convertEasyslides(a),
    verseview: (a: any) => convertVerseVIEW(a),
    // Media
    pdf: (a: any) => addToProject("pdf", a),
    powerkey: (a: any) => addToProject("ppt", a),
    lessons: (a: any) => convertLessonsPresentation(a),
    // Other
    calendar: (a: any) => convertCalendar(a),
    // Bibles
    BIBLE: (a: any) => importBibles(a),
}
