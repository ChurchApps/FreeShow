import crypto from "crypto"
import { net } from "electron"
import fs from "fs"
import path from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { ToMain } from "../../../types/IPC/ToMain"
import { sendToMain } from "../../IPC/main"

export interface AiDownloadOptions {
    totalBytes?: number
    onProgress?: (downloaded: number, total: number) => void
}

const PROGRESS_INTERVAL = 200
const MAX_ATTEMPTS = 3

export class DownloadManager {
    key: string
    name: string

    private activeDownload: { controller: AbortController; partPath: string } | null = null

    constructor(key: string, name?: string) {
        this.key = key
        this.name = name || key.toUpperCase()
    }

    isDownloading(): boolean {
        return this.activeDownload !== null
    }

    cancel(): void {
        if (!this.activeDownload) return

        const { controller, partPath } = this.activeDownload
        this.activeDownload = null

        controller.abort()
        this.safeUnlink(partPath)
        this.sendProgress(0, 0, "error")
    }

    reportError(errorSentence: string): { ok: false; error: string } {
        this.sendProgress(0, 0, "error")
        sendToMain(ToMain.TOAST, errorSentence)
        return { ok: false, error: errorSentence }
    }

    reportComplete(): { ok: true } {
        this.sendProgress(1, 1, "complete")
        return { ok: true }
    }

    async downloadFile(url: string, destPath: string, options: AiDownloadOptions = {}): Promise<void> {
        const partPath = `${destPath}.part`
        const controller = new AbortController()
        this.activeDownload = { controller, partPath }

        await fs.promises.mkdir(path.dirname(destPath), { recursive: true })
        if (controller.signal.aborted) throw Object.assign(new Error("This operation was aborted"), { name: "AbortError" })

        let totalBytes = options.totalBytes || 0

        try {
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                const resumeAt = attempt > 1 && fs.existsSync(partPath) ? (await fs.promises.stat(partPath)).size : 0

                const response = await net.fetch(url, {
                    signal: controller.signal,
                    headers: resumeAt > 0 ? { Range: `bytes=${resumeAt}-` } : {}
                })

                if (response.status === 416 && resumeAt > 0) {
                    this.safeUnlink(partPath)
                    if (attempt >= MAX_ATTEMPTS) throw new Error(`Download failed (416): ${url}`)
                    continue
                }

                if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}): ${url}`)

                const resumed = resumeAt > 0 && response.status === 206
                const remainingBytes = Number(response.headers.get("content-length")) || 0
                if (!totalBytes || !resumed) totalBytes = resumed ? resumeAt + remainingBytes : remainingBytes

                let downloadedBytes = resumed ? resumeAt : 0
                let lastProgressAt = 0

                const body = Readable.fromWeb(response.body as any)
                body.on("data", (chunk: Buffer) => {
                    downloadedBytes += chunk.length
                    if (options.onProgress) {
                        options.onProgress(downloadedBytes, totalBytes)
                    } else if (Date.now() - lastProgressAt >= PROGRESS_INTERVAL) {
                        lastProgressAt = Date.now()
                        this.sendProgress(downloadedBytes, totalBytes, "downloading")
                    }
                })

                try {
                    await pipeline(body, fs.createWriteStream(partPath, { flags: resumed ? "a" : "w" }))
                    if (totalBytes > 0 && downloadedBytes !== totalBytes) {
                        throw new Error(`Download incomplete: got ${downloadedBytes} of ${totalBytes} bytes`)
                    }
                } catch (err) {
                    if (this.isAbortError(err) || attempt >= MAX_ATTEMPTS) throw err
                    continue
                }

                await fs.promises.rename(partPath, destPath)
                return
            }
        } finally {
            this.safeUnlink(partPath)
            if (this.activeDownload?.controller === controller) this.activeDownload = null
        }
    }

    async computeSha256(filePath: string): Promise<string> {
        const hash = crypto.createHash("sha256")
        await pipeline(fs.createReadStream(filePath), hash)
        return hash.digest("hex")
    }

    isAbortError(err: unknown): boolean {
        return (err as Error)?.name === "AbortError" || (err as { code?: string })?.code === "ABORT_ERR"
    }

    errorMessage(err: unknown): string {
        return (err as Error)?.message || String(err)
    }

    private sendProgress(progress: number, total: number, status: "downloading" | "complete" | "error"): void {
        sendToMain(ToMain.MEDIA_DOWNLOAD_PROGRESS, { url: this.key, name: this.name, progress, total, status })
    }

    safeUnlink(filePath: string): void {
        try {
            fs.unlinkSync(filePath)
        } catch {}
    }
}
