import crypto from "crypto"
import fs from "fs"
import os from "os"
import path from "path"
import { afterAll, afterEach, describe, expect, it, vi } from "vitest"

// LocalModelManager resolves its bin dir at import time, which runs before any test-file statement -
// a hoisted function + var (both initialized before imports execute) make the temp dir lazily available to the mock
var tempRootCache = ""
function tempRoot() {
    if (!tempRootCache) tempRootCache = fs.mkdtempSync(path.join(os.tmpdir(), "freeshow-ai-setup-test-"))
    return tempRootCache
}

// the setup layer imports electron for app.getPath("userData") and IPC/main for sendToMain (which pulls in the whole main process)
vi.mock("electron", () => ({
    app: { getPath: () => tempRoot() },
    // delegate to the (stubbable) global fetch so tests can control network behavior
    net: { fetch: (...args: any[]) => (globalThis.fetch as any)(...args) }
}))
vi.mock("../../IPC/main", () => ({
    sendToMain: vi.fn()
}))
vi.mock("../../utils/files", () => ({
    createFolder: (folderPath: string) => fs.mkdirSync(folderPath, { recursive: true })
}))

import { sendToMain } from "../../IPC/main"
import { ToMain } from "../../../types/IPC/ToMain"
import { getModelDir as getNemotronModelDir } from "../speech/nemotron/manager"
import { DownloadManager } from "./DownloadManager"
import { LocalModelManager } from "./LocalModelManager"
import { WhisperSetupManager } from "./models/whisper"

afterAll(() => {
    fs.rmSync(tempRoot(), { recursive: true, force: true })
})

afterEach(() => {
    vi.mocked(sendToMain).mockClear()
})

describe("DownloadManager.computeSha256", () => {
    it("matches a directly computed hash", async () => {
        const filePath = path.join(tempRoot(), "hash-me.bin")
        const content = Buffer.from("freeshow ai setup checksum test")
        fs.writeFileSync(filePath, content)

        const expected = crypto.createHash("sha256").update(content).digest("hex")
        expect(await new DownloadManager("test").computeSha256(filePath)).toBe(expected)
    })
})

describe("whisper model download", () => {
    it("rejects unknown ids before any network request", async () => {
        const fetchSpy = vi.fn()
        vi.stubGlobal("fetch", fetchSpy)
        try {
            const result = await WhisperSetupManager.downloadModel("../../../../foo/attacker-repo/resolve/main/payload", path.join(tempRoot(), "out.bin"))
            expect(result.ok).toBe(false)
            expect((result as { error: string }).error).toContain("Unknown Whisper model")
            expect(fetchSpy).not.toHaveBeenCalled()
        } finally {
            vi.unstubAllGlobals()
        }
    })

    it("cancel emits a terminal error progress event so the renderer entry clears", async () => {
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
            const downloadPromise = WhisperSetupManager.downloadModel("tiny", path.join(tempRoot(), "ggml-tiny.bin"))
            WhisperSetupManager.cancelModelDownload("tiny")

            expect(await downloadPromise).toEqual({ ok: false, error: "Download was cancelled." })
            expect(sendToMain).toHaveBeenCalledWith(ToMain.MEDIA_DOWNLOAD_PROGRESS, { url: "tiny", name: "Whisper model (tiny)", progress: 0, total: 0, status: "error" })
        } finally {
            vi.unstubAllGlobals()
        }
    })
})

describe("LocalModelManager.getStatus", () => {
    it("reports whisper models already on disk as downloaded", async () => {
        const modelsDir = path.join(tempRoot(), "bin", "whisper", "models")
        fs.mkdirSync(modelsDir, { recursive: true })

        // a plausible ggml file: correct magic + past the minimum size
        const content = Buffer.alloc(2 * 1024 * 1024)
        content.writeUInt32LE(0x67676d6c, 0)
        fs.writeFileSync(path.join(modelsDir, "ggml-base.en.bin"), content)

        const status = await LocalModelManager.getStatus("whisper")
        expect(status.downloadedModels).toContain("base.en")
        expect(status.downloadedModels).not.toContain("large-v3")
    })
})

describe("nemotron model dir migration", () => {
    it("moves files an earlier downloader placed in bin/nemotron into bin/nemotron/models", () => {
        const engineDir = path.join(tempRoot(), "bin", "nemotron")
        fs.mkdirSync(engineDir, { recursive: true })
        fs.writeFileSync(path.join(engineDir, "tokens.txt"), "stray tokens file")

        const dir = getNemotronModelDir()
        expect(dir).toBe(path.join(engineDir, "models"))
        expect(fs.existsSync(path.join(dir, "tokens.txt"))).toBe(true)
        expect(fs.existsSync(path.join(engineDir, "tokens.txt"))).toBe(false)
    })
})
