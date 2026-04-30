import { ChildProcess, exec, fork } from "child_process"
import os from "os"
import type { SpotifyState } from "../../types/Main"

// ----- BRIDGE LOGIC (Windows only) -----
if (process.env.SPOTIFY_BRIDGE === "true") {
    let client: any = null

    process.on("message", (msg: any) => {
        try {
            if (msg.type === "init") {
                try {
                    const isProd = process.env.NODE_ENV === "production" || !/[\\/]electron/.exec(process.execPath)
                    const mPath = isProd ? require("path").join(process.resourcesPath, "app.asar.unpacked/node_modules/libspotifyctl") : "libspotifyctl"
                    client = new (require(mPath).SpotifyClient)()
                    client.start()
                    process.send?.({ type: "ready" })
                } catch (e: any) {
                    process.send?.({ type: "error", error: `Failed to load libspotifyctl: ${e.message}` })
                }
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
const isMac = os.platform() === "darwin"
const isWin = os.platform() === "win32"
const isLinux = os.platform() === "linux"
let bridge: ChildProcess | null = null
let initialized = false
let pending: ((s: SpotifyState | null) => void) | null = null

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
    try {
        if (isMac)
            return new Promise((res) =>
                exec(`osascript -e '${macScript().replace(/'/g, "'\\''")}'`, (e, out) => {
                    if (e && !out.includes("NOT_RUNNING")) console.error("[Spotify] Mac error:", e)
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
        if (isLinux) {
            return new Promise((res) => {
                const dbus = "dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties.Get string:'org.mpris.MediaPlayer2.Player'"
                exec(`${dbus} string:'Metadata' && ${dbus} string:'PlaybackStatus' && ${dbus} string:'Position' && ${dbus} string:'Volume'`, (e, out) => {
                    if (e) {
                        if (!out.includes("org.mpris.MediaPlayer2.spotify")) console.error("[Spotify] Linux error:", e)
                        return res(null)
                    }
                    const title = out.match(/string\s+"xesam:title"\s+variant\s+string\s+"([^"]+)"/)?.[1]
                    const artist = out.match(/string\s+"xesam:artist"\s+variant\s+array\s+\[\s+string\s+"([^"]+)"/)?.[1]
                    const len = parseInt(out.match(/string\s+"mpris:length"\s+variant\s+uint64\s+(\d+)/)?.[1] || "0")
                    const art = out.match(/string\s+"mpris:artUrl"\s+variant\s+string\s+"([^"]+)"/)?.[1]
                    const pos = parseInt(out.match(/uint64\s+(\d+)/)?.[1] || "0")
                    const vol = parseFloat(out.match(/double\s+([\d.]+)/)?.[1] || "1")
                    res(title ? { isPlaying: out.includes("Playing"), title, artist: artist || "Unknown", positionSec: pos / 1000000, durationSec: len / 1000000, albumArt: art, volume: vol, platform: "linux" } : null)
                })
            })
        }
    } catch (e) {
        console.error("[Spotify] State error:", e)
    }
    return null
}

export async function executeSpotifyCommand(cmd: string, val?: number): Promise<void> {
    try {
        if (isMac) {
            const scripts: any = { playpause: "playpause", next: "next track", prev: "previous track", seek: `set player position to ${val}`, setVolume: `set sound volume to ${Math.round(val! * 100)}`, pause: "pause" }
            if (scripts[cmd]) exec(`osascript -e '${macScript(scripts[cmd]).replace(/'/g, "'\\''")}'`, (e) => e && console.error("[Spotify] Mac command error:", e))
        } else if (isWin && bridge?.connected) bridge.send({ type: "command", command: cmd, value: val })
        else if (isWin) {
            initSpotify()
            setTimeout(() => bridge?.send({ type: "command", command: cmd, value: val }), 500)
        } else if (isLinux) {
            const dest = "--dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2",
                mpris = "org.mpris.MediaPlayer2.Player"
            const run = (c: string) => exec(`dbus-send ${dest} ${c}`, (e) => e && console.error("[Spotify] Linux command error:", e))
            if (cmd === "playpause") run(`${mpris}.PlayPause`)
            else if (cmd === "next") run(`${mpris}.Next`)
            else if (cmd === "prev") run(`${mpris}.Previous`)
            else if (cmd === "pause") run(`${mpris}.Pause`)
            else if (cmd === "setVolume" && val !== undefined) run(`org.freedesktop.DBus.Properties.Set string:${mpris} string:'Volume' variant:double:${val}`)
            else if (cmd === "seek" && val !== undefined) {
                exec(`dbus-send --print-reply ${dest} org.freedesktop.DBus.Properties.Get string:${mpris} string:'Metadata'`, (e, out) => {
                    if (e) return console.error("[Spotify] Linux seek error:", e)
                    const id = out?.match(/string\s+"mpris:trackid"\s+variant\s+string\s+"([^"]+)"/)?.[1]
                    if (id) run(`${mpris}.SetPosition objpath:${id} x64:${Math.round(val * 1000000)}`)
                })
            }
        }
    } catch (e) {
        console.error("[Spotify] Command error:", e)
    }
}
