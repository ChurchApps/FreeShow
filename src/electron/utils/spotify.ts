import { ChildProcess, exec, fork } from "child_process"
import os from "os"
import type { SpotifyState } from "../../types/Main"

// ----- BRIDGE LOGIC (Windows only) -----
if (process.env.SPOTIFY_BRIDGE === "true") {
    const { SpotifyClient } = require("libspotifyctl")
    let client: any = null

    process.on("message", (msg: any) => {
        try {
            if (msg.type === "init") {
                ;(client = new SpotifyClient()).start()
                process.send?.({ type: "ready" })
            } else if (msg.type === "getState") {
                const s = client?.latestState()
                if (s) {
                    if (s.albumArt?.length) s.albumArtBase64 = `data:image/jpeg;base64,${s.albumArt.toString("base64")}`
                    delete s.albumArt
                    s.positionMs = client.positionSmoothMs
                    s.appVolume = client.appVolume
                }
                process.send?.({ type: "state", state: s })
            } else if (msg.type === "command" && client) {
                const { command: c, value: v } = msg
                if (c === "playpause") client.latestState().statusName === "PLAYING" ? client.pause() : client.play()
                else if (c === "next") client.next()
                else if (c === "prev") client.previous()
                else if (c === "seek") client.seekMs(v * 1000)
                else if (c === "setVolume") client.appVolume = v
                else if (c === "pause") client.pause()
            }
        } catch (e: any) {
            process.send?.({ type: "error", error: e.message })
        }
    })
}

// ----- CLIENT LOGIC (Main Process) -----
const isMac = os.platform() === "darwin",
    isWin = os.platform() === "win32"
let bridge: ChildProcess | null = null,
    initialized = false,
    pending: ((s: SpotifyState | null) => void) | null = null

export function initSpotify() {
    if (initialized || !isWin) return
    initialized = true
    try {
        bridge = fork(__filename, [], { env: { ...process.env, SPOTIFY_BRIDGE: "true" }, stdio: ["ignore", "inherit", "inherit", "ipc"] })
        bridge
            .on("message", (msg: any) => {
                if (msg.type === "state" && pending) {
                    const r = msg.state
                    pending(r?.title ? { isPlaying: r.statusName === "PLAYING", title: r.title, artist: r.artist, albumArt: r.albumArtBase64, positionSec: (r.positionMs || 0) / 1000, durationSec: (r.durationMs || 0) / 1000, volume: r.appVolume ?? 1, platform: "win32" } : null)
                    pending = null
                } else if (msg.type === "error") console.error("[Spotify] Bridge error:", msg.error)
            })
            .on("exit", () => {
                initialized = false
                bridge = null
            })
            .send({ type: "init" })
    } catch (e) {
        console.error("[Spotify] Failed to start bridge:", e)
    }
}

const macScript = (c?: string) => `tell application "Spotify"
    ${
        c ||
        `if running then
        set isP to player state is playing
        set t to name of current track
        set a to artist of current track
        set d to (duration of current track) / 1000
        set p to player position
        set art to artwork url of current track
        set v to sound volume
        return (isP as text) & "|SEC|" & t & "|SEC|" & a & "|SEC|" & p & "|SEC|" & d & "|SEC|" & art & "|SEC|" & v
    else
        return "NOT_RUNNING"
    end if`
    }
end tell`

export async function getSpotifyState(): Promise<SpotifyState | null> {
    if (isMac)
        return new Promise((res) =>
            exec(`osascript -e '${macScript().replace(/'/g, "'\\''")}'`, (e, out) => {
                const p = out?.trim().split("|SEC|")
                res(e || out.includes("NOT_RUNNING") || p.length < 5 ? null : { isPlaying: p[0] === "true", title: p[1], artist: p[2], positionSec: parseFloat(p[3]) || 0, durationSec: parseFloat(p[4]) || 0, albumArt: p[5] || undefined, volume: (parseInt(p[6]) || 0) / 100, platform: "darwin" })
            })
        )
    if (isWin) {
        if (!initialized) initSpotify()
        if (!bridge?.connected) return null
        return new Promise((res) => {
            pending?.(null)
            pending = res
            bridge?.send({ type: "getState" })
            setTimeout(() => pending === res && (pending(null), (pending = null)), 500)
        })
    }
    return null
}

export async function executeSpotifyCommand(cmd: string, val?: number): Promise<void> {
    if (isMac) {
        const scripts: any = { playpause: "playpause", next: "next track", prev: "previous track", seek: `set player position to ${val}`, setVolume: `set sound volume to ${Math.round(val! * 100)}`, pause: "pause" }
        if (scripts[cmd]) exec(`osascript -e '${macScript(scripts[cmd]).replace(/'/g, "'\\''")}'`)
    } else if (isWin && bridge?.connected) bridge.send({ type: "command", command: cmd, value: val })
    else if (isWin) {
        initSpotify()
        setTimeout(() => bridge?.send({ type: "command", command: cmd, value: val }), 500)
    }
}
