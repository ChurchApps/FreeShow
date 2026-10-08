import fs from "fs"
import os from "os"
import path from "path"
import { promisify } from "util"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ cbrSupported: false, hardwareSupported: true, softwareSupported: true, userData: "" }))
vi.mock("electron", () => ({ app: { getPath: () => state.userData } }))
vi.mock("../data/store", () => ({ config: { get: () => false } }))
vi.mock("./ffmpegManager", () => ({ resolveFfmpegPath: async () => "test-ffmpeg" }))
vi.mock("./encoderProfiles", async (importOriginal) => {
    const profiles = await importOriginal<typeof import("./encoderProfiles")>()
    return { ...profiles, isSupportedOnPlatform: (id: import("./encoderProfiles").EncoderId) => profiles.isSupportedOnPlatform(id, "darwin") }
})
vi.mock("child_process", () => {
    const execFile = Object.assign(vi.fn(), {
        [promisify.custom]: async (_file: string, args: string[]) => {
            if (args.includes("-encoders")) return { stdout: " V....D libx264 H.264\n V....D h264_videotoolbox Apple H.264", stderr: "" }
            if (args.includes("h264_videotoolbox") && !state.hardwareSupported) throw { stderr: "Hardware encoder unavailable" }
            if (args.includes("h264_videotoolbox") && args.includes("-constant_bit_rate") && !state.cbrSupported) throw { stderr: "Constant bitrate is not supported" }
            if (args.includes("libx264") && !state.softwareSupported) throw { stderr: "Software encoder failed" }
            return { stdout: "", stderr: "" }
        }
    })
    return { execFile }
})

const { detectEncoders, resolveEncoder } = await import("./encoderDetection")
state.userData = fs.mkdtempSync(path.join(os.tmpdir(), "freeshow-cbr-detection-"))
afterAll(() => fs.rmSync(state.userData, { recursive: true, force: true }))
beforeEach(async () => {
    state.cbrSupported = false
    state.hardwareSupported = true
    state.softwareSupported = true
    await detectEncoders(true)
})

describe("CBR encoder capability", () => {
    it("keeps Apple available for legacy/VBR when only CBR fails", async () => {
        const detection = await detectEncoders()
        const apple = detection.encoders.find((e) => e.id === "videotoolbox")
        expect(apple?.available).toBe(true)
        expect(apple?.cbrSupported).toBe(false)
        expect(await resolveEncoder("videotoolbox", "vbr")).toBe("videotoolbox")
        expect(await resolveEncoder("videotoolbox")).toBe("videotoolbox")
    })
    it("rejects an explicit encoder that cannot do CBR instead of switching to software", async () => {
        await expect(resolveEncoder("videotoolbox", "cbr")).rejects.toThrow("does not support CBR")
    })
    it("rejects an explicitly selected encoder that is unavailable", async () => {
        state.hardwareSupported = false
        await detectEncoders(true)
        await expect(resolveEncoder("videotoolbox", "vbr")).rejects.toThrow("unavailable")
    })
    it("also applies CBR fallback to Auto", async () => {
        expect(await resolveEncoder("auto", "cbr")).toBe("x264")
    })
    it("uses Apple CBR when a real CBR probe succeeds", async () => {
        state.cbrSupported = true
        await detectEncoders(true)
        expect(await resolveEncoder("videotoolbox", "cbr")).toBe("videotoolbox")
    })
})
