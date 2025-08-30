// ----- FreeShow -----
// This is for media/file functions

import { get } from "svelte/store"
import { Main } from "../../../types/IPC/Main"
import type { MediaStyle, Subtitle } from "../../../types/Main"
import type { Cropping, Styles } from "../../../types/Settings"
import type { ShowType } from "../../../types/Show"
import { requestMain, sendMain } from "../../IPC/main"
import { dataPath, loadedMediaThumbnails, media, outputs, tempPath } from "../../stores"
import { newToast, wait, waitUntilValueIsDefined } from "../../utils/common"
import { audioExtensions, imageExtensions, mediaExtensions, presentationExtensions, videoExtensions } from "../../values/extensions"
import type { API_media, API_slide_thumbnail } from "../actions/api"
import { clone } from "./array"
import { getActiveOutputs, getOutputResolution } from "./output"

export function getExtension(path: string): string {
    if (typeof path !== "string") return ""
    if (path.indexOf(".") < 0) return path
    if (path.includes("?")) path = path.slice(0, path.indexOf("?"))
    return path.substring(path.lastIndexOf(".") + 1).toLowerCase()
}

export function removeExtension(name: string): string {
    if (!name) return ""
    if (name.indexOf(".") < 0) return name
    return name.slice(0, name.lastIndexOf("."))
}

export function isMediaExtension(extension: string, audio = false): boolean {
    let extensions: string[] = [...imageExtensions, ...videoExtensions]
    if (audio) extensions = audioExtensions
    return extensions.includes(extension.toLowerCase())
}

export function getMediaType(extension: string): ShowType {
    if (extension.toLowerCase() === "pdf") return "pdf"
    if (presentationExtensions.includes(extension.toLowerCase())) return "ppt"
    if (audioExtensions.includes(extension.toLowerCase())) return "audio"
    if (videoExtensions.includes(extension.toLowerCase())) return "video"
    return "image"
}

export function getFileName(path: string): string {
    if (typeof path !== "string") return ""
    if (path.indexOf("\\") > -1) return path.substring(path.lastIndexOf("\\") + 1)
    if (path.indexOf("/") > -1) return path.substring(path.lastIndexOf("/") + 1)
    return path
}

let pathJoiner = ""
export function splitPath(path: string): string[] {
    if (typeof path !== "string") return []
    if (path.indexOf("\\") > -1) pathJoiner = "\\"
    if (path.indexOf("/") > -1) pathJoiner = "/"
    return path.split(pathJoiner) || []
}

export function joinPath(path: string[]): string {
    if (!pathJoiner) splitPath(path?.[0])
    return path.join(pathJoiner)
}

// fix for media files with special characters in file name not playing
export function encodeFilePath(path: string): string {
    if (typeof path !== "string") return ""

    // already encoded
    if (path.match(/%\d+/g) || path.includes("http") || path.includes("data:")) return path

    // can't load file paths with "#"
    path = path.replaceAll("#", "%23")

    const splittedPath = splitPath(path)
    const fileName = splittedPath.pop() || ""
    const encodedName = encodeURIComponent(fileName)

    return joinPath([...splittedPath, encodedName])
}

// decode only file name in path (not full path)
// export function decodeFilePath(path: string) {
//     let splittedPath = splitPath(path)
//     let fileName = splittedPath.pop() || ""
//     let decodedName = decodeURI(fileName)

//     return joinPath([...splittedPath, decodedName])
// }

export async function getThumbnail(data: API_media) {
    let path = data.path
    if (videoExtensions.includes(getExtension(path))) {
        path = getThumbnailPath(path, mediaSize.drawerSize)
    }

    return await toDataURL(path)
}

export async function getSlideThumbnail(data: API_slide_thumbnail, extraOutData: { backgroundImage?: string; overlays?: string[] } = {}, plainSlide = false) {
    const outputId = getActiveOutputs(get(outputs), false, true, true)[0]
    const outSlide = get(outputs)[outputId]?.out?.slide

    if (!data.showId) data.showId = outSlide?.id
    if (!data.layoutId) data.layoutId = outSlide?.layout
    if (data.index === undefined) data.index = outSlide?.index

    if (!data?.showId) return ""

    const output = clone(get(outputs)[outputId])
    if (!output.out) output.out = {}
    output.out.slide = { id: data.showId, layout: data.layoutId, index: data.index }

    if (plainSlide) {
        output.style = ""
        output.out = { slide: output.out.slide }
    }

    if (extraOutData.backgroundImage) output.out.background = { path: extraOutData.backgroundImage }
    if (extraOutData.overlays) output.out.overlays = extraOutData.overlays

    let resolution: any = getOutputResolution(outputId)
    resolution = { width: resolution.width * 0.5, height: resolution.height * 0.5 }

    const thumbnail = await requestMain(Main.CAPTURE_SLIDE, { output: { [outputId]: output }, resolution })
    return thumbnail?.base64 || ""
}

// convert to base64
async function toDataURL(url: string): Promise<string> {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest()

        xhr.onload = () => {
            const reader = new FileReader()
            reader.onloadend = () => resolve((reader.result || "").toString())
            reader.readAsDataURL(xhr.response)
        }
        xhr.onerror = () => resolve("")

        xhr.open("GET", url)
        xhr.responseType = "blob"
        xhr.send()
    })
}

// check if media file exists in plain js
export function checkMedia(src: string): Promise<boolean> {
    const extension = getExtension(src)
    const isVideo = videoExtensions.includes(extension)
    const isAudio = !isVideo && audioExtensions.includes(extension)

    return new Promise((resolve) => {
        let elem
        if (isVideo) {
            elem = document.createElement("video")
            elem.onloadeddata = () => finish()
        } else if (isAudio) {
            elem = document.createElement("audio")
            elem.onloadeddata = () => finish()
        } else {
            elem = new Image()
            elem.onload = () => finish()
        }

        elem.onerror = () => finish(false)
        elem.src = encodeFilePath(src)

        const timedout = setTimeout(() => {
            finish(false)
        }, 3000)

        function finish(response = true) {
            clearTimeout(timedout)
            resolve(response)
        }
    })
}

export async function getMediaInfo(path: string): Promise<{ codecs: string[]; mimeType: string; mimeCodec: string } | null> {
    let info: { path?: string; codecs: string[]; mimeType: string; mimeCodec: string } | null = null
    if (typeof path !== "string") return info
    if (path.includes("http") || path.includes("data:")) return info

    const cachedInfo = get(media)[path]?.info
    if (cachedInfo?.codecs?.length) return cachedInfo

    try {
        info = await requestMain(Main.MEDIA_CODEC, { path })
    } catch (err) {
        return info
    }

    if (!info) return info

    delete info.path

    if (JSON.stringify(get(media)[path]?.info) === JSON.stringify(info)) return info

    media.update((a) => {
        if (!a[path]) a[path] = {}
        a[path].info = info
        return a
    })

    return info
}

export async function isVideoSupported(path: string) {
    const info = await getMediaInfo(path)
    if (!info?.codecs) return true

    // HEVC (H.265) / Timecode
    const unsupportedCodecs = /(hevc|hvc1|ap4h|tmcd)/i
    const isUnsupported = info.codecs.length && info.codecs.every((codec) => unsupportedCodecs.test(codec))

    // not reliable:
    // const isSupported = MediaSource.isTypeSupported(info.mimeCodec)

    if (isUnsupported) newToast("$toast.unsupported_video")
    return !isUnsupported
}

export function setMediaTracks(data: { path: string; tracks: Subtitle[] }) {
    const path: string = data.path || ""

    media.update((a) => {
        if (!a[path]) a[path] = {}
        a[path].tracks = data.tracks
        return a
    })
}

export function enableSubtitle(video: HTMLVideoElement, languageId: string) {
    if (!video) return
    const tracks = [...(video.textTracks || [])]

    const enabled = tracks.find((a) => a.mode !== "disabled")
    if (enabled) enabled.mode = "disabled"

    if (!languageId) return

    const newTrack = tracks.find((a) => a.language === languageId)
    if (newTrack) newTrack.mode = "showing"
}

export function getMediaStyle(mediaObj: MediaStyle | undefined, currentStyle: Styles | undefined) {
    const mediaStyle: MediaStyle = {
        filter: "",
        flipped: false,
        flippedY: false,
        fit: currentStyle?.fit || "contain",
        speed: "1",
        fromTime: 0,
        toTime: 0,
        videoType: "",
        cropping: {}
    }

    if (!mediaObj && !currentStyle) return mediaStyle

    Object.keys(mediaStyle).forEach((key) => {
        if (!mediaObj?.[key]) return
        mediaStyle[key] = mediaObj[key]
    })

    return mediaStyle
}

export const mediaSize = {
    big: 900, // stage & editor
    slideSize: 500, // slide + remote
    drawerSize: 250, // drawer media
    small: 100 // show tools
}

export async function loadThumbnail(input: string, size: number) {
    if (typeof input !== "string") return ""

    // online media (e.g. Pixabay/Unsplash)
    if (input.includes("http") || input.includes("data:")) return input

    // already encoded (this could cause an infinite loop)
    if (input.includes("freeshow-cache")) return input

    const loadedPath = get(loadedMediaThumbnails)[getThumbnailId({ input, size })]
    if (loadedPath) return loadedPath

    const data = await requestMain(Main.GET_THUMBNAIL, { input, size })
    if (!data) return ""

    thumbnailLoaded(data)
    return data.output
}

export function getThumbnailPath(input: string, size: number) {
    if (!input) return ""

    // online media (e.g. Pixabay/Unsplash)
    if (input.includes("http") || input.includes("data:")) return input

    // already encoded
    if (input.includes("freeshow-cache")) return input

    const loadedPath = get(loadedMediaThumbnails)[getThumbnailId({ input, size })]
    if (loadedPath) return loadedPath

    const encodedPath: string = joinPath([get(tempPath), "freeshow-cache", getThumbnailFileName(hashCode(input))])
    return encodedPath

    function getThumbnailFileName(path: string) {
        return `${path}-${size}.png`
    }
}

// same as electron/thumbnails.ts
function hashCode(str: string) {
    if (!str) return ""
    let hash = 0

    for (let i = 0; i < str.length; i++) {
        const chr = str.charCodeAt(i)
        hash = (hash << 5) - hash + chr // bit shift
        hash |= 0 // convert to 32bit integer
    }

    if (hash < 0) return "i" + hash.toString().slice(1)
    return "a" + hash.toString()
}

export function thumbnailLoaded(data: { input: string; output: string; size: number }) {
    loadedMediaThumbnails.update((a) => {
        a[getThumbnailId(data)] = data.output
        return a
    })
}

function getThumbnailId(data: { input: string; size: number }) {
    return `${data.input}-${data.size}`
}

// convert path to base64
export async function getBase64Path(path: string, size: number = mediaSize.big) {
    if (typeof path !== "string" || !mediaExtensions.includes(getExtension(path))) return ""

    // online media (e.g. Pixabay/Unsplash)
    if (path.includes("http") || path.includes("data:")) return path

    const thumbnailPath = await loadThumbnail(path, size)
    if (!thumbnailPath) return ""

    // wait if thumbnail is not generated yet
    await checkThatMediaExists(thumbnailPath)

    const base64Path = await toDataURL(thumbnailPath)

    // "data:image/png;base64," +
    return base64Path || thumbnailPath
}

export async function checkThatMediaExists(path: string, iteration = 1): Promise<boolean> {
    if (iteration > 8) return false

    const exists = await checkMedia(path)
    if (!exists) {
        await wait(500 * iteration)
        return checkThatMediaExists(path, iteration + 1)
    }

    return exists
}

const cachedDurations: { [key: string]: number } = {}
export function getVideoDuration(path: string): Promise<number> {
    return new Promise((resolve) => {
        if (cachedDurations[path]) {
            resolve(cachedDurations[path])
            return
        }

        const video = document.createElement("video")
        video.src = path
        video.preload = "metadata"

        let loaded = false
        video.onloadedmetadata = () => {
            const duration = video.duration
            loaded = true

            // clean up references
            video.src = ""

            cachedDurations[path] = duration
            resolve(duration)
        }

        video.onerror = () => {
            if (loaded) return

            console.error(new Error("Failed to load video. Check the path or file format."))
            resolve(0)
        }
    })
}

// CACHE

// const jpegQuality = 90 // 0-100
const capturing: string[] = []
const retries: { [key: string]: number } = {}
export function captureCanvas(data: { input: string; output: string; size: any; extension: string; config: any; seek?: number }) {
    let completed = false
    if (capturing.includes(data.output)) return exit()
    capturing.push(data.output)

    const canvas = document.createElement("canvas")

    const isImage = imageExtensions.includes(data.extension)
    const mediaElem = document.createElement(isImage ? "img" : "video")

    mediaElem.addEventListener(isImage ? "load" : "loadeddata", async () => {
        const currentMediaSize = isImage
            ? { width: (mediaElem as HTMLImageElement).naturalWidth, height: (mediaElem as HTMLImageElement).naturalHeight }
            : { width: (mediaElem as HTMLVideoElement).videoWidth, height: (mediaElem as HTMLVideoElement).videoHeight }
        const newSize = getNewSize(currentMediaSize, data.size || {})
        canvas.width = newSize.width
        canvas.height = newSize.height

        // seek video
        if (!isImage) {
            ;(mediaElem as HTMLVideoElement).currentTime = (mediaElem as HTMLVideoElement).duration * (data.seek ?? 0.5)
            await wait(400)
        }

        // wait until loaded
        const hasLoaded = await waitUntilValueIsDefined(() => (isImage ? (mediaElem as HTMLImageElement).complete : (mediaElem as HTMLVideoElement).readyState === 4), 20)
        if (!hasLoaded) return exit()

        captureCanvasData(currentMediaSize)
    })

    // this should not get called becaues the file is checked existing, but here in case
    mediaElem.addEventListener("error", (err) => {
        if (!mediaElem.src || completed) return

        console.error("Could not load media:", err)
        if (!retries[data.input]) retries[data.input] = 0
        retries[data.input]++

        if (retries[data.input] > 2) return exit()
        else setTimeout(() => (isImage ? "" : (mediaElem as HTMLVideoElement).load()), 3000)
    })

    mediaElem.src = encodeFilePath(data.input)
    // document.body.appendChild(mediaElem) // DEBUG

    async function captureCanvasData(currentMediaSize) {
        const ctx = canvas.getContext("2d")
        if (!ctx || completed) return exit()

        // ensure lessons are downloaded and loaded before capturing
        const isLessons = data.input.includes("Lessons")
        const loading = isLessons ? 3000 : 200
        await wait(loading)
        ctx.drawImage(mediaElem, 0, 0, currentMediaSize.width, currentMediaSize.height, 0, 0, canvas.width, canvas.height)

        await wait(200)
        const dataURL = canvas.toDataURL("image/png") // , jpegQuality

        sendMain(Main.SAVE_IMAGE, { path: data.output, base64: dataURL })
        completed = true

        // unload
        capturing.splice(capturing.indexOf(data.input), 1)
        mediaElem.src = ""
    }

    function exit() {
        if (completed) return

        completed = true
        sendMain(Main.SAVE_IMAGE, { path: data.output })
    }
}

function getNewSize(contentSize: { width: number; height: number }, newSize: { width?: number; height?: number }) {
    if (!contentSize.width) contentSize.width = 1920
    if (!contentSize.height) contentSize.height = 1080

    const ratio = contentSize.width / contentSize.height

    let width = newSize.width
    let height = newSize.height
    if (!width) width = height ? Math.floor(height * ratio) : contentSize.width
    if (!height) height = newSize.width ? Math.floor(width / ratio) : contentSize.height

    return { width, height }
}

// CROP

export function cropImageToBase64(imagePath: string, crop: Partial<Cropping> | undefined): Promise<string> {
    return new Promise((resolve) => {
        if (!crop) return resolve("")
        if (!crop.bottom && !crop.left && !crop.right && !crop.top) return resolve("")

        const img = new Image()

        // needed if loading from local path
        img.src = imagePath.startsWith("file://") ? imagePath : `file://${imagePath}`
        img.onload = () => {
            const cropWidth = img.width - (crop.left || 0) - (crop.right || 0)
            const cropHeight = img.height - (crop.top || 0) - (crop.bottom || 0)

            if (cropWidth <= 0 || cropHeight <= 0) return resolve("")

            const canvas = document.createElement("canvas")
            canvas.width = cropWidth
            canvas.height = cropHeight

            const ctx = canvas.getContext("2d")!
            ctx.drawImage(img, crop.left || 0, crop.top || 0, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

            const base64 = canvas.toDataURL("image/png")
            resolve(base64)
        }
        img.onerror = () => resolve("")
    })
}

export async function downloadOnlineMedia(url: string) {
    const downloadedPath = await requestMain(Main.MEDIA_IS_DOWNLOADED, { url, dataPath: get(dataPath) })
    if (downloadedPath) return downloadedPath

    sendMain(Main.MEDIA_DOWNLOAD, { url, dataPath: get(dataPath) })
    return url
}
