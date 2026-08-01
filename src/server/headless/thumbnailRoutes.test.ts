import express from "express"
import fs from "fs"
import type { Server } from "http"
import type { AddressInfo } from "net"
import os from "os"
import path from "path"
import sharp from "sharp"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { execFileSync } from "child_process"
import { getFfmpegPath, resetFfmpegPathCache } from "../../shared/media/ffmpeg"
import { setAuthToken } from "./auth"
import { setDataRoot } from "./data/dataPaths"
import { registerThumbnailRoutes } from "./thumbnailRoutes"

let server: Server
let base = ""
let tmp = ""
let imagePath = ""
let hasRealVideo = false

const url = (p: string, size = 250) => `${base}/thumbnail?path=${encodeURIComponent(p)}&size=${size}`
// only completed entries (the writer uses tmp + rename, so ignore in-flight .tmp files)
const cacheFiles = () => fs.readdirSync(path.join(tmp, "Config", "thumbnails")).filter((f) => f.endsWith(".webp"))

// cache writes are async (fire-and-forget after responding); wait for them to land
const settle = () => new Promise((r) => setTimeout(r, 300))
async function waitForCacheCount(count: number, timeoutMs = 3000) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        if (cacheFiles().length >= count) return
        await new Promise((r) => setTimeout(r, 25))
    }
}

beforeAll(async () => {
    setAuthToken("")
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fs-thumb-"))
    setDataRoot(tmp)
    fs.mkdirSync(path.join(tmp, "Media"), { recursive: true })
    imagePath = path.join(tmp, "Media", "photo.jpg")
    await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 10, g: 120, b: 200 } } })
        .jpeg()
        .toFile(imagePath)
    fs.writeFileSync(path.join(tmp, "Media", "clip.mp4"), "not really a video")

    // a real video (only if ffmpeg is available on this machine)
    const ffmpeg = getFfmpegPath()
    if (ffmpeg) {
        try {
            execFileSync(ffmpeg, ["-y", "-f", "lavfi", "-i", "testsrc=duration=2:size=320x240:rate=10", "-pix_fmt", "yuv420p", path.join(tmp, "Media", "real.mp4")], { stdio: "ignore" })
            hasRealVideo = true
        } catch {
            hasRealVideo = false
        }
    }

    const app = express()
    registerThumbnailRoutes(app)
    await new Promise<void>((resolve) => {
        server = app.listen(0, resolve)
    })
    base = `http://localhost:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
    server?.close()
    fs.rmSync(tmp, { recursive: true, force: true })
})

describe("thumbnail generation", () => {
    it("resizes an image to webp within the requested box", async () => {
        const res = await fetch(url("Media/photo.jpg", 250))
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toBe("image/webp")

        const buf = Buffer.from(await res.arrayBuffer())
        const meta = await sharp(buf).metadata()
        expect(meta.format).toBe("webp")
        expect(meta.width).toBe(250)
        expect(buf.length).toBeLessThan(fs.statSync(imagePath).size)
    })

    it("caches the generated thumbnail on disk and reuses it", async () => {
        await fetch(url("Media/photo.jpg", 300))
        await settle() // let this (and any earlier) async cache write land
        const first = cacheFiles()
        expect(first.length).toBeGreaterThan(0)

        // same key -> served from cache, no additional entry written
        await fetch(url("Media/photo.jpg", 300))
        await settle()
        expect(cacheFiles()).toEqual(first)
    })

    it("invalidates the cache when the original changes (mtime in the key)", async () => {
        await fetch(url("Media/photo.jpg", 400))
        await settle()
        const before = cacheFiles().length

        // rewrite the original -> new mtime -> new cache key
        await sharp({ create: { width: 600, height: 600, channels: 3, background: { r: 1, g: 2, b: 3 } } })
            .jpeg()
            .toFile(imagePath)
        fs.utimesSync(imagePath, new Date(Date.now() + 5000), new Date(Date.now() + 5000))

        await fetch(url("Media/photo.jpg", 400))
        await waitForCacheCount(before + 1)
        expect(cacheFiles().length).toBe(before + 1)
    })

    it("never returns an empty body for concurrent requests (cache write race)", async () => {
        // the drawer requests the same thumbnail more than once at the same time
        const responses = await Promise.all(Array.from({ length: 8 }, () => fetch(url("Media/photo.jpg", 275))))
        for (const res of responses) {
            expect(res.status).toBe(200)
            expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0)
        }

        // and the cached entry itself is complete
        const again = await fetch(url("Media/photo.jpg", 275))
        expect((await again.arrayBuffer()).byteLength).toBeGreaterThan(0)
    })

    it("extracts a video frame with ffmpeg when available", async () => {
        if (!hasRealVideo) return // ffmpeg not installed on this machine
        const res = await fetch(url("Media/real.mp4", 250))
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toBe("image/webp")

        const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
        expect(meta.format).toBe("webp")
        expect(meta.width).toBeLessThanOrEqual(250)
    })

    it("falls back to the original when the video can't be decoded", async () => {
        // clip.mp4 is not a real video, so ffmpeg fails -> original is streamed
        const res = await fetch(url("Media/clip.mp4"))
        expect(res.status).toBe(200)
        expect(await res.text()).toBe("not really a video")
    })

    it("blocks paths outside the sandbox", async () => {
        expect((await fetch(url("../../etc/hosts"))).status).toBe(403)
    })
})
