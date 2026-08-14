import fs from "fs"
import os from "os"
import path from "path"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeshow-whisper-test-"))

// whisperManager imports electron for app.getPath("userData")
vi.mock("electron", () => ({
    app: { getPath: () => tempRoot }
}))

import { findExecutableInPath, getModelPath, isModelReady, verifyWhisperBinary, WHISPER_MODELS } from "./manager"

// download/cancel/checksum behavior moved to the setup layer - covered by src/electron/ai/setup tests

afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true })
})

describe("WHISPER_MODELS", () => {
    it("includes every model the setup popup offers, so downloaded state is reported for all of them", () => {
        for (const id of ["tiny", "tiny.en", "base", "base.en", "small", "small.en", "medium", "medium.en", "large-v3"]) {
            expect(WHISPER_MODELS).toContain(id)
        }
    })
})

describe("model id validation", () => {
    it("getModelPath returns a path inside the models dir for known ids", () => {
        const modelPath = getModelPath("large-v3")
        expect(modelPath).toBe(path.join(tempRoot, "bin", "whisper", "models", "ggml-large-v3.bin"))
    })

    it("getModelPath throws on unknown / path traversal ids", () => {
        expect(() => getModelPath("../../../evil")).toThrow()
        expect(() => getModelPath("huge")).toThrow()
    })

    it("isModelReady returns false for unknown ids instead of touching the filesystem", () => {
        expect(isModelReady("../../../evil")).toBe(false)
    })
})

describe("verifyWhisperBinary", () => {
    it("returns false for empty or nonexistent paths", async () => {
        expect(await verifyWhisperBinary("")).toBe(false)
        expect(await verifyWhisperBinary(path.join(tempRoot, "missing-binary"))).toBe(false)
    })

    it("returns true for an executable that exits 0 on --help", async () => {
        expect(await verifyWhisperBinary(process.execPath)).toBe(true)
    })
})

describe("findExecutableInPath", () => {
    const binDir = path.join(tempRoot, "path-probe-bin")
    const originalPath = process.env.PATH

    beforeAll(() => {
        fs.mkdirSync(binDir, { recursive: true })
        fs.writeFileSync(path.join(binDir, "whisper-cli"), "#!/bin/sh\nexit 0\n", { mode: 0o755 })
    })

    afterAll(() => {
        process.env.PATH = originalPath
    })

    it("resolves a bare name to an absolute path from PATH entries", () => {
        process.env.PATH = ["", "relative/dir", binDir].join(path.delimiter)
        const resolved = findExecutableInPath("whisper-cli")
        expect(resolved).toBe(path.join(binDir, "whisper-cli"))
        expect(resolved && path.isAbsolute(resolved)).toBe(true)
    })

    it("returns null when the name is not found or PATH only has relative entries", () => {
        process.env.PATH = ["", "relative/dir", binDir].join(path.delimiter)
        expect(findExecutableInPath("whisper-cpp", [])).toBe(null)

        process.env.PATH = "relative/dir"
        expect(findExecutableInPath("whisper-cli", [])).toBe(null)
    })

    it("finds executables in well known install dirs even when they are missing from PATH", () => {
        process.env.PATH = "relative/dir"
        expect(findExecutableInPath("whisper-cli", [binDir])).toBe(path.join(binDir, "whisper-cli"))
    })
})
