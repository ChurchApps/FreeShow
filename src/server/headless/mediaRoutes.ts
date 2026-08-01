// ----- FreeShow -----
// Media/audio virtual filesystem: serves library media referenced by shows to remote
// clients (browser + hybrid desktop) that can't reach the server's disk directly.
//
//   GET /media?path=<abs path>&token=<token>
//
// Supports HTTP Range requests (video/audio seeking), sets MIME + cache headers, and
// only serves known media extensions (a basic safety allowlist on top of token auth).
// Browsers cache responses via Cache-Control; a deeper local sync/cache is a follow-up.

import type { Express, Request, Response } from "express"
import express from "express"
import fs from "fs"
import path from "path"
import { httpAuth } from "./auth"
import { resolveInSandbox, toSandboxRelative } from "./data/dataPaths"

const MAX_UPLOAD_BYTES = "2gb"

const MEDIA_MIME: { [ext: string]: string } = {
    // images
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    avif: "image/avif",
    ico: "image/x-icon",
    // video
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    mpg: "video/mpeg",
    mpeg: "video/mpeg",
    // audio
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    flac: "audio/flac",
    weba: "audio/webm",
    // documents
    pdf: "application/pdf"
}

export function registerMediaRoutes(app: Express) {
    app.get("/media", httpAuth, (req: Request, res: Response) => {
        const raw = req.query.path
        if (typeof raw !== "string" || !raw) return void res.status(400).send("missing path")
        if (raw.includes("\0")) return void res.status(400).end()

        // confine to the sandbox root: rejects ../ traversal and absolute paths outside it
        const filePath = resolveInSandbox(raw)
        if (!filePath) return void res.status(403).send("forbidden")

        // safety: only serve known media extensions (token auth already applied above)
        const ext = path.extname(filePath).slice(1).toLowerCase()
        const mime = MEDIA_MIME[ext]
        if (!mime) return void res.status(415).send("unsupported media type")

        let stat: fs.Stats
        try {
            stat = fs.statSync(filePath)
        } catch {
            return void res.status(404).send("not found")
        }
        if (!stat.isFile()) return void res.status(404).end()

        res.setHeader("Content-Type", mime)
        res.setHeader("Accept-Ranges", "bytes")
        res.setHeader("Cache-Control", "public, max-age=86400")

        const range = req.headers.range
        if (range) {
            const match = /bytes=(\d*)-(\d*)/.exec(range)
            let start = match && match[1] ? parseInt(match[1], 10) : 0
            let end = match && match[2] ? parseInt(match[2], 10) : stat.size - 1
            if (isNaN(start) || start < 0) start = 0
            if (isNaN(end) || end >= stat.size) end = stat.size - 1
            if (start > end) {
                res.status(416).setHeader("Content-Range", `bytes */${stat.size}`)
                return void res.end()
            }
            res.status(206)
            res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`)
            res.setHeader("Content-Length", end - start + 1)
            fs.createReadStream(filePath, { start, end }).pipe(res)
            return
        }

        res.setHeader("Content-Length", stat.size)
        fs.createReadStream(filePath).pipe(res)
        return
    })

    // Upload a media file into a sandboxed folder:
    //   POST /media/upload?path=<relative folder>&name=<file name>   (raw body = file bytes)
    // Same guards as reads: token auth, sandbox confinement, media-extension allowlist.
    app.post("/media/upload", httpAuth, express.raw({ type: "*/*", limit: MAX_UPLOAD_BYTES }), (req: Request, res: Response) => {
        const rawName = typeof req.query.name === "string" ? req.query.name : ""
        const name = path.basename(rawName).trim() // strip any directory component
        if (!name || name.includes("\0")) return void res.status(400).send("missing name")

        const ext = path.extname(name).slice(1).toLowerCase()
        if (!MEDIA_MIME[ext]) return void res.status(415).send("unsupported media type")

        const folder = resolveInSandbox(typeof req.query.path === "string" ? req.query.path : "")
        if (!folder) return void res.status(403).send("forbidden")

        const target = resolveInSandbox(path.join(toSandboxRelative(folder), name))
        if (!target) return void res.status(403).send("forbidden")

        const body = req.body as Buffer
        if (!Buffer.isBuffer(body) || !body.length) return void res.status(400).send("empty body")

        try {
            fs.mkdirSync(path.dirname(target), { recursive: true })
            fs.writeFileSync(target, body)
        } catch (err) {
            console.error("Upload failed:", target, err)
            return void res.status(500).send("write failed")
        }

        return void res.json({ path: toSandboxRelative(target), name })
    })
}
