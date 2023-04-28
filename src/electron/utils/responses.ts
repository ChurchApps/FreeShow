// ----- FreeShow -----
// Respond to messages from the frontend

import { app, Display, screen } from "electron"
import lyricsFinder from "lyrics-finder"
import os from "os"
import path from "path"
import { closeMain, getScreens, loadFonts, mainWindow, maximizeMain, openURL, setGlobalMenu, toApp } from ".."
import { BIBLE, MAIN, SHOW } from "../../types/Channels"
import { Show } from "../../types/Show"
import { closeServers, startServers } from "../servers"
import { Message } from "./../../types/Socket"
import { createPDFWindow, exportProject, exportTXT } from "./export"
import { checkShowsFolder, deleteFile, getDocumentsFolder, getPaths, loadFile, readFile, readFolder, selectFilesDialog, selectFolderDialog } from "./files"
import { importShow } from "./import"
import { closeMidiInPorts, getMidiInputs, getMidiOutputs, receiveMidi, sendMidi } from "./midi"

// IMPORT
export function startImport(_e: any, msg: Message) {
    let files: string[] = selectFilesDialog("", msg.data)

    if ((os.platform() === "linux" && msg.channel === "pdf") || (msg.data.extensions && !files.length)) return
    importShow(msg.channel, files || null)
}

// EXPORT
export function startExport(_e: any, msg: Message) {
    if (msg.channel !== "GENERATE") return

    let path: string = msg.data.path

    if (!path) {
        path = selectFolderDialog()
        if (!path) return
        toApp(MAIN, { channel: "EXPORT_PATH", data: path })
    }

    if (msg.data.type === "pdf") createPDFWindow(msg.data)
    else if (msg.data.type === "txt") exportTXT(msg.data)
    else if (msg.data.type === "project") exportProject(msg.data)
}

// BIBLE
export function loadScripture(e: any, msg: Message) {
    let p: string = path.resolve(app.getPath("documents"), "FreeShow", "Bibles", msg.name + ".fsb")
    let bible: any = loadFile(p, msg.id)

    // pre v0.5.6
    if (bible.error) p = path.resolve(app.getPath("documents"), "Bibles", msg.name + ".fsb")
    bible = loadFile(p, msg.id)

    if (msg.data) bible.data = msg.data
    e.reply(BIBLE, bible)
}

// SHOW
export function loadShow(e: any, msg: Message) {
    let p: string = checkShowsFolder(msg.path || "")
    p = path.resolve(p, msg.name + ".show")
    let show: any = loadFile(p, msg.id)

    e.reply(SHOW, show)
}

// MAIN
const mainResponses: any = {
    GET_OS: (): any => ({ platform: os.platform(), name: os.hostname() }),
    GET_SYSTEM_FONTS: (): void => loadFonts(),
    VERSION: (): string => app.getVersion(),
    URL: (data: string): void => openURL(data),
    START: (data: any): void => startServers(data),
    STOP: (): void => closeServers(),
    IP: (): any => os.networkInterfaces(),
    LANGUAGE: (data: any): void => setGlobalMenu(data.strings),
    SHOWS_PATH: (): string => getDocumentsFolder(),
    EXPORT_PATH: (): string => getDocumentsFolder(null, "Exports"),
    // READ_SAVED_CACHE: (data: any): string => readFile(path.resolve(getDocumentsFolder(null, "Saves"), data.id + ".json")),
    DISPLAY: (): boolean => false,
    GET_MIDI_OUTPUTS: (): string[] => getMidiOutputs(),
    GET_MIDI_INPUTS: (): string[] => getMidiInputs(),
    GET_SCREENS: (): void => getScreens(),
    GET_WINDOWS: (): void => getScreens("window"),
    GET_DISPLAYS: (): Display[] => screen.getAllDisplays(),
    GET_PATHS: (): any => getPaths(),
    OUTPUT: (_: any, e: any): "true" | "false" => (e.sender.id === mainWindow?.webContents.id ? "false" : "true"),
    CLOSE: (): void => closeMain(),
    MAXIMIZE: (): void => maximizeMain(),
    MAXIMIZED: (): boolean => !!mainWindow?.isMaximized(),
    MINIMIZE: (): void => mainWindow?.minimize(),
    FULLSCREEN: (): void => mainWindow?.setFullScreen(!mainWindow?.isFullScreen()),
    SEARCH_LYRICS: (data: any): void => {
        searchLyrics(data)
    },
    SEND_MIDI: (data: any): void => {
        sendMidi(data)
    },
    RECEIVE_MIDI: (data: any): void => {
        receiveMidi(data)
    },
    CLOSE_MIDI: (data: any): void => {
        closeMidiInPorts(data.id)
    },
    DELETE_SHOWS: (data: any) => deleteShowsNotIndexed(data),
    REFRESH_SHOWS: (data: any) => refreshAllShows(data),
}

export function receiveMain(e: any, msg: Message) {
    let data: any = msg
    if (mainResponses[msg.channel]) data = mainResponses[msg.channel](msg.data, e)

    if (data !== undefined) e.reply(MAIN, { channel: msg.channel, data })
}

async function searchLyrics({ artist, title }: any) {
    let lyrics: string = await lyricsFinder(artist, title)
    toApp("MAIN", { channel: "SEARCH_LYRICS", data: { lyrics } })
}

function deleteShowsNotIndexed(data: any) {
    // get all names
    let names: string[] = Object.values(data.shows).map(({ name }: any) => name + ".show")

    // list all shows in folder
    let filesInFolder: string[] = readFolder(data.path)
    if (!filesInFolder.length) return

    let deleted: string[] = []

    for (const name of filesInFolder) checkFile(name)
    function checkFile(name: string) {
        if (names.includes(name) || !name.includes(".show")) return

        let p: string = path.join(data.path, name)
        deleteFile(p)
        deleted.push(name)
    }

    toApp("MAIN", { channel: "DELETE_SHOWS", data: { deleted } })
}

function refreshAllShows(data: any) {
    // list all shows in folder
    let filesInFolder: string[] = readFolder(data.path)
    if (!filesInFolder.length) return

    let newShows: any = {}

    for (const name of filesInFolder) loadFile(name)
    function loadFile(name: string) {
        if (!name.includes(".show")) return

        let p: string = path.join(data.path, name)
        let show = null
        try {
            show = JSON.parse(readFile(p) || "{}")
        } catch (error) {
            console.error("Error parsing show " + name) //  + ":", error
        }
        if (!show || !show[1]) return

        newShows[show[0]] = trimShow(show[1])
    }

    if (!Object.keys(newShows).length) return
    toApp("MAIN", { channel: "REFRESH_SHOWS", data: newShows })
}

// WIP duplicate of setShow.ts
function trimShow(showCache: Show) {
    let show: any = {}
    show = {
        name: showCache.name,
        category: showCache.category,
        timestamps: showCache.timestamps,
    }
    if (showCache.private) show.private = true

    return show
}
