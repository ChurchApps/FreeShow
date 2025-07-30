import { type ICommonTagsResult, parseFile } from "music-metadata"
import { join } from "path"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { createFolder, dataFolderNames, deleteFile, doesPathExist, getDocumentsFolder, writeFile } from "../utils/files"

const fileNameText = "NowPlaying.txt"
const fileNameImage = "NowPlayingCover.png"

// let currentContent = ""
export async function setPlayingState(data: { dataPath: string; filePath: string; name: string; unknownLang: string[] }) {
    const documentsPath = createFolder(join(data.dataPath || getDocumentsFolder(), dataFolderNames.audio))

    // get metadata
    const metadata = await getAudioMetadata(data.filePath)
    const artist = (metadata ? getArtist(metadata) : "") || data.unknownLang[0] || "Unknown Artist"
    const title = metadata?.title || data.name || data.unknownLang[1] || "Unknown Title"
    const album = metadata?.album || data.unknownLang[2] || "Unknown Album"

    // format: Artist - Title - Album
    const content = `${artist} - ${title} - ${album}`
    // currentContent = content

    // create playing data text file
    const filePath = join(documentsPath, fileNameText)
    writeFile(filePath, content)

    // (no point in this at the moment)
    // serve "text file" on local server
    // startServer()

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

// same as frontend function
function getArtist(metadata: ICommonTagsResult) {
    const artists = [metadata.originalartist, metadata.artist, metadata.albumartist, ...(metadata.artists || [])].filter(Boolean)
    return [...new Set(artists)].join(", ")
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

// const app = express()
// let started = false
// const PLAYING_DATA_PORT = 5502
// function startServer() {
//     if (started) return
//     started = true

//     app.all("/", (_req, res) => {
//         res.setHeader("content-type", "text/plain")
//         res.send(currentContent)
//     })

//     const server = app.listen(PLAYING_DATA_PORT, () => {
//         console.info(`Serving audio name at PORT: ${PLAYING_DATA_PORT}`)
//     })

//     server.once("error", (err: Error) => {
//         if ((err as any).code === "EADDRINUSE") server.close()
//     })
// }

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
