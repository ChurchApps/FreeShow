// ----- FreeShow -----
// On-the-fly thumbnail generation for remote clients:
//
//   GET /thumbnail?path=<sandbox-relative>&size=<px>&token=<token>
//
// Images are resized with sharp and cached on disk under <dataRoot>/Config/thumbnails.
// The cache key hashes path + mtime + size, so editing the original changes its mtime and
// therefore the key — old thumbnails are invalidated automatically (no manual purging).
//
// Video thumbnails are not generated yet (sharp can't decode video); those requests fall
// back to streaming the original. Extracting a frame with ffmpeg is a planned follow-up.

import { execFile } from "child_process"
import { createHash } from "crypto"
import type { Express, Request, Response } from "express"
import fs from "fs"
import path from "path"
import sharp from "sharp"
import { promisify } from "util"
import { getFfmpegPath } from "../../shared/media/ffmpeg"
import { httpAuth } from "./auth"
import { getDataFolderPath, resolveInSandbox } from "./data/dataPaths"

const execFileAsync = promisify(execFile)

let cacheWriteCounter = 0

const THUMBNAIL_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp", "tiff"]
const VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "webm", "mkv", "avi", "mpg", "mpeg"]

/**
 * Extract a frame from a video with ffmpeg and return it as a resized webp buffer.
 * Returns null when ffmpeg isn't available or extraction fails (caller falls back).
 */
async function videoThumbnail(filePath: string, size: number): Promise<Buffer | null> {
    const ffmpeg = getFfmpegPath()
    if (!ffmpeg) return null

    try {
        // grab a frame a little into the clip (avoids black/blank first frames),
        // scaled by ffmpeg, then normalised to webp by sharp
        const { stdout } = await execFileAsync(
            ffmpeg,
            ["-ss", "1", "-i", filePath, "-frames:v", "1", "-vf", `scale=${size}:${size}:force_original_aspect_ratio=decrease`, "-f", "image2pipe", "-vcodec", "png", "-"],
            { encoding: "buffer", maxBuffer: 64 * 1024 * 1024, timeout: 20000, windowsHide: true }
        )
        if (!stdout?.length) return null
        return await sharp(stdout).webp({ quality: 80 }).toBuffer()
    } catch (err) {
        console.error("Video thumbnail failed:", filePath, (err as Error)?.message)
        return null
    }
}
const DEFAULT_SIZE = 250
const MAX_SIZE = 1000

function cacheDir(): string {
    const dir = path.join(getDataFolderPath("userData"), "thumbnails")
    fs.mkdirSync(dir, { recursive: true })
    return dir
}

/** hash of path + mtime + size — a changed original produces a new key */
function cacheKey(filePath: string, mtimeMs: number, size: number): string {
    return createHash("sha1").update(`${filePath}|${mtimeMs}|${size}`).digest("hex")
}

export function registerThumbnailRoutes(app: Express) {
    app.get("/thumbnail", httpAuth, async (req: Request, res: Response) => {
        const raw = typeof req.query.path === "string" ? req.query.path : ""
        if (!raw || raw.includes("\0")) return void res.status(400).send("missing path")

        const filePath = resolveInSandbox(raw)
        if (!filePath) return void res.status(403).send("forbidden")

        let size = Number(req.query.size) || DEFAULT_SIZE
        if (!Number.isFinite(size) || size <= 0) size = DEFAULT_SIZE
        size = Math.min(Math.round(size), MAX_SIZE)

        let stat: fs.Stats
        try {
            stat = fs.statSync(filePath)
        } catch {
            return void res.status(404).send("not found")
        }
        if (!stat.isFile()) return void res.status(404).end()

        const ext = path.extname(filePath).slice(1).toLowerCase()
        const isImage = THUMBNAIL_EXTENSIONS.includes(ext)
        const isVideo = VIDEO_EXTENSIONS.includes(ext)

        // neither an image sharp can decode nor a video ffmpeg can read -> serve the original
        if (!isImage && !isVideo) {
            res.setHeader("Cache-Control", "public, max-age=86400")
            return void fs.createReadStream(filePath).pipe(res)
        }

        const cachePath = path.join(cacheDir(), `${cacheKey(filePath, stat.mtimeMs, size)}.webp`)

        res.setHeader("Content-Type", "image/webp")
        // the key encodes path+mtime+size, so a hit is always current -> cache hard
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable")

        // only trust a non-empty cache entry (a 0-byte file would mean a partial/failed write)
        try {
            if (fs.statSync(cachePath).size > 0) return void fs.createReadStream(cachePath).pipe(res)
        } catch {
            // no cache entry yet
        }

        try {
            const buffer = isVideo
                ? await videoThumbnail(filePath, size)
                : await sharp(filePath).rotate().resize(size, size, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()

            // no ffmpeg (or extraction failed) -> stream the original so the client shows something
            if (!buffer) {
                res.setHeader("Content-Type", "application/octet-stream")
                res.setHeader("Cache-Control", "public, max-age=86400")
                return void fs.createReadStream(filePath).pipe(res)
            }

            // write atomically (tmp + rename) so a concurrent request never streams a
            // half-written file — the drawer requests the same thumbnail more than once
            // (blur + main <img>), which would otherwise return 0 bytes.
            const tmpPath = `${cachePath}.${process.pid}-${cacheWriteCounter++}.tmp`
            fs.writeFile(tmpPath, buffer, (err) => {
                if (err) return console.error("Failed to cache thumbnail:", cachePath, err)
                fs.rename(tmpPath, cachePath, (renameErr) => {
                    if (renameErr) {
                        console.error("Failed to move cached thumbnail into place:", cachePath, renameErr)
                        fs.unlink(tmpPath, () => {})
                    }
                })
            })

            return void res.end(buffer)
        } catch (err) {
            console.error("Thumbnail generation failed:", filePath, err)
            // fall back to the original so the client still shows something
            res.setHeader("Content-Type", "application/octet-stream")
            return void fs.createReadStream(filePath).pipe(res)
        }
    })
}
