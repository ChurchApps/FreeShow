// ----- FreeShow -----
// Respond to messages from the frontend

import { app } from "electron"
import path from "path"
import { BIBLE, SHOW } from "../../types/Channels"
import { importShow } from "../data/import"
import type { Message } from "./../../types/Socket"
import { checkShowsFolder, dataFolderNames, getDataFolder, loadFile, selectFilesDialog } from "./files"

// IMPORT
export function startImport(_e: any, msg: Message) {
    let files: string[] = selectFilesDialog("", msg.data.format)

    let needsFileAndNoFileSelected = msg.data.format.extensions && !files.length
    if (needsFileAndNoFileSelected) return

    importShow(msg.channel, files || null, msg.data)
}

// BIBLE
export function loadScripture(e: any, msg: Message) {
    let bibleFolder: string = getDataFolder(msg.path || "", dataFolderNames.scriptures)
    let p: string = path.join(bibleFolder, msg.name + ".fsb")

    let bible: any = loadFile(p, msg.id)

    // pre v0.5.6
    if (bible.error) p = path.join(app.getPath("documents"), "Bibles", msg.name + ".fsb")
    bible = loadFile(p, msg.id)

    if (msg.data) bible.data = msg.data
    e.reply(BIBLE, bible)
}

// SHOW
export function loadShow(e: any, msg: Message) {
    let p: string = checkShowsFolder(msg.path || "")
    p = path.join(p, (msg.name || msg.id) + ".show")
    let show: any = loadFile(p, msg.id)

    e.reply(SHOW, show)
}
