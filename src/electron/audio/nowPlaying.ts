import { type ICommonTagsResult, parseFile } from "music-metadata"
import { join } from "path"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { deleteFile, doesPathExist, getDataFolderPath, openInSystem, readFile, writeFile } from "../utils/files"

const fileNameText = "NowPlaying.txt"
const fileNameImage = "NowPlayingCover.png"

type NowPlayingData = {
    filePath: string
    name: string
    unknownLang: string[]
    format: string
    duration: number
}

// let currentContent = ""
export async function setPlayingState(data: NowPlayingData) {
    const audioFolder = getDataFolderPath("audio")

    // get metadata
    const metadata = await getAudioMetadata(data.filePath)
    // const artist = (metadata ? getArtist(metadata) : "") || data.unknownLang[0] || "Unknown Artist"
    // const title = metadata?.title || data.name || data.unknownLang[1] || "Unknown Title"
    // const album = metadata?.album || data.unknownLang[2] || "Unknown Album"

    // format: Artist - Title - Album
    // const content = `${artist} - ${title} - ${album}`
    const content = await convertDynamicValues(data)
    // currentContent = content

    // create playing data text file
    const filePath = join(audioFolder, fileNameText)
    writeFile(filePath, content)

    // (no point in this at the moment)
    // serve "text file" on local server
    // startServer()

    // create album art cover
    const filePathCover = join(audioFolder, fileNameImage)
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

// , "{time}", "{time_s}"
const dynamicValues = ["{artist}", "{title}", "{album}", "{year}", "{artwork_path}", "{artwork_base64}", "{duration}", "{duration_s}"]
async function convertDynamicValues(data: NowPlayingData) {
    if (!data.format) data.format = `{artist} - {title} - {album}`

    const metadata = await getAudioMetadata(data.filePath)

    dynamicValues.forEach((value) => {
        data.format = data.format.replaceAll(value, replaceValue(value))
    })

    return data.format

    function replaceValue(value: string) {
        switch (value) {
            case "{artist}":
                return (metadata ? getArtist(metadata) : "") || data.unknownLang[0] || "Unknown Artist"
            case "{title}":
                return metadata?.title || data.name || data.unknownLang[1] || "Unknown Title"
            case "{album}":
                return metadata?.album || data.unknownLang[2] || "Unknown Album"
            case "{year}":
                return metadata?.year?.toString() || "Unknown Year"
            case "{artwork_path}":
            case "{artwork_base64}":
                const audioFolder = getDataFolderPath("audio")
                const coverFilePath = join(audioFolder, fileNameImage)
                if (value === "{artwork_path}") return coverFilePath

                if (!doesPathExist(coverFilePath)) return ""
                const pngBuffer = readFile(coverFilePath)
                const base64String = Buffer.from(pngBuffer).toString("base64")
                return pngBuffer ? `data:image/png;base64,${base64String}` : ""
            case "{duration}":
            case "{duration_s}":
                if (value === "{duration_s}") return data.duration.toString()

                if (!data.duration) return "00:00"
                const totalSeconds = Math.floor(data.duration)
                const minutes = Math.floor(totalSeconds / 60)
                const seconds = totalSeconds % 60
                return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
            default:
                return ""
        }
    }
}

// same as frontend function
function getArtist(metadata: ICommonTagsResult) {
    const artists = [metadata.originalartist, metadata.artist, metadata.albumartist, ...(metadata.artists || [])].filter(Boolean)
    return [...new Set(artists)].join(", ")
}

// remove now playing when not playing
export function unsetPlayingAudio() {
    const audioFolder = getDataFolderPath("audio")

    const filePath = join(audioFolder, fileNameText)
    writeFile(filePath, "")

    const filePathCover = join(audioFolder, fileNameImage)
    if (doesPathExist(filePathCover)) {
        deleteFile(filePathCover)
    }
}

export function openNowPlaying() {
    const audioFolder = getDataFolderPath("audio")
    const filePath = join(audioFolder, fileNameText)
    openInSystem(filePath)
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
