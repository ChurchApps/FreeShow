import fs from "fs"
import path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

// Hoist the temporary folder setup so it runs before imports are resolved
const h = vi.hoisted(() => {
    const fs = require("fs")
    const os = require("os")
    const path = require("path")
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "freeshow-backup-"))
    return { tempRoot, backupsFolder: path.join(tempRoot, "Backups"), settings: { special: {} as { autoBackupKeep?: unknown } } }
})

vi.mock("../IPC/main", () => ({ sendMain: vi.fn(), sendToMain: vi.fn() }))
vi.mock("./zip", () => ({ compressToZip: vi.fn(), decompressZip: vi.fn() }))
vi.mock("./store", () => ({ _store: {}, getStore: () => h.settings, setStore: vi.fn(), storeFilesData: {} }))

// utils/files.ts pulls in electron and the whole store/IPC chain — pruning only
// needs these few helpers, backed by the real filesystem in a temp folder
vi.mock("../utils/files", () => {
    const fs = require("fs")
    const path = require("path")
    return {
        getDataFolderPath: () => h.backupsFolder,
        readFolder: (folderPath: string) => {
            try {
                return fs.readdirSync(folderPath)
            } catch {
                return []
            }
        },
        getFileStats: (filePath: string) => {
            try {
                const stat = fs.statSync(filePath)
                return { path: filePath, stat, extension: path.extname(filePath).substring(1).toLowerCase(), folder: stat.isDirectory() }
            } catch {
                return null
            }
        },
        deleteFile: (filePath: string) => fs.rmSync(filePath, { force: true }),
        deleteFolder: (filePath: string) => fs.rmSync(filePath, { recursive: true, force: true }),
        doesPathExist: vi.fn(),
        getTimePointString: vi.fn(),
        loadShows: vi.fn(),
        makeDir: vi.fn(),
        openInSystem: vi.fn(),
        readFile: vi.fn(),
        selectFilesDialog: vi.fn(),
        writeFile: vi.fn()
    }
})

import { pruneAutoBackups } from "./backup"

function createZip(name: string) {
    fs.writeFileSync(path.join(h.backupsFolder, name), "zip")
}

// backups created before 1.4.4 are folders instead of zip files
function createLegacyFolder(name: string) {
    const folderPath = path.join(h.backupsFolder, name)
    fs.mkdirSync(folderPath, { recursive: true })
    fs.writeFileSync(path.join(folderPath, "SETTINGS.json"), "{}")
}

function remaining() {
    return fs.readdirSync(h.backupsFolder).sort()
}

describe("pruneAutoBackups", () => {
    beforeEach(() => {
        fs.rmSync(h.backupsFolder, { recursive: true, force: true })
        fs.mkdirSync(h.backupsFolder, { recursive: true })
        h.settings.special = {}
    })

    afterAll(() => {
        fs.rmSync(h.tempRoot, { recursive: true, force: true })
    })

    it("keeps the newest backups by name, not by file date", () => {
        // written oldest last, so the file dates disagree with the names
        createZip("2026-01-03_10-00_auto.zip")
        createZip("2026-01-05_10-00_auto.zip")
        createZip("2026-01-01_10-00_auto.zip")
        h.settings.special = { autoBackupKeep: 2 }

        pruneAutoBackups()

        expect(remaining()).toEqual(["2026-01-03_10-00_auto.zip", "2026-01-05_10-00_auto.zip"])
    })

    it("keeps 10 when the setting is missing", () => {
        for (let day = 1; day <= 12; day++) createZip(`2026-01-${String(day).padStart(2, "0")}_10-00_auto.zip`)

        pruneAutoBackups()

        expect(remaining().length).toBe(10)
        expect(remaining()[0]).toBe("2026-01-03_10-00_auto.zip")
    })

    it("never removes manual backups", () => {
        createZip("2026-01-01_10-00.zip")
        createZip("2026-01-02_10-00.zip")
        createZip("2026-01-03_10-00_auto.zip")
        createZip("2026-01-04_10-00_auto.zip")
        h.settings.special = { autoBackupKeep: 1 }

        pruneAutoBackups()

        expect(remaining()).toEqual(["2026-01-01_10-00.zip", "2026-01-02_10-00.zip", "2026-01-04_10-00_auto.zip"])
    })

    it("removes old folder backups as well as zips", () => {
        createLegacyFolder("2026-01-01_10-00_auto")
        createLegacyFolder("2026-01-02_10-00_auto")
        createZip("2026-01-03_10-00_auto.zip")
        h.settings.special = { autoBackupKeep: 1 }

        pruneAutoBackups()

        expect(remaining()).toEqual(["2026-01-03_10-00_auto.zip"])
    })

    it("falls back to the default for a missing or invalid setting instead of deleting everything", () => {
        for (const value of [0, -5, "many", null]) {
            fs.rmSync(h.backupsFolder, { recursive: true, force: true })
            fs.mkdirSync(h.backupsFolder, { recursive: true })
            for (let day = 1; day <= 11; day++) createZip(`2026-01-${String(day).padStart(2, "0")}_10-00_auto.zip`)
            h.settings.special = { autoBackupKeep: value }

            pruneAutoBackups()

            expect(remaining().length).toBe(10)
        }
    })

    it("does not keep more than the maximum", () => {
        for (let day = 1; day <= 12; day++) createZip(`2026-01-${String(day).padStart(2, "0")}_10-00_auto.zip`)
        h.settings.special = { autoBackupKeep: 5000 }

        pruneAutoBackups()

        expect(remaining().length).toBe(12)
    })

    it("does nothing when there is nothing to remove", () => {
        createZip("2026-01-01_10-00_auto.zip")
        h.settings.special = { autoBackupKeep: 10 }

        pruneAutoBackups()

        expect(remaining()).toEqual(["2026-01-01_10-00_auto.zip"])
    })
})
