// ----- FreeShow -----
// This is for media/file functions

import { get } from "svelte/store"
import { MAIN } from "../../../types/Channels"
import type { MediaStyle, Subtitle } from "../../../types/Main"
import type { Styles } from "../../../types/Settings"
import type { ShowType } from "../../../types/Show"
import { loadedMediaThumbnails, media, outputs, tempPath } from "../../stores"
import { newToast, wait, waitUntilValueIsDefined } from "../../utils/common"
import { awaitRequest, send } from "../../utils/request"
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
    if (name.indexOf(".") < 0) return name
    return name.slice(0, name.lastIndexOf("."))
}

export function isMediaExtension(extension: string, audio: boolean = false): boolean {
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

    let splittedPath = splitPath(path)
    let fileName = splittedPath.pop() || ""
    let encodedName = encodeURIComponent(fileName)

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

export async function getSlideThumbnail(data: API_slide_thumbnail) {
    let outputId = getActiveOutputs(get(outputs), false, true, true)[0]
    let outSlide = get(outputs)[outputId]?.out?.slide

    if (!data.showId) data.showId = outSlide?.id
    if (!data.layoutId) data.layoutId = outSlide?.layout
    if (data.index === undefined) data.index = outSlide?.index

    if (!data?.showId) return

    let output = clone(get(outputs)[outputId])
    if (!output.out) output.out = {}
    output.out.slide = { id: data.showId, layout: data.layoutId, index: data.index }

    let resolution: any = getOutputResolution(outputId)
    resolution = { width: resolution.width * 0.5, height: resolution.height * 0.5 }

    const thumbnail = await awaitRequest(MAIN, "CAPTURE_SLIDE", { output: { [outputId]: output }, resolution })
    return thumbnail.base64
}

// convert to base64
async function toDataURL(url: string): Promise<string> {
    return new Promise((resolve: any) => {
        var xhr = new XMLHttpRequest()

        xhr.onload = () => {
            var reader = new FileReader()
            reader.onloadend = () => resolve(reader.result?.toString())
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
    let extension = getExtension(src)
    let isVideo = videoExtensions.includes(extension)
    let isAudio = !isVideo && audioExtensions.includes(extension)

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

        let timedout = setTimeout(() => {
            finish(false)
        }, 3000)

        function finish(response: boolean = true) {
            clearTimeout(timedout)
            resolve(response)
        }
    })
}

export async function getMediaInfo(path: string) {
    if (typeof path !== "string") return {}
    if (path.includes("http") || path.includes("data:")) return {}

    const cachedInfo = get(media)[path]?.info
    if (cachedInfo?.codecs?.length) return cachedInfo

    let info
    try {
        info = await awaitRequest(MAIN, "MEDIA_CODEC", { path })
    } catch (err) {
        return {}
    }

    if (!info) return {}

    delete info.path
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
    let path: string = data.path || ""

    media.update((a) => {
        if (!a[path]) a[path] = {}
        a[path].tracks = data.tracks
        return a
    })
}

export function enableSubtitle(video: HTMLVideoElement, languageId: string) {
    if (!video) return
    let tracks = [...(video.textTracks || [])]

    let enabled = tracks.find((a) => a.mode !== "disabled")
    if (enabled) enabled.mode = "disabled"

    if (!languageId) return

    let newTrack = tracks.find((a) => a.language === languageId)
    if (newTrack) newTrack.mode = "showing"
}

export function getMediaStyle(mediaObj: MediaStyle | undefined, currentStyle: Styles | undefined) {
    let mediaStyle: MediaStyle = {
        filter: "",
        flipped: false,
        flippedY: false,
        fit: currentStyle?.fit || "contain",
        speed: "1",
        fromTime: 0,
        toTime: 0,
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
    small: 100, // show tools
}

export async function loadThumbnail(input: string, size: number) {
    if (typeof input !== "string") return ""

    // online media (e.g. Pixabay/Unsplash)
    if (input.includes("http") || input.includes("data:")) return input

    // already encoded (this could cause an infinite loop)
    if (input.includes("freeshow-cache")) return input

    let loadedPath = get(loadedMediaThumbnails)[getThumbnailId({ input, size })]
    if (loadedPath) return loadedPath

    let data = await awaitRequest(MAIN, "GET_THUMBNAIL", { input, size })
    if (!data) return ""

    thumbnailLoaded(data)
    return data.output as string
}

export function getThumbnailPath(input: string, size: number) {
    if (!input) return ""

    // online media (e.g. Pixabay/Unsplash)
    if (input.includes("http") || input.includes("data:")) return input

    // already encoded
    if (input.includes("freeshow-cache")) return input

    let loadedPath = get(loadedMediaThumbnails)[getThumbnailId({ input, size })]
    if (loadedPath) return loadedPath

    let encodedPath: string = joinPath([get(tempPath), "freeshow-cache", getFileName(hashCode(input), size)])
    return encodedPath

    function getFileName(path, size) {
        return `${path}-${size}.png`
    }
}

// same as electron/thumbnails.ts
function hashCode(str: string) {
    if (!str) return ""
    let hash = 0

    for (let i = 0; i < str.length; i++) {
        let chr = str.charCodeAt(i)
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

function getThumbnailId(data: any) {
    return `${data.input}-${data.size}`
}

// convert path to base64
export async function getBase64Path(path: string, size: number = mediaSize.big) {
    if (typeof path !== "string" || !mediaExtensions.includes(getExtension(path))) return ""

    // online media (e.g. Pixabay/Unsplash)
    if (path.includes("http") || path.includes("data:")) return path

    let thumbnailPath = await loadThumbnail(path, size)
    if (!thumbnailPath) return ""

    // wait if thumbnail is not generated yet
    await checkThatMediaExists(thumbnailPath)

    let base64Path = await toDataURL(thumbnailPath)

    // "data:image/png;base64," +
    return base64Path || thumbnailPath
}

export async function checkThatMediaExists(path: string, iteration: number = 1): Promise<boolean> {
    if (iteration > 8) return false

    let exists = await checkMedia(path)
    if (!exists) {
        await wait(500 * iteration)
        return checkThatMediaExists(path, iteration + 1)
    }

    return exists
}

// CACHE

// const jpegQuality = 90 // 0-100
let capturing: string[] = []
let retries: any = {}
export function captureCanvas(data: any) {
    let completed: boolean = false
    if (capturing.includes(data.output)) return exit()
    capturing.push(data.output)

    let canvas = document.createElement("canvas")

    let isImage: boolean = imageExtensions.includes(data.extension)
    let mediaElem: any = document.createElement(isImage ? "img" : "video")

    mediaElem.addEventListener(isImage ? "load" : "loadeddata", async () => {
        let mediaSize = isImage ? { width: mediaElem.naturalWidth, height: mediaElem.naturalHeight } : { width: mediaElem.videoWidth, height: mediaElem.videoHeight }
        let newSize = getNewSize(mediaSize, data.size || {})
        canvas.width = newSize.width
        canvas.height = newSize.height

        // seek video
        if (!isImage) {
            mediaElem.currentTime = mediaElem.duration * (data.seek ?? 0.5)
            await wait(400)
        }

        // wait until loaded
        let hasLoaded = await waitUntilValueIsDefined(() => (isImage ? mediaElem.complete : mediaElem.readyState === 4), 20)
        if (!hasLoaded) return exit()

        captureCanvasData(mediaElem, mediaSize)
    })

    // this should not get called becaues the file is checked existing, but here in case
    mediaElem.addEventListener("error", (err) => {
        if (!mediaElem.src || completed) return

        console.error("Could not load media:", err)
        if (!retries[data.input]) retries[data.input] = 0
        retries[data.input]++

        if (retries[data.input] > 2) return exit()
        else setTimeout(() => (isImage ? "" : mediaElem.load()), 3000)
    })

    mediaElem.src = encodeFilePath(data.input)
    // document.body.appendChild(mediaElem) // DEBUG

    async function captureCanvasData(media, mediaSize) {
        let ctx = canvas.getContext("2d")
        if (!ctx || completed) return exit()

        // ensure lessons are downloaded and loaded before capturing
        let isLessons = data.input.includes("Lessons")
        let loading = isLessons ? 3000 : 200
        await wait(loading)
        ctx.drawImage(media, 0, 0, mediaSize.width, mediaSize.height, 0, 0, canvas.width, canvas.height)

        await wait(200)
        let dataURL = canvas.toDataURL("image/png") // , jpegQuality

        send(MAIN, ["SAVE_IMAGE"], { path: data.output, base64: dataURL })
        completed = true

        // unload
        capturing.splice(capturing.indexOf(data.input), 1)
        mediaElem.src = ""
    }

    function exit() {
        if (completed) return

        completed = true
        send(MAIN, ["SAVE_IMAGE"], { path: data.output })
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
