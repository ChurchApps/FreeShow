import crypto from "crypto"
import fs from "fs"
import os from "os"
import path from "path"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeshow-whisper-test-"))

// whisperManager imports electron for app.getPath("userData") and IPC/main for sendToMain (which pulls in the whole main process)
vi.mock("electron", () => ({
    app: { getPath: () => tempRoot },
    // delegate to the (stubbable) global fetch so tests can control network behavior
    net: { fetch: (...args: any[]) => (globalThis.fetch as any)(...args) }
}))
vi.mock("../../../IPC/main", () => ({
    sendToMain: vi.fn()
}))

import { sendToMain } from "../../../IPC/main"
import type { WhisperModelId } from "../../../../types/ai/AiScripture"
import { ToMain } from "../../../../types/IPC/ToMain"
import { cancelWhisperDownload, computeFileSha256, downloadWhisperModel, findExecutableInPath, getModelPath, isModelReady, verifyWhisperBinary, WHISPER_MODELS } from "./manager"

afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true })
})

afterEach(() => {
    vi.mocked(sendToMain).mockClear()
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
        expect(() => getModelPath("../../../evil" as WhisperModelId)).toThrow()
        expect(() => getModelPath("huge" as WhisperModelId)).toThrow()
    })

    it("isModelReady returns false for unknown ids instead of touching the filesystem", () => {
        expect(isModelReady("../../../evil" as WhisperModelId)).toBe(false)
    })

    it("downloadWhisperModel rejects unknown ids before any network request", async () => {
        const fetchSpy = vi.fn()
        vi.stubGlobal("fetch", fetchSpy)
        try {
            const result = await downloadWhisperModel("../../../../foo/attacker-repo/resolve/main/payload" as WhisperModelId)
            expect(result.ok).toBe(false)
            expect(result.error).toContain("Unknown Whisper model")
            expect(fetchSpy).not.toHaveBeenCalled()
        } finally {
            vi.unstubAllGlobals()
        }
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

describe("computeFileSha256", () => {
    it("matches a directly computed hash", async () => {
        const filePath = path.join(tempRoot, "hash-me.bin")
        const content = Buffer.from("freeshow whisper checksum test")
        fs.writeFileSync(filePath, content)

        const expected = crypto.createHash("sha256").update(content).digest("hex")
        expect(await computeFileSha256(filePath)).toBe(expected)
    })
})

describe("cancelWhisperDownload", () => {
    it("emits a terminal error progress event so the renderer entry clears", async () => {
        // fetch that hangs until its abort signal fires
        vi.stubGlobal(
            "fetch",
            vi.fn(
                (_url: string, init: { signal: AbortSignal }) =>
                    new Promise((_resolve, reject) => {
                        init.signal.addEventListener("abort", () => reject(Object.assign(new Error("This operation was aborted"), { name: "AbortError" })))
                    })
            )
        )

        try {
            const downloadPromise = downloadWhisperModel("tiny")
            cancelWhisperDownload()

            expect(await downloadPromise).toEqual({ ok: false, error: "Download was cancelled." })
            expect(sendToMain).toHaveBeenCalledWith(ToMain.MEDIA_DOWNLOAD_PROGRESS, { url: "whisper-model-tiny", name: "Whisper model (tiny)", progress: 0, total: 0, status: "error" })
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it("does nothing when no download is active", () => {
        cancelWhisperDownload()
        expect(sendToMain).not.toHaveBeenCalled()
    })
})
