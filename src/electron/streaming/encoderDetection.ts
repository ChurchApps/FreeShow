import { execFile } from "child_process"
import { app } from "electron"
import fs from "fs"
import path from "path"
import { promisify } from "util"
import { config } from "../data/store"
import { buildTestEncodeCommand, ENCODER_PROFILES, isSupportedOnPlatform, parseAvailableEncoders, type EncoderId } from "./encoderProfiles"
import { resolveFfmpegPath } from "./ffmpegManager"

const execFileAsync = promisify(execFile)

const TEST_ENCODE_TIMEOUT_MS = 5000
const CACHE_VERSION = 1

export interface EncoderStatus {
    id: EncoderId
    label: string
    hardware: boolean
    available: boolean
    /** why it is unavailable, shown in the settings dropdown */
    reason?: string
}

export interface EncoderDetection {
    encoders: EncoderStatus[]
    /** best available hardware encoder, or "x264" when there is none */
    recommended: EncoderId
}

interface CacheFile {
    version: number
    key: string
    detection: EncoderDetection
}

function cachePath(): string {
    return path.join(app.getPath("userData"), "encoder-detection.json")
}

function cacheKey(ffmpegPath: string): string {
    let mtime = 0
    try {
        mtime = fs.statSync(ffmpegPath).mtimeMs
    } catch {
        // "ffmpeg" on PATH is not stat-able from here; the path string alone is enough
    }
    return `${CACHE_VERSION}|${ffmpegPath}|${mtime}|${process.platform}|${process.arch}`
}

function readCache(key: string): EncoderDetection | null {
    try {
        const parsed: CacheFile = JSON.parse(fs.readFileSync(cachePath(), "utf8"))
        if (parsed.version !== CACHE_VERSION || parsed.key !== key) return null
        return parsed.detection
    } catch {
        return null
    }
}

function writeCache(key: string, detection: EncoderDetection) {
    try {
        fs.writeFileSync(cachePath(), JSON.stringify({ version: CACHE_VERSION, key, detection } satisfies CacheFile))
    } catch (err) {
        console.warn("[encoderDetection] Could not persist detection cache:", err)
    }
}

function firstErrorLine(err: any): string {
    const stderr: string = err?.stderr || ""
    const line = stderr
        .split("\n")
        .map((l: string) => l.trim())
        .find((l: string) => l.length > 0)
    if (line) return line.slice(0, 200)
    if (err?.killed) return "Timed out"
    return err?.message?.slice(0, 200) || "Test encode failed"
}

/** Stage 2: a listed encoder still fails when the GPU or driver is missing, so actually encode a few frames. */
async function testEncode(ffmpegPath: string, id: EncoderId): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
        await execFileAsync(ffmpegPath, buildTestEncodeCommand(id), { timeout: TEST_ENCODE_TIMEOUT_MS, windowsHide: true })
        return { ok: true }
    } catch (err) {
        return { ok: false, reason: firstErrorLine(err) }
    }
}

async function probe(ffmpegPath: string): Promise<EncoderDetection> {
    let listed: EncoderId[] = []
    try {
        const { stdout } = await execFileAsync(ffmpegPath, ["-hide_banner", "-encoders"], { timeout: TEST_ENCODE_TIMEOUT_MS, windowsHide: true, maxBuffer: 4 * 1024 * 1024 })
        listed = parseAvailableEncoders(stdout)
    } catch (err) {
        console.warn("[encoderDetection] Could not list encoders:", err)
    }

    const encoders: EncoderStatus[] = []
    for (const profile of Object.values(ENCODER_PROFILES)) {
        const base = { id: profile.id, label: profile.label, hardware: profile.hardware }

        if (!isSupportedOnPlatform(profile.id)) {
            // no need to add unsupported encoders to the list
            // encoders.push({ ...base, available: false, reason: "Not available on this platform" })
            continue
        }
        if (!listed.includes(profile.id)) {
            encoders.push({ ...base, available: false, reason: "Not included in this FFmpeg build" })
            continue
        }

        const result = await testEncode(ffmpegPath, profile.id)
        if (result.ok) encoders.push({ ...base, available: true })
        else encoders.push({ ...base, available: false, reason: result.reason })
    }

    const recommended = encoders.find((e) => e.hardware && e.available)?.id || "x264"
    return { encoders, recommended }
}

const UNAVAILABLE: EncoderDetection = {
    encoders: Object.values(ENCODER_PROFILES).map((p) => ({ id: p.id, label: p.label, hardware: p.hardware, available: false, reason: "FFmpeg not installed" })),
    recommended: "x264"
}

let inFlight: Promise<EncoderDetection> | null = null

export async function detectEncoders(force = false): Promise<EncoderDetection> {
    // a forced re-detect must not be satisfied by a probe that is already running against the cache
    if (inFlight && !force) return inFlight

    inFlight = (async () => {
        const ffmpegPath = await resolveFfmpegPath()
        if (!ffmpegPath) return UNAVAILABLE

        const key = cacheKey(ffmpegPath)
        if (!force) {
            const cached = readCache(key)
            if (cached) return cached
        }

        const detection = await probe(ffmpegPath)
        writeCache(key, detection)
        console.info(
            "[encoderDetection] Available encoders:",
            detection.encoders
                .filter((e) => e.available)
                .map((e) => e.id)
                .join(", ") || "none"
        )
        return detection
    })()

    try {
        return await inFlight
    } finally {
        inFlight = null
    }
}

// global setting, pushed from the renderer on startup and whenever it changes
let rtmpEncoderSetting = "auto"

export function setRtmpEncoderSetting(encoder: string) {
    rtmpEncoderSetting = encoder || "auto"
}

export function getRtmpEncoderSetting(): string {
    return rtmpEncoderSetting
}

/** Resolve the configured setting ("auto" or an explicit id) to an encoder that actually works. */
export async function resolveEncoder(setting: string | undefined): Promise<EncoderId> {
    // respect the app's "disable hardware acceleration" setting (Settings > Other) when resolving "auto":
    // use software x264 instead of a hardware encoder. An explicitly chosen encoder still wins.
    if (!setting || setting === "auto") {
        try {
            if (config.get("disableHardwareAcceleration") === true) {
                console.info("[encoderDetection] hardware acceleration disabled in settings; using software x264")
                return "x264"
            }
        } catch {
            // ignore
        }
    }

    const detection = await detectEncoders()
    if (!setting || setting === "auto") return detection.recommended

    const match = detection.encoders.find((e) => e.id === setting)
    if (match?.available) return match.id as EncoderId

    console.warn(`[encoderDetection] Encoder "${setting}" is unavailable (${match?.reason || "unknown"}), falling back to x264`)
    return "x264"
}
