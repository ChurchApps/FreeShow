import crypto from "crypto"
import fs from "fs"
import path from "path"
import type { Request, Response } from "express"

// Media registry to track allowed media files
const mediaRegistry = new Map<string, string>() // token -> filePath

// Helper function to register media file and get secure token
export function registerMediaFile(filePath: string): string {
    if (!filePath) return ""

    // If it's already a URL, return as is
    if (filePath.startsWith("http://") || filePath.startsWith("https://") || filePath.startsWith("data:")) {
        return filePath
    }

    // Generate a consistent token based on the file path using SHA-256
    // This ensures the same file always gets the same token
    const token = crypto.createHash("sha256").update(filePath).digest("hex")

    // Always register/update the mapping (in case of server restart)
    mediaRegistry.set(token, filePath)

    console.log("REGISTERED MEDIA FILE:", filePath, "->", token)

    return `http://localhost:5511/media/${token}`
}

// Helper function to get file path from token (for the server)
export function getMediaFileFromToken(token: string): string | null {
    return mediaRegistry.get(token) || null
}

// Helper function to convert local file path to HTTP URL
export function getMediaUrl(filePath: string): string {
    return registerMediaFile(filePath)
}

// Media serving handler with caching and range request support
export function handleMediaRequest(req: Request, res: Response): void {
    const token = req.params.token

    // Get the actual file path from the secure token
    const filePath = getMediaFileFromToken(token)

    if (!filePath) {
        console.error("Invalid or expired media token:", token)
        res.status(404).send("Media not found")
        return
    }

    // SECURITY: Validate file extension
    const allowedExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".webm", ".ogv", ".mov", ".avi", ".bmp", ".tiff", ".svg"]
    const ext = path.extname(filePath).toLowerCase()

    if (!allowedExtensions.includes(ext)) {
        console.error("Unauthorized file type:", ext)
        res.status(403).send("File type not allowed")
        return
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error("Media file not found:", filePath)
        res.status(404).send("Media file not found")
        return
    }

    // Get file stats for caching
    const stats = fs.statSync(filePath)
    const lastModified = stats.mtime.toUTCString()
    const etag = `"${stats.size}-${stats.mtime.getTime()}"`

    // Check if client has cached version
    const ifModifiedSince = req.headers["if-modified-since"]
    const ifNoneMatch = req.headers["if-none-match"]

    if ((ifModifiedSince && ifModifiedSince === lastModified) || (ifNoneMatch && ifNoneMatch === etag)) {
        res.status(304).end()
        return
    }

    // Get file extension to set proper content type
    const mimeTypes: { [key: string]: string } = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".tiff": "image/tiff",
        ".svg": "image/svg+xml",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".ogv": "video/ogg",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo"
    }

    const contentType = mimeTypes[ext] || "application/octet-stream"

    // Set caching headers
    res.setHeader("Content-Type", contentType)
    res.setHeader("Last-Modified", lastModified)
    res.setHeader("ETag", etag)
    res.setHeader("Cache-Control", "public, max-age=3600") // Cache for 1 hour
    res.setHeader("Content-Length", stats.size)

    // Handle range requests for video files (important for video seeking)
    const range = req.headers.range
    if (range && (ext === ".mp4" || ext === ".webm" || ext === ".ogv" || ext === ".mov" || ext === ".avi")) {
        const parts = range.replace(/bytes=/, "").split("-")
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1
        const chunksize = end - start + 1

        res.status(206)
        res.setHeader("Content-Range", `bytes ${start}-${end}/${stats.size}`)
        res.setHeader("Accept-Ranges", "bytes")
        res.setHeader("Content-Length", chunksize)

        const fileStream = fs.createReadStream(filePath, { start, end })
        fileStream.pipe(res)

        fileStream.on("error", (error) => {
            console.error("Error streaming media file:", error)
            if (!res.headersSent) {
                res.status(500).send("Error streaming media file")
            }
        })
    } else {
        // Stream the entire file
        const fileStream = fs.createReadStream(filePath)
        fileStream.pipe(res)

        fileStream.on("error", (error) => {
            console.error("Error streaming media file:", error)
            if (!res.headersSent) {
                res.status(500).send("Error streaming media file")
            }
        })
    }
}
