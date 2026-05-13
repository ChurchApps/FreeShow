import { get, writable } from "svelte/store"
import { Main } from "../../../../types/IPC/Main"
import type { SpotifyState } from "../../../../types/Main"
import { requestMain } from "../../../IPC/main"

export const spotifyState = writable<SpotifyState | null>(null)
export const spotifyIsFading = writable(false)

let fetchInt: any
let progressInt: any
let fetching = false
let lastFetched: SpotifyState | null = null
let lock = 0
let lastArt: string | null = null

export function initSpotifyManager() {
    let currentInterval = 1000
    let lastUsed = Date.now()
    spotifyState.subscribe((s) => {
        if (s && (s.isPlaying || s.positionSec > 0)) lastUsed = Date.now()
    })

    function scheduleFetch(interval: number) {
        clearInterval(fetchInt)
        fetchInt = setInterval(checkAndFetch, interval)
        currentInterval = interval
    }
    function checkAndFetch() {
        fetchState()
        // if used recently (less than 5 mins ago)
        const interval = Date.now() - lastUsed < 300000 ? 1000 : 3000
        if (interval !== currentInterval) scheduleFetch(interval)
    }

    scheduleFetch(1000)

    progressInt = setInterval(() => {
        spotifyState.update((s) => (s?.isPlaying && s.positionSec < s.durationSec ? { ...s, positionSec: s.positionSec + 0.05 } : s))
    }, 50)
}

export function destroySpotifyManager() {
    clearInterval(fetchInt)
    clearInterval(progressInt)
}

async function fetchState() {
    if (fetching) return
    fetching = true
    try {
        const res = await requestMain(Main.SPOTIFY_GET_STATE)
        if (!res) {
            spotifyState.set(null)
            lastFetched = lastArt = null
            return
        }

        spotifyState.update((curr) => {
            let newState = res as SpotifyState
            if (curr && lastFetched && res.title === curr.title) {
                const diff = Math.abs(res.positionSec - curr.positionSec)
                if (Date.now() < lock) res.isPlaying = curr.isPlaying
                if (diff < 1.5 && res.isPlaying === curr.isPlaying) {
                    newState = { ...curr, isPlaying: res.isPlaying, durationSec: res.durationSec, volume: res.volume }
                }
            }

            if (newState.albumArt && newState.albumArt !== lastArt) {
                lastArt = newState.albumArt
                extractColor(newState.albumArt)
            } else if (!newState.albumArt) newState.bgColor = "transparent"
            else if (curr) newState.bgColor = curr.bgColor

            return newState
        })
        lastFetched = res
    } catch (e) {
        console.error(e)
    } finally {
        fetching = false
    }
}

async function extractColor(url: string) {
    const img = new Image()
    img.crossOrigin = "Anonymous"
    img.src = url
    img.onload = () => {
        const canvas = document.createElement("canvas"),
            ctx = canvas.getContext("2d")
        if (!ctx) return
        canvas.width = canvas.height = 10
        ctx.drawImage(img, 0, 0, 10, 10)
        const data = ctx.getImageData(0, 0, 10, 10).data
        let best = { r: 0, g: 0, b: 0, score: -1 }

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i],
                g = data[i + 1],
                b = data[i + 2]
            const { s, l } = rgbToHsl(r, g, b)
            let score = s * (1 - Math.abs(l - 0.5) * 2)
            if (l < 0.2 || l > 0.8) score *= 0.1
            if (score > best.score) best = { r, g, b, score }
        }

        const color = best.score < 0.1 ? (ctx.drawImage(img, 0, 0, 1, 1), ctx.getImageData(0, 0, 1, 1).data) : [best.r, best.g, best.b]
        spotifyState.update((s) => (s ? { ...s, bgColor: `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.2)` } : s))
    }
}

function rgbToHsl(r: number, g: number, b: number) {
    r /= 255
    g /= 255
    b /= 255
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        l = (max + min) / 2
    let h = 0,
        s = 0
    if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
        else if (max === g) h = (b - r) / d + 2
        else h = (r - g) / d + 4
        h /= 6
    }
    return { h, s, l }
}

const runCmd = async (command: string, value?: number) => {
    await requestMain(Main.SPOTIFY_COMMAND, { command, value } as any)
}

export const togglePlay = async () => {
    spotifyState.update((s) => (s ? ((lock = Date.now() + 2000), { ...s, isPlaying: !s.isPlaying }) : s))
    await runCmd("playpause")
}

export function spotifyPlay() {
    if (get(spotifyState)?.isPlaying) return
    spotifyState.update((s) => (s ? ((lock = Date.now() + 2000), { ...s, isPlaying: true }) : s))
    return runCmd("playpause")
}
export function spotifyPause() {
    if (!get(spotifyState)?.isPlaying) return
    spotifyState.update((s) => (s ? ((lock = Date.now() + 2000), { ...s, isPlaying: false }) : s))
    return runCmd("playpause")
}

const skip = async (command: string) => {
    spotifyState.update((s) => (s ? ((lock = Date.now() + 2000), { ...s, positionSec: 0, isPlaying: true }) : s))
    await runCmd(command)
    setTimeout(fetchState, 500)
}

export const skipNext = () => skip("next")
export const skipPrev = () => skip("prev")

export async function seekTo(pos: number) {
    spotifyState.update((s) => (s ? { ...s, positionSec: pos } : s))
    await runCmd("seek", pos)
    setTimeout(fetchState, 300)
}

export async function fadePause() {
    if (get(spotifyIsFading)) return
    spotifyIsFading.set(true)

    let startVol = get(spotifyState)?.volume || 1
    const fresh = await requestMain(Main.SPOTIFY_GET_STATE)
    if (fresh) {
        if (!fresh.isPlaying) return spotifyIsFading.set(false)
        startVol = fresh.volume
    }

    const steps = 20,
        duration = 3000
    for (let i = 1; i <= steps; i++) {
        await runCmd("setVolume", Math.max(0, startVol - (startVol / steps) * i))
        await new Promise((r) => setTimeout(r, duration / steps))
    }

    await runCmd("pause")
    await new Promise((r) => setTimeout(r, 500))
    await runCmd("setVolume", startVol)
    spotifyIsFading.set(false)
}
