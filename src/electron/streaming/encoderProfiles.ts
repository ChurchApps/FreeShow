export type EncoderId = "x264" | "videotoolbox" | "nvenc" | "qsv" | "amf" | "vaapi"

export const SAMPLE_RATE = 48000
export const AUDIO_CHANNELS = 2
const AUDIO_BITRATE = "128k"

// overridable for machines where the render node is not the default one
const VAAPI_DEVICE = process.env.FREESHOW_VAAPI_DEVICE || "/dev/dri/renderD128"

export interface EncoderProfile {
    id: EncoderId
    codec: string
    label: string
    hardware: boolean
    platforms: NodeJS.Platform[]
    /** pixel format the encoder wants, applied through the filter chain */
    pixelFormat: string
    /** args that must appear before the first -i */
    preInput?: string[]
    /** filter appended after the format conversion */
    filterSuffix?: string
    /** encoder specific args, placed after -c:v <codec> */
    args: (bitrate: number, gop: number) => string[]
}

const rateControl = (bitrate: number) => ["-b:v", `${bitrate}k`, "-maxrate", `${bitrate}k`, "-bufsize", `${bitrate}k`]

export const ENCODER_PROFILES: Record<EncoderId, EncoderProfile> = {
    x264: {
        id: "x264",
        codec: "libx264",
        label: "Software (x264)",
        hardware: false,
        platforms: ["darwin", "win32", "linux"],
        pixelFormat: "yuv420p",
        args: (bitrate, gop) => ["-preset", "veryfast", "-tune", "zerolatency", "-profile:v", "high", ...rateControl(bitrate), "-g", `${gop}`]
    },
    videotoolbox: {
        id: "videotoolbox",
        codec: "h264_videotoolbox",
        label: "VideoToolbox (Apple)",
        hardware: true,
        platforms: ["darwin"],
        pixelFormat: "nv12",
        // prio_speed minimizes latency; avoid -realtime 1 to prevent internal frame drops from pipe jitter
        // use the shared rateControl helper so -bufsize is set consistently for better CBR behavior
        args: (bitrate, gop) => ["-prio_speed", "1", "-allow_sw", "1", "-profile:v", "high", ...rateControl(bitrate), "-g", `${gop}`, "-rtbufsize", "100M"]
    },
    nvenc: {
        id: "nvenc",
        codec: "h264_nvenc",
        label: "NVENC (NVIDIA)",
        hardware: true,
        platforms: ["win32", "linux"],
        pixelFormat: "nv12",
        // -no-scenecut only applies with rc_lookahead > 0 and -forced-idr only with -force_key_frames,
        // neither of which are set here, so both would be silent no-ops
        args: (bitrate, gop) => ["-preset", "p4", "-tune", "ll", "-rc", "cbr", "-profile:v", "high", ...rateControl(bitrate), "-g", `${gop}`]
    },
    qsv: {
        id: "qsv",
        codec: "h264_qsv",
        label: "Quick Sync (Intel)",
        hardware: true,
        platforms: ["win32", "linux"],
        pixelFormat: "nv12",
        args: (bitrate, gop) => ["-preset", "veryfast", "-profile:v", "high", "-forced_idr", "1", "-low_delay_brc", "1", "-bf", "0", ...rateControl(bitrate), "-g", `${gop}`]
    },
    amf: {
        id: "amf",
        codec: "h264_amf",
        label: "AMF (AMD)",
        hardware: true,
        platforms: ["win32"],
        pixelFormat: "nv12",
        args: (bitrate, gop) => ["-usage", "lowlatency", "-quality", "speed", "-rc", "cbr", "-profile:v", "high", ...rateControl(bitrate), "-g", `${gop}`]
    },
    vaapi: {
        id: "vaapi",
        codec: "h264_vaapi",
        label: "VAAPI (Linux)",
        hardware: true,
        platforms: ["linux"],
        pixelFormat: "nv12",
        preInput: ["-init_hw_device", `vaapi=va:${VAAPI_DEVICE}`, "-filter_hw_device", "va"],
        filterSuffix: "hwupload",
        args: (bitrate, gop) => ["-rc_mode", "CBR", "-profile:v", "high", "-bf", "0", ...rateControl(bitrate), "-g", `${gop}`]
    }
}

export const ENCODER_IDS = Object.keys(ENCODER_PROFILES) as EncoderId[]

export function getProfile(id: EncoderId): EncoderProfile {
    return ENCODER_PROFILES[id] || ENCODER_PROFILES.x264
}

export function isSupportedOnPlatform(id: EncoderId, platform: NodeJS.Platform = process.platform): boolean {
    return getProfile(id).platforms.includes(platform)
}

/** Parse the codec ids out of `ffmpeg -hide_banner -encoders` output. */
export function parseAvailableEncoders(stdout: string): EncoderId[] {
    return ENCODER_IDS.filter((id) => {
        const codec = ENCODER_PROFILES[id].codec
        return new RegExp(`^\\s*V\\S*\\s+${codec}\\s`, "m").test(stdout)
    })
}

export function buildVideoFilter(profile: EncoderProfile, scaleTo?: { width: number; height: number }): string {
    const parts: string[] = []
    if (scaleTo) parts.push(`scale=${scaleTo.width}:${scaleTo.height}:flags=bicubic`)
    parts.push(`format=${profile.pixelFormat}`)
    if (profile.filterSuffix) parts.push(profile.filterSuffix)
    return parts.join(",")
}

export interface EncoderCommandOptions {
    encoderId: EncoderId
    /** dimensions of the raw frames arriving on stdin */
    inputWidth: number
    inputHeight: number
    /** dimensions to broadcast at; a scale filter is added only when it differs from the input */
    outputWidth: number
    outputHeight: number
    fps: number
    /** video bitrate in kbps */
    bitrate: number
    enableAudio: boolean
    sampleRate?: number
}

/** Full arg list for the encoder process: raw BGRA + PCM in, flv out on stdout. */
// Inside buildEncoderCommand in encoderProfiles.ts:

export function buildEncoderCommand(opts: EncoderCommandOptions): string[] {
    const profile = getProfile(opts.encoderId)
    const needsScale = opts.inputWidth !== opts.outputWidth || opts.inputHeight !== opts.outputHeight
    const scaleTo = needsScale ? { width: opts.outputWidth, height: opts.outputHeight } : undefined

    const args: string[] = ["-hide_banner", "-loglevel", "warning"]

    if (profile.preInput) args.push(...profile.preInput)

    // VIDEO INPUT PIPE
    args.push("-thread_queue_size", "512", "-use_wallclock_as_timestamps", "1", "-fflags", "+nobuffer", "-f", "rawvideo", "-pixel_format", "bgra", "-video_size", `${opts.inputWidth}x${opts.inputHeight}`, "-framerate", `${opts.fps}`, "-i", "pipe:0")

    if (opts.enableAudio) {
        const ar = opts.sampleRate || SAMPLE_RATE
        // AUDIO INPUT PIPE
        args.push("-thread_queue_size", "512", "-fflags", "+nobuffer", "-f", "s16le", "-ar", `${ar}`, "-ac", `${AUDIO_CHANNELS}`, "-channel_layout", "stereo", "-probesize", "32", "-analyzeduration", "0", "-i", "pipe:3")
    } else {
        args.push("-f", "lavfi", "-i", `anullsrc=channel_layout=stereo:sample_rate=${SAMPLE_RATE}`)
    }

    const baseFilter = buildVideoFilter(profile, scaleTo)
    args.push("-vf", `${baseFilter},fps=${opts.fps}`)
    // prefer passthrough fps mode and generate PTS to avoid ffmpeg inserting extra buffering
    args.push("-fps_mode", "passthrough", "-fflags", "+genpts")
    args.push("-c:v", profile.codec, ...profile.args(opts.bitrate, opts.fps * 2))

    if (opts.enableAudio) {
        args.push("-af", "aresample=async=1:max_soft_comp=10000:first_pts=0")
    }

    args.push("-c:a", "aac", "-ar", "48000", "-ac", `${AUDIO_CHANNELS}`, "-b:a", AUDIO_BITRATE)

    // SWITCH FROM MPEGTS TO FLV FOR RTMP
    // FLV is the native format for RTMP relays and YouTube ingest.
    // Setting flvflags no_sequence_end prevents stream termination artifacts.
    args.push("-max_muxing_queue_size", "4096", "-muxdelay", "0", "-muxpreload", "0", "-f", "flv", "-flvflags", "no_sequence_end", "pipe:1")

    return args
}

/** Relay process: remux the encoded mpegts straight to one RTMP destination, no re-encode. */
export function buildRelayCommand(url: string): string[] {
    return ["-hide_banner", "-loglevel", "warning", "-f", "flv", "-i", "pipe:0", "-c", "copy", "-f", "flv", url]
}

/** Short throwaway encode used to prove the encoder actually works on this machine. */
export function buildTestEncodeCommand(id: EncoderId): string[] {
    const profile = getProfile(id)
    const args: string[] = ["-hide_banner", "-loglevel", "error"]
    if (profile.preInput) args.push(...profile.preInput)
    args.push("-f", "lavfi", "-i", "color=black:s=256x144:r=30")
    args.push("-frames:v", "3")
    args.push("-vf", buildVideoFilter(profile))
    args.push("-c:v", profile.codec, ...profile.args(500, 60))
    args.push("-f", "null", "-")
    return args
}
