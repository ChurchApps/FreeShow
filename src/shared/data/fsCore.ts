// ----- FreeShow -----
// Portable filesystem helpers (no Electron). These mirror the behavior of the
// electron-only helpers in src/electron/utils/files.ts but take explicit paths
// so they can run in a plain Node (headless server) process.

import fs from "fs"
import path from "path"

export function doesPathExist(filePath: string): boolean {
    if (!filePath) return false
    try {
        return fs.existsSync(filePath)
    } catch {
        return false
    }
}

export function ensureDir(dirPath: string): string {
    try {
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
    } catch (err) {
        console.error("Could not create folder:", dirPath, err)
    }
    return dirPath
}

export function readFile(filePath: string, encoding: BufferEncoding = "utf8"): string {
    try {
        if (!fs.existsSync(filePath) || fs.lstatSync(filePath).isDirectory()) return ""
        return fs.readFileSync(filePath, encoding)
    } catch {
        return ""
    }
}

export function readFolder(dirPath: string): string[] {
    try {
        return fs.readdirSync(dirPath)
    } catch {
        return []
    }
}

export function writeFile(filePath: string, content: string): boolean {
    try {
        // skip write if unchanged (matches files.ts fileContentMatches optimization)
        if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === content) return false
        fs.writeFileSync(filePath, content)
        return true
    } catch (err) {
        console.error("Error writing file:", filePath, err)
        return false
    }
}

export function deleteFile(filePath: string): boolean {
    try {
        fs.unlinkSync(filePath)
        return true
    } catch {
        return false
    }
}

export function parseJSON<T = any>(jsonData: string): T | null {
    if (!jsonData) return null
    try {
        return JSON.parse(jsonData) as T
    } catch {
        return null
    }
}

/** Load a `[id, content]` tuple file (.show / .fsb / store), matching files.ts loadFile shape. */
export function loadTupleFile(filePath: string, contentId = ""): { error?: string; id: string; content?: any } {
    if (!doesPathExist(filePath)) return { error: "not_found", id: contentId }
    const content = readFile(filePath)
    if (!content) return { error: "not_found", id: contentId }

    const parsed = parseJSON<any[]>(content)
    if (!parsed) return { error: "not_found", id: contentId }

    if (contentId && parsed[0] !== contentId) parsed[0] = contentId
    return { id: contentId, content: parsed }
}

export function joinPath(...parts: string[]): string {
    return path.join(...parts)
}
