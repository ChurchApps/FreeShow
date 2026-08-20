import fs from "fs"
import path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

// Hoist the temporary folder setup so it runs before imports are resolved
const h = vi.hoisted(() => {
    const os = require("os")
    const fs = require("fs")
    const tempRoot = fs.mkdtempSync(require("path").join(os.tmpdir(), "freeshow-backup-"))
    return { tempRoot, folder: require("path").join(tempRoot, "Backups"), settings: { special: {} }, dates: {} as Record<string, number> }
})

vi.mock("../IPC/main", () => ({ sendMain: vi.fn(), sendToMain: vi.fn() }))
vi.mock("./zip", () => ({ compressToZip: vi.fn(), decompressZip: vi.fn() }))
vi.mock("./store", () => ({ _store: {}, getStore: () => h.settings, setStore: vi.fn(), storeFilesData: {} }))

// utils/files.ts pulls in electron and the whole store/IPC chain — pruning only
// needs these few helpers, backed by the real filesystem in a temp folder
vi.mock("../utils/files", () => ({
    getDataFolderPath: () => h.folder,
    readFolder: (p: string) => {
        try {
            return fs.readdirSync(p)
        } catch {
            return []
        }
    },
    getFileStats: (p: string) => {
        try {
            const stat = fs.statSync(p)
            const date = h.dates[p] ?? stat.ctimeMs
            return { path: p, name: path.basename(p, path.extname(p)), stat: { ...stat, ctimeMs: date, mtimeMs: date }, date, extension: path.extname(p).substring(1).toLowerCase(), folder: stat.isDirectory() }
        } catch {
            return null
        }
    },
    deleteFile: (p: string) => fs.rmSync(p, { force: true }),
    deleteFolder: (p: string) => fs.rmSync(p, { recursive: true, force: true }),
    doesPathExist: (p: string) => fs.existsSync(p)
}))

import { pruneAutoBackups } from "./backup"

function createBackup(name: string, date: Date, isFolder = false) {
    const fullPath = path.join(h.folder, name)
    h.dates[fullPath] = date.getTime()
    if (isFolder) {
        fs.mkdirSync(fullPath, { recursive: true })
        fs.writeFileSync(path.join(fullPath, "SETTINGS.json"), "{}")
    } else {
        fs.writeFileSync(fullPath, "zip")
    }
}

const remaining = () => fs.readdirSync(h.folder).sort()

describe("pruneAutoBackups", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date("2026-06-01T00:00:00Z"))
        fs.rmSync(h.folder, { recursive: true, force: true })
        fs.mkdirSync(h.folder, { recursive: true })
        h.settings.special = {}
        h.dates = {}
    })

    afterAll(() => fs.rmSync(h.tempRoot, { recursive: true, force: true }))

    it("does nothing when total auto backups are 10 or fewer", () => {
        for (let i = 0; i < 10; i++) {
            createBackup(`backup_${i}_auto.zip`, new Date(2025, 0, i + 1))
        }
        pruneAutoBackups(true)
        expect(remaining().length).toBe(10)
    })

    it("always keeps the 3 oldest backups regardless of date", () => {
        for (let i = 0; i < 15; i++) {
            createBackup(`auto_${String(i).padStart(2, "0")}_auto.zip`, new Date(2025, 0, i + 1))
        }
        pruneAutoBackups(true)

        const kept = remaining()
        expect(kept.length).toBe(13)
        expect(kept.slice(0, 3)).toEqual(["auto_00_auto.zip", "auto_01_auto.zip", "auto_02_auto.zip"])
        expect(kept).not.toContain("auto_03_auto.zip")
    })

    it("keeps all backups that are less than 5 months old", () => {
        for (let i = 0; i < 5; i++) createBackup(`old_${String(i).padStart(2, "0")}_auto.zip`, new Date(2025, 0, i + 1))
        for (let i = 0; i < 10; i++) createBackup(`recent_${String(i).padStart(2, "0")}_auto.zip`, new Date(2026, 4, i + 1))

        pruneAutoBackups(true)

        const kept = remaining()
        expect(kept.length).toBe(13)
        expect(kept).toContain("old_00_auto.zip")
        expect(kept).not.toContain("old_03_auto.zip")
    })

    it("never removes manual backups", () => {
        createBackup("manual_1.zip", new Date(2025, 0, 1))
        createBackup("manual_2.zip", new Date(2025, 0, 1))
        for (let i = 0; i < 12; i++) createBackup(`auto_${String(i).padStart(2, "0")}_auto.zip`, new Date(2025, 0, i + 2))

        pruneAutoBackups(true)

        expect(remaining()).toContain("manual_1.zip")
        expect(remaining()).toContain("manual_2.zip")
    })

    it("removes old legacy folder backups as well as zip backups", () => {
        for (let i = 0; i < 12; i++) createBackup(`folder_${String(i).padStart(2, "0")}_auto`, new Date(2025, 0, i + 1), true)

        pruneAutoBackups(true)

        expect(remaining().length).toBe(12)
    })
})
