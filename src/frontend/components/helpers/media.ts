import { get } from "svelte/store"
import type { ShowType } from "../../../types/Show"
// ----- FreeShow -----
// This is for media/file functions

import { MAIN } from "../../../types/Channels"
import type { MediaStyle } from "../../../types/Main"
import type { Styles } from "../../../types/Settings"
import { audioExtensions, imageExtensions, loadedMediaThumbnails, tempPath, videoExtensions } from "../../stores"
import { wait, waitUntilValueIsDefined } from "../../utils/common"
import { awaitRequest, send } from "../../utils/request"

export function getExtension(path: string): string {
    if (!path) return ""
    if (path.indexOf(".") < 0) return path
    if (path.includes("?")) path = path.slice(0, path.indexOf("?"))
    return path.substring(path.lastIndexOf(".") + 1).toLowerCase()
}

export function removeExtension(name: string): string {
    if (name.indexOf(".") < 0) return name
    return name.slice(0, name.lastIndexOf("."))
}

export function isMediaExtension(extension: string, audio: boolean = false): boolean {
    let extensions: string[] = [...get(imageExtensions), ...get(videoExtensions)]
    if (audio) extensions = get(audioExtensions)
    return extensions.includes(extension.toLowerCase())
}

export function getMediaType(extension: string): ShowType {
    if (get(audioExtensions).includes(extension.toLowerCase())) return "audio"
    if (get(videoExtensions).includes(extension.toLowerCase())) return "video"
    return "image"
}

export function getFileName(path: string): string {
    if (!path) return ""
    if (path.indexOf("\\") > -1) return path.substring(path.lastIndexOf("\\") + 1)
    if (path.indexOf("/") > -1) return path.substring(path.lastIndexOf("/") + 1)
    return path
}

let pathJoiner = ""
export function splitPath(path: string): string[] {
    if (!path) return []
    if (path.indexOf("\\") > -1) pathJoiner = "\\"
    if (path.indexOf("/") > -1) pathJoiner = "/"
    return path.split(pathJoiner) || []
}

export function joinPath(path: string[]): string {
    if (!pathJoiner) splitPath(path[0])
    return path.join(pathJoiner)
}

// fix for media files with special characters in file name not playing
export function encodeFilePath(path: string): string {
    // already encoded
    if (path.match(/%\d+/g)) return path

    let splittedPath = splitPath(path)
    let fileName = splittedPath.pop() || ""
    let encodedName = encodeURIComponent(fileName)

    return joinPath([...splittedPath, encodedName])
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
        xhr.open("GET", url)
        xhr.responseType = "blob"
        xhr.send()
    })
}

// check if media file exists in plain js
export function checkMedia(src: string) {
    let extension = getExtension(src)
    let isVideo = get(videoExtensions).includes(extension)
    let isAudio = !isVideo && get(audioExtensions).includes(extension)

    return new Promise((resolve) => {
        let elem
        if (isVideo) {
            elem = document.createElement("video")
            elem.onloadeddata = () => resolve("true")
        } else if (isAudio) {
            elem = document.createElement("audio")
            elem.onloadeddata = () => resolve("true")
        } else {
            elem = new Image()
            elem.onload = () => resolve("true")
        }

        elem.src = src
    })
}

export function getMediaStyle(mediaObj: MediaStyle, currentStyle: Styles) {
    if (!mediaObj) return {}

    let mediaStyle: MediaStyle = {
        filter: "",
        flipped: false,
        flippedY: false,
        fit: "contain",
        speed: "1",
        fromTime: 0,
        toTime: 0,
    }

    Object.keys(mediaStyle).forEach((key) => {
        if (!mediaObj[key]) return
        mediaStyle[key] = mediaObj[key]
    })

    if (currentStyle?.fit) mediaStyle.fit = currentStyle.fit

    return mediaStyle
}

export const mediaSize = {
    big: 900, // stage & editor
    slideSize: 500, // slide + remote
    drawerSize: 250, // drawer media
    small: 100, // show tools
}

export async function loadThumbnail(input: string, size: number) {
    if (!input) return ""

    let loadedPath = get(loadedMediaThumbnails)[getThumbnailId({ input, size })]
    if (loadedPath) return loadedPath

    let data = await awaitRequest(MAIN, "GET_THUMBNAIL", { input, size })
    if (!data) return ""

    thumbnailLoaded(data)
    return data.output as string
}

export function getThumbnailPath(input: string, size: number) {
    if (!input) return ""

    let loadedPath = get(loadedMediaThumbnails)[getThumbnailId({ input, size })]
    if (loadedPath) return loadedPath

    return joinPath([get(tempPath), getFileName(hashCode(input), size)])

    function getFileName(path, size) {
        return `${path}-${size}.jpg`
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
    let thumbnailPath = await loadThumbnail(path, size)
    // wait if thumnail is not generated yet
    await wait(200)
    let base64Path = await toDataURL(thumbnailPath)

    // "data:image/png;base64," +
    return base64Path
}

// CACHE

const jpegQuality = 90 // 0-100
export function captureCanvas(data: any) {
    let canvas = document.createElement("canvas")

    let isImage: boolean = get(imageExtensions).includes(data.extension)
    let mediaElem: any = document.createElement(isImage ? "img" : "video")
    mediaElem.src = data.input

    mediaElem.addEventListener(isImage ? "load" : "loadeddata", async () => {
        if (!isImage) mediaElem.currentTime = mediaElem.duration * (data.seek ?? 0.5)

        let mediaSize = isImage ? { width: mediaElem.naturalWidth, height: mediaElem.naturalHeight } : { width: mediaElem.videoWidth, height: mediaElem.videoHeight }
        let newSize = getNewSize(mediaSize, data.size || {})
        canvas.width = newSize.width
        canvas.height = newSize.height

        // wait until loaded
        let hasLoaded = await waitUntilValueIsDefined(() => (isImage ? mediaElem.complete : mediaElem.readyState === 4), 20)
        if (!hasLoaded) return

        console.log(data.input, hasLoaded)

        await wait(50)
        captureCanvas(mediaElem, mediaSize)
    })

    async function captureCanvas(media, mediaSize) {
        let ctx = canvas.getContext("2d")
        if (!ctx) return

        ctx.drawImage(media, 0, 0, mediaSize.width, mediaSize.height, 0, 0, canvas.width, canvas.height)
        await wait(50)
        let dataURL = canvas.toDataURL("image/jpeg", jpegQuality)

        console.log(dataURL)

        send(MAIN, ["SAVE_IMAGE"], { path: data.output, base64: dataURL })
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
