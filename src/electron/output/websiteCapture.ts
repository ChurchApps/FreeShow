// Renders a website in an offscreen BrowserWindow and mirrors frames to outputs & preview.
// Keyboard and mouse inputs are sent from the frontend preview to the offscreen window.

import { BrowserWindow } from "electron"
import fs from "fs"
import path from "path"
import { getMainWindow } from ".."
import { OUTPUT } from "../../types/Channels"
import { getThumbnailFolderPath } from "../data/thumbnails"
import { OutputHelper } from "./OutputHelper"

const FRAME_INTERVAL = 1000 / 30 // max ~30 fps
const JPEG_QUALITY = 92

interface CaptureEntry {
    win: BrowserWindow
    homeUrl: string
    lastFrame: number
    cachedFrame: Buffer | null
    sendNav: () => void
}

const active = new Map<string, CaptureEntry>()

function sendToMain(channel: string, data: any) {
    const main = getMainWindow()
    if (main && !main.isDestroyed()) main.webContents.send(OUTPUT, { channel, data })
}

function broadcastFrame(websiteId: string, frame: Buffer) {
    const msg = { channel: "WEBSITE_FRAME", data: { websiteId, frame } }
    OutputHelper.getAllOutputs().forEach((output) => OutputHelper.Send.sendToWindow(output.id, msg))
    sendToMain("WEBSITE_FRAME", msg.data)
}

function createOffscreenWindow(width: number, height: number) {
    const win = new BrowserWindow({
        width,
        height,
        show: false,
        frame: false,
        useContentSize: true,
        enableLargerThanScreen: true,
        webPreferences: { offscreen: true, backgroundThrottling: false }
    })
    win.setContentSize(width, height)
    return win
}

export function setWebsiteCapture(data: { id: string; action: "start" | "stop" | "input" | "nav" | "zoom" | "thumbnail" | "sync"; url?: string; width?: number; height?: number; input?: any; nav?: "back" | "forward" | "reload" | "home"; zoom?: number }) {
    const { id, action } = data
    const entry = active.get(id)
    const win = entry && !entry.win.isDestroyed() ? entry.win : null

    if (action === "sync") {
        if (entry?.cachedFrame) broadcastFrame(id, entry.cachedFrame)
        else if (!win && data.url) setWebsiteCapture({ ...data, action: "start" })
        return
    }
    if (action === "thumbnail") return data.url && captureThumbnail(id, data.url)
    if (action === "stop") return stopCapture(id)
    if (action === "zoom") return win && data.zoom && win.webContents.setZoomFactor(data.zoom)
    if (action === "input") return win && data.input && win.webContents.sendInputEvent(data.input)

    if (action === "nav") {
        if (!entry || !win) return

        const history = win.webContents.navigationHistory
        if (data.nav === "back") history.goBack()
        else if (data.nav === "forward") history.goForward()
        else if (data.nav === "reload") win.webContents.reload()
        else if (data.nav === "home") {
            win.loadURL(entry.homeUrl)
                .then(() => {
                    if (win.isDestroyed()) return
                    history.clear()
                    entry.sendNav()
                })
                .catch((err) => console.error("Website load failed:", err))
        }
        return
    }

    // action === "start"
    if (!data.url) return
    const width = Math.max(320, Math.round(data.width || 1920))
    const height = Math.max(180, Math.round(data.height || 1080))

    // Reuse existing offscreen window so leaving and returning to the preview keeps its state
    if (entry && win && entry.homeUrl === data.url) {
        const [curW, curH] = win.getContentSize()
        if (curW !== width || curH !== height) win.setContentSize(width, height)
        entry.sendNav()
        if (entry.cachedFrame) broadcastFrame(id, entry.cachedFrame)
        return
    }

    stopCapture(id)

    const newWin = createOffscreenWindow(width, height)
    const sendNav = () => {
        if (newWin.isDestroyed()) return

        const history = newWin.webContents.navigationHistory
        sendToMain("WEBSITE_NAV", { websiteId: id, url: newWin.webContents.getURL(), canGoBack: history.canGoBack(), canGoForward: history.canGoForward() })
    }

    const newEntry: CaptureEntry = { win: newWin, homeUrl: data.url, lastFrame: 0, cachedFrame: null, sendNav }
    active.set(id, newEntry)

    newWin.webContents.setFrameRate(30)
    newWin.webContents.on("paint", (_event, _dirty, image) => {
        const now = Date.now()
        if (now - newEntry.lastFrame < FRAME_INTERVAL || image.isEmpty()) return
        newEntry.lastFrame = now

        newEntry.cachedFrame = image.toJPEG(JPEG_QUALITY)
        broadcastFrame(id, newEntry.cachedFrame)
    })

    newWin.webContents.once("dom-ready", () => {
        if (!newWin.isDestroyed()) newWin.webContents.setZoomFactor(1)
    })
    newWin.webContents.on("did-navigate", sendNav)
    newWin.webContents.on("did-navigate-in-page", sendNav)
    newWin.on("closed", () => {
        if (active.get(id)?.win === newWin) active.delete(id)
    })

    newWin.loadURL(data.url).catch((err) => console.error("Website load failed:", err))
}

function stopCapture(id: string) {
    const current = active.get(id)
    if (!current) return

    active.delete(id)
    if (!current.win.isDestroyed()) current.win.destroy()
}

function captureThumbnail(id: string, rawUrl: string) {
    const url = /^[a-z]+:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : "https://" + rawUrl.trim()
    const win = createOffscreenWindow(1280, 720)

    let done = false
    const finish = () => {
        if (done) return
        done = true

        clearTimeout(timeout)
        if (!win.isDestroyed()) win.destroy()
    }
    const timeout = setTimeout(finish, 15000)

    win.webContents.once("did-finish-load", () => {
        win.webContents.insertCSS("::-webkit-scrollbar { display: none !important; }").catch(() => {})
        setTimeout(async () => {
            if (done || win.isDestroyed()) return

            try {
                const image = await win.webContents.capturePage()
                if (!image.isEmpty()) {
                    const folder = getThumbnailFolderPath()
                    fs.mkdirSync(folder, { recursive: true })
                    const thumbPath = path.join(folder, `website_${id}.jpg`)
                    fs.writeFileSync(thumbPath, image.resize({ width: 480 }).toJPEG(85))
                    sendToMain("WEBSITE_THUMBNAIL", { websiteId: id, path: thumbPath, updated: Date.now(), title: win.webContents.getTitle() })
                }
            } catch (err) {
                console.error("Website thumbnail capture failed:", err)
            }
            finish()
        }, 800)
    })

    win.loadURL(url).catch(() => finish())
}
