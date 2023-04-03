import { get } from "svelte/store"
import { MAIN, OPEN_FOLDER, OUTPUT, STORE } from "../../types/Channels"
import { menuClick } from "../components/context/menuClick"
import { clone } from "../components/helpers/array"
import { analyseAudio } from "../components/helpers/audio"
import { history } from "../components/helpers/history"
import { getFileName } from "../components/helpers/media"
import { loadShows } from "../components/helpers/setShow"
import { checkName } from "../components/helpers/show"
import { convertBebliaBible } from "../converters/bebliaBible"
import { importFSB } from "../converters/bible"
import { convertCalendar } from "../converters/calendar"
import { convertEasyWorship } from "../converters/easyworship"
import { setTempShows } from "../converters/importHelpers"
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
    activeShow,
    activeTimers,
    alertMessage,
    audioFolders,
    autoOutput,
    currentWindow,
    draw,
    drawSettings,
    drawTool,
    events,
    exportPath,
    folders,
    loaded,
    media,
    mediaCache,
    mediaFolders,
    os,
    outputDisplay,
    outputs,
    overlays,
    playerVideos,
    playingVideos,
    projects,
    saved,
    shows,
    showsCache,
    showsPath,
    stageShows,
    templates,
    textCache,
    themes,
    transitionData,
    version,
} from "../stores"
import { IMPORT } from "./../../types/Channels"
import { redoHistory, scripturesCache, undoHistory } from "./../stores"
import { checkForUpdates } from "./checkForUpdates"
import { createData } from "./createData"
import { setLanguage } from "./language"
import { listen } from "./messages"
import { playMidiIn } from "./midi"
import { receive, send } from "./request"
import { updateSettings } from "./updateSettings"

export function startup() {
    loaded.set(false)
    send(MAIN, ["OUTPUT", "DISPLAY", "VERSION"])
    setTimeout(() => send(STORE, ["SETTINGS"]), 500)

    // DEBUG
    // window.api.send("LOADED")

    receive(MAIN, receiveMAIN)
    receive(STORE, receiveSTORE)
    receive(OUTPUT, receiveOUTPUT)
    receive(IMPORT, receiveIMPORT)
    receive(OPEN_FOLDER, receiveFOLDER)
}

function startupMain() {
    // load files
    send(STORE, ["SHOWS", "STAGE_SHOWS", "PROJECTS", "OVERLAYS", "TEMPLATES", "EVENTS", "MEDIA", "THEMES", "HISTORY", "CACHE"])
    setLanguage()

    // load new show on show change
    activeShow.subscribe((a) => {
        if (a && (a.type === undefined || a.type === "show")) loadShows([a.id])
    })

    setTimeout(() => {
        listen()
    }, 3000)
}

// receivers

const receiveMAIN: any = {
    GET_OS: (a: any) => os.set(a),
    VERSION: (a: any) => {
        version.set(a)
        checkForUpdates(a)
    },
    DISPLAY: (a: any) => outputDisplay.set(a),
    GET_PATHS: (a: any) => {
        // only on first startup
        createData(a)
    },
    MENU: (a: any) => menuClick(a),
    SHOWS_PATH: (a: any) => showsPath.set(a),
    EXPORT_PATH: (a: any) => exportPath.set(a),
    READ_SAVED_CACHE: (a: any) => {
        if (!a) return
        Object.entries(JSON.parse(a)).forEach(([key, data]: any) => {
            // TODO: undoing save is not working properly (seems like all saved are the same??)

            if (key === "showsCache") console.log("SHOWS CACHE ---", clone(get(showsCache)), data)

            // don't revert undo/redo history
            if (key === "HISTORY") return
            if (receiveSTORE[key]) receiveSTORE[key](data)
            // if undo = { ...data, ...get(showsCache) } else { ...get(showsCache), ...data }
            else if (key === "showsCache") showsCache.set({ ...data, ...get(showsCache) })
            else if (key === "scripturesCache") scripturesCache.set(data)
            else if (key === "path") showsPath.set(data)
            else console.log("MISSING HISTORY RESTORE KEY:", key)
        })

        // save to files?
        // window.api.send(STORE, { channel: "SAVE", data: allSavedData })

        saved.set(true)
    },
    ALERT: (a: any) => {
        alertMessage.set(a)
        activePopup.set("alert")
    },
    CLOSE: () => {
        if (get(saved)) window.api.send(MAIN, { channel: "CLOSE" })
        else activePopup.set("unsaved")
    },
    OUTPUT: (a: any) => {
        if (a === "true") currentWindow.set("output")
        else if (a === "pdf") currentWindow.set("pdf")
        else startupMain()
    },
    RECEIVE_MIDI: (msg) => playMidiIn(msg),
}

export const receiveSTORE: any = {
    SETTINGS: (a: any) => updateSettings(a),
    SHOWS: (a: any) => shows.set(a),
    STAGE_SHOWS: (a: any) => stageShows.set(a),
    PROJECTS: (a: any) => {
        projects.set(a.projects)
        folders.set(a.folders)
    },
    OVERLAYS: (a: any) => overlays.set(a),
    TEMPLATES: (a: any) => templates.set(a),
    EVENTS: (a: any) => events.set(a),
    MEDIA: (a: any) => media.set(a),
    THEMES: (a: any) => themes.set(a),
    CACHE: (a: any) => {
        mediaCache.set(a.media || {})
        textCache.set(a.text || {})
    },
    HISTORY: (a: any) => {
        undoHistory.set(a.undo || [])
        redoHistory.set(a.redo || [])
    },
}

const receiveOUTPUT: any = {
    OUTPUTS: (a: any) => outputs.set(a),
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
    OVERLAYS: (a: any) => overlays.set(a),
    EVENTS: (a: any) => events.set(a),

    DRAW: (a: any) => draw.set(a),
    DRAW_TOOL: (a: any) => drawTool.set(a),
    DRAW_SETTINGS: (a: any) => drawSettings.set(a),
    MEDIA: (a: any) => mediaFolders.set(a),
    ACTIVE_TIMERS: (a: any) => activeTimers.set(a),
    DISPLAY: (a: any) => outputDisplay.set(a.enabled),
    // POSITION: (a: any) => outputPosition.set(a),
    PLAYER_VIDEOS: (a: any) => playerVideos.set(a),
    AUDIO_MAIN: async (data: any) => {
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
    SCREEN_ADDED: () => {
        if (get(autoOutput) && !get(outputDisplay)) {
            // TODO: outputs...
            // send(OUTPUT, ["DISPLAY"], { enabled: true, screen: a })
            // outputScreen.set(a)
        }
    },
}

// const receiveOUTPUTasOutput: any = {
//   DISPLAY: receiveOUTPUT.DISPLAY,
// }

const receiveFOLDER: any = {
    MEDIA: (a: any, id: "media" | "audio" = "media") => {
        // TODO: clean
        // check if folder already exists
        let path: string = a.path
        let exists = Object.values(id === "media" ? get(mediaFolders) : get(audioFolders)).find((a) => a.path === path)
        if (exists) {
            alertMessage.set("error.folder_exists")
            activePopup.set("alert")
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
}

const receiveIMPORT: any = {
    txt: (a: any) => convertTexts(a),
    pdf: (a: any) => convertPDF(a),
    calendar: (a: any) => convertCalendar(a),
    powerpoint: (a: any) => convertPowerpoint(a),
    freeshow: (a: any) => importShow(a),
    freeshow_project: (a: any) => importProject(a),
    easyworship: (a: any) => convertEasyWorship(a),
    videopsalm: (a: any) => convertVideopsalm(a),
    openlp: (a: any) => convertOpenLP(a),
    opensong: (a: any) => convertOpenSong(a),
    propresenter: (a: any) => convertProPresenter(a),
    freeshow_bible: (a: any) => importFSB(a),
    beblia_bible: (a: any) => convertBebliaBible(a),
    zefania_bible: (a: any) => convertZefaniaBible(a),
    opensong_bible: (a: any) => convertOpenSongBible(a),
}

function importShow(files: any[]) {
    let tempShows: any[] = []

    files.forEach(({ content }: any) => {
        let [id, show] = JSON.parse(content)
        tempShows.push({ id, show: { ...show, name: checkName(show.name) } })
    })

    setTempShows(tempShows)
}
