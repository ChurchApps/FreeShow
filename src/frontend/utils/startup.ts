import { get } from "svelte/store"
import { MAIN, NDI, OPEN_FOLDER, OUTPUT, STARTUP, STORE } from "../../types/Channels"
import { menuClick } from "../components/context/menuClick"
import { clone } from "../components/helpers/array"
import { analyseAudio } from "../components/helpers/audio"
import { history } from "../components/helpers/history"
import { getFileName } from "../components/helpers/media"
import { checkName } from "../components/helpers/show"
import { defaultThemes } from "../components/settings/tabs/defaultThemes"
import { convertBebliaBible } from "../converters/bebliaBible"
import { importFSB } from "../converters/bible"
import { convertCalendar } from "../converters/calendar"
import { convertChordPro } from "../converters/chordpro"
import { convertEasyWorship } from "../converters/easyworship"
import { setTempShows } from "../converters/importHelpers"
import { convertLessonsPresentation } from "../converters/lessonsChurch"
import { convertOpenLP } from "../converters/openlp"
import { convertOpenSong, convertOpenSongBible } from "../converters/opensong"
import { convertPDF } from "../converters/pdf"
import { convertPowerpoint } from "../converters/powerpoint"
import { importProject } from "../converters/project"
import { convertProPresenter } from "../converters/propresenter"
import { convertTexts } from "../converters/txt"
import { convertVideopsalm } from "../converters/videopsalm"
import { convertZefaniaBible } from "../converters/zefaniaBible"
import {
    activePopup,
    activeTimers,
    alertMessage,
    allOutputs,
    audioChannels,
    audioFolders,
    currentWindow,
    deviceId,
    dictionary,
    draw,
    drawSettings,
    drawTool,
    driveKeys,
    events,
    exportPath,
    folders,
    loaded,
    media,
    mediaCache,
    mediaFolders,
    ndiData,
    os,
    outputDisplay,
    outputs,
    overlays,
    playerVideos,
    playingVideos,
    previewBuffers,
    projects,
    recordingPath,
    saved,
    scripturePath,
    shows,
    showsCache,
    showsPath,
    stageShows,
    styles,
    templates,
    textCache,
    theme,
    themes,
    timers,
    transitionData,
    variables,
    version,
    visualizerData,
    volume,
} from "../stores"
import { IMPORT } from "./../../types/Channels"
import { redoHistory, undoHistory } from "./../stores"
import { checkForUpdates } from "./checkForUpdates"
import { createData } from "./createData"
import { setLanguage } from "./language"
import { listenForUpdates } from "./listeners"
import { listen, newToast } from "./messages"
import { playMidiIn } from "./midi"
import { receive, send } from "./request"
import { saveComplete } from "./save"
import { restartOutputs, updateSettings, updateSyncedSettings, updateThemeValues } from "./updateSettings"
import { checkNextAfterMedia } from "../components/helpers/showActions"

export function startup() {
    window.api.receive(STARTUP, (msg) => {
        if (msg.channel !== "TYPE") return

        let type = msg.data
        currentWindow.set(type)

        if (!type) return startupMain()
        if (type === "pdf") return

        // type === "output"
        receive(OUTPUT, receiveOUTPUTasOUTPUT)
        // wait a bit on slow computers
        setTimeout(() => {
            send(OUTPUT, ["REQUEST_DATA_MAIN"])
        }, 100)
        // TODO: video data!
    })
}

function startupMain() {
    loaded.set(false)
    setLanguage()

    receive(MAIN, receiveMAIN)
    receive(OUTPUT, receiveOUTPUTasMAIN)
    receive(STORE, receiveSTORE)
    receive(IMPORT, receiveIMPORT)
    receive(OPEN_FOLDER, receiveFOLDER)
    receive(NDI, receiveNDI)

    // load files
    send(MAIN, ["DISPLAY", "VERSION", "DEVICE_ID"])
    // wait a bit in case data is not yet loaded
    setTimeout(() => {
        send(STORE, ["SYNCED_SETTINGS", "SHOWS", "STAGE_SHOWS", "PROJECTS", "OVERLAYS", "TEMPLATES", "EVENTS", "MEDIA", "THEMES", "DRIVE_API_KEY", "HISTORY", "CACHE"])
        setTimeout(() => send(STORE, ["SETTINGS"]), 500)
    }, 100)

    setTimeout(() => {
        listenForUpdates()
        listen()
    }, 5000)
}

// RECEIVERS

const receiveMAIN: any = {
    GET_OS: (a: any) => os.set(a),
    VERSION: (a: any) => {
        version.set(a)
        checkForUpdates(a)
    },
    DEVICE_ID: (a: any) => { deviceId.set(a) },
    DISPLAY: (a: any) => outputDisplay.set(a),
    GET_PATHS: (a: any) => {
        // only on first startup
        createData(a)
    },
    MENU: (a: any) => menuClick(a),
    SHOWS_PATH: (a: any) => showsPath.set(a),
    EXPORT_PATH: (a: any) => exportPath.set(a),
    SCRIPTURE_PATH: (a: any) => scripturePath.set(a),
    RECORDING_PATH: (a: any) => recordingPath.set(a),
    // READ_SAVED_CACHE: (a: any) => {
    //     if (!a) return
    //     Object.entries(JSON.parse(a)).forEach(([key, data]: any) => {
    //         // TODO: undoing save is not working properly (seems like all saved are the same??)

    //         if (key === "showsCache") console.log("SHOWS CACHE ---", clone(get(showsCache)), data)

    //         // don't revert undo/redo history
    //         if (key === "HISTORY") return
    //         if (receiveSTORE[key]) receiveSTORE[key](data)
    //         // if undo = { ...data, ...get(showsCache) } else { ...get(showsCache), ...data }
    //         else if (key === "showsCache") showsCache.set({ ...data, ...get(showsCache) })
    //         else if (key === "scripturesCache") scripturesCache.set(data)
    //         else if (key === "path") showsPath.set(data)
    //         else console.log("MISSING HISTORY RESTORE KEY:", key)
    //     })

    //     // save to files?
    //     // window.api.send(STORE, { channel: "SAVE", data: allSavedData })

    //     saved.set(true)
    // },
    ALERT: (a: any) => {
        alertMessage.set(a)

        if (a === "error.display") {
            activePopup.set("choose_screen")
            return
        }

        activePopup.set("alert")
    },
    CLOSE: () => {
        if (get(saved)) window.api.send(MAIN, { channel: "CLOSE" })
        else activePopup.set("unsaved")
    },
    RECEIVE_MIDI: (msg) => playMidiIn(msg),
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
        newToast("$toast.media_replaced")
        showsCache.update((a) => {
            let media = a[ref.showId].media[ref.mediaId]
            if (ref.cloud) {
                if (!media.cloud) a[ref.showId].media[ref.mediaId].cloud = {}
                a[ref.showId].media[ref.mediaId].cloud![ref.cloudId] = path
            } else {
                a[ref.showId].media[ref.mediaId].path = path
            }

            return a
        })
    },
}

export const receiveSTORE: any = {
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
        mediaCache.set(a.media || {})
        textCache.set(a.text || {})
    },
    HISTORY: (a: any) => {
        undoHistory.set(a.undo || [])
        redoHistory.set(a.redo || [])
    },
}

const receiveNDI: any = {
    SEND_DATA: (msg) => {
        if (!msg?.id) return

        ndiData.update((a) => {
            a[msg.id] = msg

            return a
        })
    },
}

const receiveFOLDER: any = {
    MEDIA: (a: any, id: "media" | "audio" = "media") => {
        // TODO: clean
        // check if folder already exists
        let path: string = a.path
        let exists = Object.values(id === "media" ? get(mediaFolders) : get(audioFolders)).find((a) => a.path === path)
        if (exists) {
            newToast("$error.folder_exists")
            return
        }
        history({
            id: "UPDATE",
            newData: { data: { name: getFileName(path), icon: "folder", path: path } },
            location: { page: "drawer", id: "category_" + id },
        })
    },
    AUDIO: (a: any) => receiveFOLDER.MEDIA(a, "audio"),
    SHOWS: (a: any) => showsPath.set(a.path),
    EXPORT: (a: any) => exportPath.set(a.path),
    SCRIPTURE: (a: any) => scripturePath.set(a.path),
    RECORDING: (a: any) => recordingPath.set(a.path),
}

// OUTPUT

const receiveOUTPUTasMAIN: any = {
    PREVIEW: ({ id, buffer, size, originalSize }) => {
        previewBuffers.update((a) => {
            a[id] = { buffer, size, originalSize }
            return a
        })
    },
    OUTPUTS: (a: any) => outputs.set(a),
    RESTART: () => restartOutputs(),
    DISPLAY: (a: any) => outputDisplay.set(a.enabled),
    AUDIO_MAIN: async (data: any) => {
        audioChannels.set(data.channels)
        if (!data.id) return

        // let analyser: any = await getAnalyser(video)
        // TODO: remove when finished
        playingVideos.update((a) => {
            let existing = a.findIndex((a) => a.id === data.id && a.location === "output")
            if (existing > -1) a[existing].channels = data.channels
            else {
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
    REQUEST_DATA_MAIN: () => sendInitialOutputData(),
    MAIN_LOG: (msg: any) => console.log(msg),
    MAIN_VIDEO_ENDED: async (msg) => {
        console.log("ENDED", msg)
        let videoPath = get(outputs)[msg.id].out?.background?.path
        if (!videoPath) return

        // check and execute next after media regardless of loop
        setTimeout(() => checkNextAfterMedia(videoPath!), 100)
        // if (checkNextAfterMedia(videoPath)) return
    },
}

let previousOutputs: string = ""
const receiveOUTPUTasOUTPUT: any = {
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

    DRAW: (a: any) => draw.set(a),
    DRAW_TOOL: (a: any) => drawTool.set(a),
    DRAW_SETTINGS: (a: any) => drawSettings.set(a),
    VIZUALISER_DATA: (a: any) => visualizerData.set(a),
    MEDIA: (a: any) => mediaFolders.set(a),
    TIMERS: (a: any) => clone(timers.set(a)),
    VARIABLES: (a: any) => clone(variables.set(a)),
    ACTIVE_TIMERS: (a: any) => activeTimers.set(a),
    // POSITION: (a: any) => outputPosition.set(a),
    PLAYER_VIDEOS: (a: any) => playerVideos.set(a),
    STAGE_SHOWS: (a: any) => stageShows.set(a),
}

export function sendInitialOutputData() {
    send(OUTPUT, ["STYLES"], get(styles))
    send(OUTPUT, ["TRANSITION"], get(transitionData))
    send(OUTPUT, ["SHOWS"], get(showsCache))

    send(OUTPUT, ["TEMPLATES"], get(templates))
    send(OUTPUT, ["OVERLAYS"], get(overlays))
    send(OUTPUT, ["EVENTS"], get(events))

    send(OUTPUT, ["DRAW"], get(draw))
    send(OUTPUT, ["DRAW_TOOL"], get(drawTool))
    send(OUTPUT, ["DRAW_SETTINGS"], get(drawSettings))

    send(OUTPUT, ["VIZUALISER_DATA"], get(visualizerData))
    send(OUTPUT, ["MEDIA"], get(mediaFolders))
    send(OUTPUT, ["TIMERS"], get(timers))
    send(OUTPUT, ["VARIABLES"], get(variables))

    send(OUTPUT, ["PLAYER_VIDEOS"], get(playerVideos))
    send(OUTPUT, ["STAGE_SHOWS"], get(stageShows))

    // received by Output
    send(OUTPUT, ["VOLUME"], get(volume))

    setTimeout(() => {
        send(OUTPUT, ["OUTPUTS"], get(outputs))
        // used for stage mirror data
        send(OUTPUT, ["ALL_OUTPUTS"], get(outputs))
    }, 100)
}

// IMPORT

const receiveIMPORT: any = {
    txt: (a: any) => convertTexts(a),
    pdf: (a: any) => convertPDF(a),
    calendar: (a: any) => convertCalendar(a),
    powerpoint: (a: any) => convertPowerpoint(a),
    word: (a: any) => convertTexts(a),
    freeshow: (a: any) => importShow(a),
    freeshow_project: (a: any) => importProject(a),
    easyworship: (a: any) => convertEasyWorship(a),
    videopsalm: (a: any) => convertVideopsalm(a),
    openlp: (a: any) => convertOpenLP(a),
    opensong: (a: any) => convertOpenSong(a),
    propresenter: (a: any) => convertProPresenter(a),
    chordpro: (a: any) => convertChordPro(a),
    freeshow_bible: (a: any) => importFSB(a),
    beblia_bible: (a: any) => convertBebliaBible(a),
    zefania_bible: (a: any) => convertZefaniaBible(a),
    opensong_bible: (a: any) => convertOpenSongBible(a),
    lessons: (a: any) => convertLessonsPresentation(a),
}

function importShow(files: any[]) {
    let tempShows: any[] = []

    files.forEach(({ content, name }: any) => {
        let id, show

        try {
            ;[id, show] = JSON.parse(content)
        } catch (e: any) {
            console.error(name, e)
            let pos = Number(e.toString().replace(/\D+/g, "") || 100)
            console.log(pos, content.slice(pos - 5, pos + 5), content.slice(pos - 100, pos + 100))
            return
        }

        tempShows.push({ id, show: { ...show, name: checkName(show.name, id) } })
    })

    setTempShows(tempShows)
}
