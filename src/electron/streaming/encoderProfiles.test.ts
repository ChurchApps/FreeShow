import { describe, expect, it } from "vitest"
import { buildEncoderCommand, buildRelayCommand, buildTestEncodeCommand, buildVideoFilter, ENCODER_IDS, getProfile, isSupportedOnPlatform, parseAvailableEncoders, type EncoderId } from "./encoderProfiles"

// real `ffmpeg -hide_banner -encoders` excerpts
const MACOS_SYSTEM_BUILD = `
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V....D libx264rgb           libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 RGB (codec h264)
 V....D h264_videotoolbox    VideoToolbox H.264 Encoder (codec h264)
 V....D hevc_videotoolbox    VideoToolbox H.265 Encoder (codec hevc)
`

const WINDOWS_GYAN_BUILD = `
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V..... h264_amf             AMD AMF H.264 Encoder (codec h264)
 V....D h264_nvenc           NVIDIA NVENC H.264 encoder (codec h264)
 V..... h264_qsv             H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (Intel Quick Sync Video acceleration) (codec h264)
`

const MINIMAL_STATIC_BUILD = `
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V....D mpeg4                MPEG-4 part 2
`

const baseOptions = {
    encoderId: "x264" as EncoderId,
    inputWidth: 1920,
    inputHeight: 1080,
    outputWidth: 1920,
    outputHeight: 1080,
    fps: 30,
    bitrate: 4000,
    enableAudio: true
}

/** find the value following a flag, e.g. arg(args, "-c:v") */
function arg(args: string[], flag: string): string | undefined {
    const i = args.indexOf(flag)
    return i === -1 ? undefined : args[i + 1]
}

describe("parseAvailableEncoders", () => {
    it("finds videotoolbox in a macOS system build", () => {
        expect(parseAvailableEncoders(MACOS_SYSTEM_BUILD).sort()).toEqual(["videotoolbox", "x264"])
    })

    it("finds all three vendor encoders in a full Windows build", () => {
        expect(parseAvailableEncoders(WINDOWS_GYAN_BUILD).sort()).toEqual(["amf", "nvenc", "qsv", "x264"])
    })

    it("finds only x264 in a minimal static build", () => {
        expect(parseAvailableEncoders(MINIMAL_STATIC_BUILD)).toEqual(["x264"])
    })

    it("does not match libx264rgb as a separate encoder", () => {
        expect(parseAvailableEncoders(" V....D libx264rgb           libx264 RGB (codec h264)")).toEqual([])
    })

    it("ignores decoders", () => {
        expect(parseAvailableEncoders(" A....D aac                  AAC (codec aac)")).toEqual([])
    })
})

describe("buildEncoderCommand", () => {
    it("keeps x264-only tuning off every hardware encoder", () => {
        for (const id of ENCODER_IDS) {
            const args = buildEncoderCommand({ ...baseOptions, encoderId: id })
            if (id === "x264") {
                expect(args).toContain("-tune")
                expect(arg(args, "-tune")).toBe("zerolatency")
            } else if (id === "nvenc") {
                // nvenc has its own -tune vocabulary
                expect(arg(args, "-tune")).toBe("ll")
            } else {
                expect(args, `${id} must not receive -tune`).not.toContain("-tune")
            }
        }
    })

    it("uses each profile's own codec", () => {
        for (const id of ENCODER_IDS) {
            const args = buildEncoderCommand({ ...baseOptions, encoderId: id })
            expect(arg(args, "-c:v")).toBe(getProfile(id).codec)
        }
    })

    it("sets GOP to two seconds", () => {
        expect(arg(buildEncoderCommand({ ...baseOptions, fps: 30 }), "-g")).toBe("60")
        expect(arg(buildEncoderCommand({ ...baseOptions, fps: 60 }), "-g")).toBe("120")
    })

    it("applies the bitrate as CBR-style rate control", () => {
        const args = buildEncoderCommand({ ...baseOptions, bitrate: 6000 })
        expect(arg(args, "-b:v")).toBe("6000k")
        expect(arg(args, "-maxrate")).toBe("6000k")
        expect(arg(args, "-bufsize")).toBe("6000k")
    })

    it("declares the real input size, not the output size", () => {
        const args = buildEncoderCommand({ ...baseOptions, inputWidth: 3840, inputHeight: 2160 })
        expect(arg(args, "-video_size")).toBe("3840x2160")
    })

    it("scales only when input and output differ", () => {
        const retina = buildEncoderCommand({ ...baseOptions, inputWidth: 3840, inputHeight: 2160 })
        expect(arg(retina, "-vf")).toContain("scale=1920:1080")

        const native = buildEncoderCommand(baseOptions)
        expect(arg(native, "-vf")).not.toContain("scale=")
    })

    it("outputs flv on stdout so relays can remux it", () => {
        const args = buildEncoderCommand(baseOptions)
        expect(arg(args, "-f")).toBe("rawvideo") // first -f is the input
        expect(args.slice(-5)).toEqual(["-f", "flv", "-flvflags", "no_sequence_end", "pipe:1"])
    })

    it("reads audio from fd 3 when enabled and synthesises silence otherwise", () => {
        expect(buildEncoderCommand({ ...baseOptions, enableAudio: true })).toContain("pipe:3")

        const muted = buildEncoderCommand({ ...baseOptions, enableAudio: false })
        expect(muted).not.toContain("pipe:3")
        expect(muted.some((a) => a.startsWith("anullsrc"))).toBe(true)
    })

    describe("vaapi", () => {
        const args = buildEncoderCommand({ ...baseOptions, encoderId: "vaapi" })

        it("initialises the hw device before the first input", () => {
            expect(args).toContain("-init_hw_device")
            expect(args.indexOf("-init_hw_device")).toBeLessThan(args.indexOf("-i"))
            expect(arg(args, "-filter_hw_device")).toBe("va")
        })

        it("uploads frames to the GPU instead of converting to yuv420p", () => {
            const filter = arg(args, "-vf")!
            expect(filter).toContain("format=nv12")
            expect(filter).toContain("hwupload")
            expect(filter).not.toContain("yuv420p")
        })
    })
})

describe("buildVideoFilter", () => {
    it("orders scale before format conversion", () => {
        expect(buildVideoFilter(getProfile("x264"), { width: 1280, height: 720 })).toBe("scale=1280:720:flags=bicubic,format=yuv420p")
    })

    it("puts hwupload last so it runs after the format conversion", () => {
        expect(buildVideoFilter(getProfile("vaapi"))).toBe("format=nv12,hwupload")
    })
})

describe("buildRelayCommand", () => {
    it("copies without re-encoding", () => {
        const args = buildRelayCommand("rtmp://a.rtmp.youtube.com/live2/KEY")
        expect(arg(args, "-c")).toBe("copy")
        expect(args).not.toContain("-c:v")
    })

    it("targets the destination as an flv output", () => {
        expect(buildRelayCommand("rtmp://x/y").slice(-3)).toEqual(["-f", "flv", "rtmp://x/y"])
    })
})

describe("buildTestEncodeCommand", () => {
    it("encodes a few frames to null with no external input", () => {
        const args = buildTestEncodeCommand("videotoolbox")
        expect(arg(args, "-frames:v")).toBe("3")
        expect(args.slice(-3)).toEqual(["-f", "null", "-"])
        expect(args).not.toContain("pipe:0")
    })

    it("exercises the same hw device setup the real encode uses", () => {
        expect(buildTestEncodeCommand("vaapi")).toContain("-init_hw_device")
    })
})

describe("isSupportedOnPlatform", () => {
    it("gates vendor encoders to the right platforms", () => {
        expect(isSupportedOnPlatform("videotoolbox", "darwin")).toBe(true)
        expect(isSupportedOnPlatform("videotoolbox", "win32")).toBe(false)
        expect(isSupportedOnPlatform("vaapi", "linux")).toBe(true)
        expect(isSupportedOnPlatform("vaapi", "darwin")).toBe(false)
        expect(isSupportedOnPlatform("amf", "win32")).toBe(true)
        expect(isSupportedOnPlatform("amf", "linux")).toBe(false)
    })

    it("allows x264 everywhere", () => {
        for (const platform of ["darwin", "win32", "linux"] as NodeJS.Platform[]) {
            expect(isSupportedOnPlatform("x264", platform)).toBe(true)
        }
    })
})
