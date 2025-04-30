import { type ICommonTagsResult, parseFile } from "music-metadata"
import { join } from "path"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { dataFolderNames, deleteFile, doesPathExist, getDocumentsFolder, makeDir, writeFile } from "../utils/files"
import express from "express"

const fileNameText = "NowPlaying.txt"
const fileNameImage = "NowPlayingCover.png"

let currentContent = ""
export async function setPlayingState(data: { dataPath: string; filePath: string; name: string }) {
    const documentsPath = makeDir(join(data.dataPath || getDocumentsFolder(), dataFolderNames.audio))

    // create playing data text file
    const filePath = join(documentsPath, fileNameText)
    const content = data.name
    writeFile(filePath, content)

    currentContent = content
    startServer()

    // get metadata
    const metadata = await getAudioMetadata(data.filePath)

    // create album art cover
    const filePathCover = join(documentsPath, fileNameImage)
    const cover = metadata?.picture?.[0]
    const buffer = cover?.data
    if (!buffer) {
        if (doesPathExist(filePathCover)) {
            deleteFile(filePathCover)
        }
        return
    }

    writeFile(filePathCover, buffer)
}

// remove now playing when not playing
export function unsetPlayingAudio(data: { dataPath: string }) {
    const documentsPath = join(data.dataPath, dataFolderNames.audio)

    const filePath = join(documentsPath, fileNameText)
    writeFile(filePath, "")

    const filePathCover = join(documentsPath, fileNameImage)
    if (doesPathExist(filePathCover)) {
        deleteFile(filePathCover)
    }
}

const app = express()
let started = false
const PLAYING_DATA_PORT = 5502
function startServer() {
    if (started) return
    started = true

    app.all("/", (_req, res) => {
        res.setHeader("content-type", "text/plain")
        res.send(currentContent)
    })

    app.listen(PLAYING_DATA_PORT, () => {
        console.info(`Serving audio name at PORT: ${PLAYING_DATA_PORT}`)
    })
}

async function getAudioMetadata(filePath: string): Promise<ICommonTagsResult | null> {
    if (!filePath) return null

    return new Promise(async (resolve) => {
        try {
            const metadata = (await parseFile(filePath))?.common
            if (!metadata) {
                resolve(null)
                return
            }

            sendToMain(ToMain.AUDIO_METADATA, { filePath, metadata })
            resolve(metadata)
        } catch (err: any) {
            console.error("Error parsing metadata:", err.message)
        }
    })
}
