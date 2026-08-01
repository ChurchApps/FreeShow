// ----- FreeShow -----
// Headless implementation of the PersistenceAdapter contract. Reads/writes the
// same on-disk formats as the desktop app: key/value store JSON files and
// per-show `[id, Show]` .show files. Backup/cloud are intentionally omitted here
// (cloud sync remains a separate concern; see the plan Phase 2).

import fs from "fs"
import type { Show, TrimmedShow, TrimmedShows } from "../../../types/Show"
import { deleteFile, doesPathExist, joinPath, loadTupleFile, parseJSON, readFile, readFolder, writeFile } from "../../../shared/data/fsCore"
import type { PersistenceAdapter, SaveResult } from "../../../shared/platform/Platform"
import { getDataFolderPath, getDataFolderRoot, resolveInSandbox, toSandboxRelative } from "./dataPaths"
import { getStore, getStoreValue, setStore, setStoreValue } from "./headlessStore"

function trimShow(showCache: Show): TrimmedShow | null {
    if (!showCache) return null
    const show: TrimmedShow = {
        name: showCache.name,
        category: showCache.category,
        timestamps: showCache.timestamps,
        quickAccess: showCache.quickAccess || {}
    }
    if (showCache.origin) show.origin = showCache.origin
    if (showCache.private) show.private = true
    if (showCache.locked) show.locked = true
    return show
}

function isValidJSON(object: any): boolean {
    try {
        JSON.stringify(object)
        return true
    } catch {
        return false
    }
}

export function loadShow(msg: { id: string; name: string }): any {
    const showsFolder = getDataFolderPath("shows")

    const byName = loadTupleFile(joinPath(showsFolder, (msg.name || msg.id) + ".show"), msg.id)
    if (!byName.error) return byName

    // The client may not know the file name yet (a show broadcast to other clients is
    // requested before their index updates, so `name` is undefined and we'd look for
    // "<id>.show"). Fall back to finding the file whose stored id matches.
    if (!msg.id) return byName
    for (const file of readFolder(showsFolder)) {
        if (!file.toLowerCase().endsWith(".show")) continue
        const parsed = parseJSON<[string, Show]>(readFile(joinPath(showsFolder, file)) || "")
        if (parsed?.[0] === msg.id) return { id: msg.id, content: parsed }
    }

    return byName
}

// build the trimmed shows index by scanning the shows folder
export function loadShows(): TrimmedShows {
    const showsPath = getDataFolderPath("shows")
    const files = readFolder(showsPath).filter((name) => name.toLowerCase().endsWith(".show"))

    const index: TrimmedShows = {}
    for (const file of files) {
        const name = file.slice(0, -5)
        if (!name) continue
        const parsed = parseJSON<[string, Show]>(readFile(joinPath(showsPath, file)) || "")
        if (!parsed || !parsed[1]) continue
        const id = parsed[0]
        const trimmed = trimShow({ ...parsed[1], name })
        if (trimmed) index[id] = trimmed
    }

    setStore("SHOWS", index)
    return index
}

export function loadScripture(msg: { id: string; name: string }): any {
    const bibleFolder = getDataFolderPath("scriptures")
    const filePath = joinPath(bibleFolder, msg.name + ".fsb")
    return loadTupleFile(filePath, msg.id)
}

export function readBiblesFolder(): { path: string; name: string }[] {
    const bibleFolder = getDataFolderPath("scriptures")
    return readFolder(bibleFolder).map((name) => ({
        path: joinPath(bibleFolder, name),
        name: name.replace(/\.fsb$/i, "")
    }))
}

function baseName(p: string): string {
    return p.split(/[\\/]/).filter(Boolean).pop() || p
}

// create a subfolder within a sandbox path; returns the new folder's relative path ("" on failure)
export function createFolder(data: { path: string; name: string }): string {
    const name = String(data?.name || "").trim()
    // must be a single clean segment (no traversal / separators)
    if (!name || name === "." || name === ".." || /[\\/]/.test(name)) return ""
    const parent = resolveInSandbox(data?.path)
    if (!parent) return ""
    const target = resolveInSandbox(joinPath(toSandboxRelative(parent), name))
    if (!target) return ""
    try {
        fs.mkdirSync(target, { recursive: true })
    } catch (err) {
        console.error("Failed to create folder:", target, err)
        return ""
    }
    return toSandboxRelative(target)
}

// rich folder listing for the media/audio drawer (path -> FileFolder map). All paths are
// SANDBOX-RELATIVE (the server's absolute base is never exposed) and confined to the
// sandbox root; an empty path browses the root. Paths that escape the sandbox are ignored.
export function readFolderContent(data: { path: string | string[]; depth?: number }): Record<string, any> {
    const inputs = Array.isArray(data.path) ? data.path : [data.path]
    const depth = data.depth ?? 0
    const out: Record<string, any> = {}

    for (const input of inputs) {
        const abs = resolveInSandbox(input)
        if (abs) walk(abs, 0)
    }

    function walk(folderPath: string, currentDepth: number) {
        const relFolder = toSandboxRelative(folderPath)
        if (out[relFolder]) return
        let entries: string[]
        try {
            entries = fs.readdirSync(folderPath)
        } catch {
            return
        }
        const filePathsAbs = entries.map((name) => joinPath(folderPath, name))
        const filePathsRel = filePathsAbs.map(toSandboxRelative)

        if (currentDepth > depth) {
            out[relFolder] = { isFolder: true, path: relFolder, name: baseName(folderPath), files: filePathsRel }
            return
        }

        for (const filePath of filePathsAbs) {
            let stat: fs.Stats
            try {
                stat = fs.statSync(filePath)
            } catch {
                continue
            }
            const rel = toSandboxRelative(filePath)
            if (stat.isDirectory()) walk(filePath, currentDepth + 1)
            else out[rel] = { isFolder: false, path: rel, name: baseName(filePath), thumbnailPath: "", stats: { mtimeMs: stat.mtimeMs, birthtimeMs: stat.birthtimeMs, size: stat.size } }
        }

        out[relFolder] = { isFolder: true, path: relFolder, name: baseName(folderPath), files: filePathsRel }
    }

    return out
}

// library stores that should propagate to OTHER connected clients when they change
// (so a new show / project / overlay appears live in every session's drawer & folders)
const LIBRARY_STORE_KEYS = ["SHOWS", "PROJECTS", "OVERLAYS", "TEMPLATES", "EVENTS", "THEMES", "STAGE", "SYNCED_SETTINGS", "MEDIA"]

// batched save (mirrors src/electron/data/save.ts core, minus backup/cloud)
export function save(data: any): SaveResult {
    const changed: Record<string, any> = {}

    // stores
    for (const key of Object.keys(data || {})) {
        const value = (data as any)[key]
        if (value === undefined || value === null) continue
        // only persist known stores; skip control fields (closeWhenFinished, customTriggers, showsCache, ...)
        if (!isStoreKey(key)) continue
        if (!isValidJSON(value)) continue

        // detect library changes BEFORE writing so we can broadcast only real changes (avoids save echo loops)
        if (LIBRARY_STORE_KEYS.includes(key) && JSON.stringify(getStore(key)) !== JSON.stringify(value)) changed[key] = value

        setStore(key, value)
    }

    // scriptures
    if (data.scripturesCache) {
        const scriptureFolder = getDataFolderPath("scriptures")
        for (const [id, value] of Object.entries<any>(data.scripturesCache)) {
            if (!value || !isValidJSON(value)) continue
            writeFile(joinPath(scriptureFolder, value.name + ".fsb"), JSON.stringify([id, value]))
        }
    }

    const showsPath = getDataFolderPath("shows")

    // shows
    if (data.showsCache) {
        for (const [id, value] of Object.entries<any>(data.showsCache)) {
            if (!value || !isValidJSON(value)) continue
            writeFile(joinPath(showsPath, String(value.name || id) + ".show"), JSON.stringify([id, value]))
        }
    }

    // deletions
    if (Array.isArray(data.deletedShows)) {
        for (const { name, id } of data.deletedShows) {
            if (!id || data.showsCache?.[id]) continue
            const filePath = joinPath(showsPath, (name || id) + ".show")
            if (!doesPathExist(filePath)) continue
            const show = parseJSON<[string, Show]>(readFile(filePath) || "{}")
            if (show?.[0] !== id) continue
            deleteFile(filePath)
        }
    }

    // socketServer sends SAVE2 to the saver and broadcasts `changed` to other clients
    return { changed, complete: { closeWhenFinished: !!data.closeWhenFinished, customTriggers: data.customTriggers } }
}

const STORE_KEYS = new Set(["SHOWS", "SETTINGS", "SYNCED_SETTINGS", "THEMES", "PROJECTS", "STAGE", "OVERLAYS", "TEMPLATES", "EVENTS", "HISTORY", "MEDIA", "CACHE", "CACHE_SYNC", "USAGE", "DRIVE_API_KEY", "ACCESS"])
function isStoreKey(key: string): boolean {
    return STORE_KEYS.has(key)
}

export const headlessPersistence: PersistenceAdapter = {
    getStore,
    setStore,
    getStoreValue,
    setStoreValue,
    loadShow,
    loadShows,
    save,
    loadScripture,
    readBiblesFolder,
    readFile,
    readFolder,
    readFolderContent,
    createFolder,
    getDataFolderRoot,
    getDataFolderPath
}
