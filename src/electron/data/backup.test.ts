import path from "path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Main } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import { sendMain, sendToMain } from "../IPC/main"
import { deleteFile, deleteFolder, getFileStats, openInSystem, readFile, readFolder, selectFilesDialog, writeFile } from "../utils/files"
import { deleteBackup, getBackups, pruneAutoBackups, restoreFiles, startBackup } from "./backup"
import { _store, setStore } from "./store"
import { compressToZip, decompressZip } from "./zip"

// only import the functions we need to test, not the entire modules
vi.mock("../IPC/main", () => ({ sendMain: vi.fn(), sendToMain: vi.fn() }))

vi.mock("../utils/files", () => ({
    deleteFile: vi.fn(),
    deleteFolder: vi.fn(),
    doesPathExist: vi.fn(() => true),
    getDataFolderPath: vi.fn((type: string) => `/mock/data/${type}`),
    getFileStats: vi.fn(),
    getTimePointString: vi.fn(() => "2026-08-07_12-00-00"),
    loadShows: vi.fn(() => ({ "show-1": { name: "Test Show" } })),
    makeDir: vi.fn(),
    openInSystem: vi.fn(),
    readFile: vi.fn(),
    readFolder: vi.fn(() => []),
    selectFilesDialog: vi.fn(),
    writeFile: vi.fn()
}))

vi.mock("./store", () => {
    const mockStores: Record<string, { path: string; store: any }> = {
        SETTINGS: { path: "/mock/data/settings.json", store: {} },
        SYNCED_SETTINGS: { path: "/mock/data/settings_synced.json", store: {} },
        PROJECTS: { path: "/mock/data/projects.json", store: {} },
        MEDIA: { path: "/mock/data/media.json", store: {} }
    }
    return {
        _store: mockStores,
        setStore: vi.fn((storeObj, data) => {
            storeObj.store = data
        }),
        storeFilesData: {
            SETTINGS: { fileName: "settings", portable: false },
            SYNCED_SETTINGS: { fileName: "settings_synced", portable: true },
            PROJECTS: { fileName: "projects", portable: true },
            MEDIA: { fileName: "media", portable: false }
        }
    }
})

vi.mock("./zip", () => ({
    compressToZip: vi.fn(async () => {}),
    decompressZip: vi.fn(async () => [])
}))

vi.mock("fs", () => ({
    default: { existsSync: vi.fn(() => true) },
    existsSync: vi.fn(() => true)
}))

describe("backup.ts", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe("getBackups", () => {
        it("parses zip and legacy folder backups", () => {
            vi.mocked(readFolder).mockImplementation((folderPath: string) => {
                if (folderPath.includes("folder_backup")) return ["file1.json"]
                return ["backup_1.zip", "folder_backup"]
            })
            vi.mocked(getFileStats).mockImplementation((filePath: string) => {
                if (filePath.endsWith("backup_1.zip")) return { stat: { ctimeMs: 1000000, size: 2048 }, folder: false } as any
                if (filePath.endsWith("folder_backup")) return { stat: { ctimeMs: 2000000, size: 0 }, folder: true } as any
                if (filePath.endsWith("file1.json")) return { stat: { ctimeMs: 2000000, size: 500 }, folder: false } as any
                return null
            })

            expect(getBackups()).toEqual([
                { path: path.resolve("/mock/data/backups", "backup_1.zip"), name: "backup_1", date: 1000000, size: 2048 },
                { path: path.resolve("/mock/data/backups", "folder_backup"), name: "folder_backup", date: 2000000, size: 500 }
            ])
        })
    })

    describe("pruneAutoBackups", () => {
        it("prunes auto backups older than 5 months when exceeding 10, keeping 3 oldest", () => {
            vi.useFakeTimers()
            vi.setSystemTime(new Date("2026-08-01T00:00:00Z"))

            vi.mocked(readFolder).mockReturnValue(Array.from({ length: 15 }, (_, i) => `auto_${String(i).padStart(2, "0")}_auto.zip`))
            vi.mocked(getFileStats).mockImplementation((filePath: string) => {
                const match = filePath.match(/auto_(\d+)_auto\.zip/)
                const index = match ? parseInt(match[1], 10) : 0
                return { stat: { ctimeMs: new Date(2025, 0, index + 1).getTime(), size: 100 }, folder: false } as any
            })

            pruneAutoBackups(true)

            // Keeps 0..2 (oldest 3) and 5..14 (newest 10), deletes 3 and 4
            expect(deleteFile).toHaveBeenCalledTimes(2)
            expect(deleteFile).toHaveBeenCalledWith(path.resolve("/mock/data/backups", "auto_03_auto.zip"))
            expect(deleteFile).toHaveBeenCalledWith(path.resolve("/mock/data/backups", "auto_04_auto.zip"))

            vi.useRealTimers()
        })
    })

    describe("deleteBackup", () => {
        it("deletes folder and file backups accordingly", () => {
            vi.mocked(getFileStats)
                .mockReturnValueOnce({ folder: true } as any)
                .mockReturnValueOnce({ folder: false } as any)

            deleteBackup({ path: "folder_backup" })
            expect(deleteFolder).toHaveBeenCalledWith(path.resolve("/mock/data/backups", "folder_backup"))

            deleteBackup({ path: "file_backup.zip" })
            expect(deleteFile).toHaveBeenCalledWith(path.resolve("/mock/data/backups", "file_backup.zip"))
        })
    })

    describe("startBackup", () => {
        it("creates manual backup zip with stores and shows", async () => {
            vi.mocked(readFolder).mockImplementation((folderPath: string) => (folderPath.endsWith("shows") ? ["song1.show"] : []))

            await startBackup()

            const [entries, zipPath] = vi.mocked(compressToZip).mock.calls[0]
            expect(zipPath).toBe(path.join("/mock/data/backups", "2026-08-07_12-00-00.zip"))
            expect(entries).toEqual(
                expect.arrayContaining([
                    { name: "SYNCED_SETTINGS.json", filePath: "/mock/data/settings_synced.json" },
                    { name: "PROJECTS.json", filePath: "/mock/data/projects.json" },
                    { name: "SETTINGS.json", filePath: "/mock/data/settings.json" },
                    { name: "SHOWS/song1.show", filePath: path.join("/mock/data/shows", "song1.show") }
                ])
            )
            expect(sendToMain).toHaveBeenCalledWith(ToMain.BACKUP, { finished: true, path: zipPath })
            expect(openInSystem).toHaveBeenCalledWith(zipPath, true)
        })

        it("creates auto backup with _auto suffix without opening in system", async () => {
            vi.mocked(readFolder).mockReturnValue([])

            await startBackup({ customTriggers: { isAutoBackup: true } })

            const [, zipPath] = vi.mocked(compressToZip).mock.calls[0]
            expect(zipPath).toBe(path.join("/mock/data/backups", "2026-08-07_12-00-00_auto.zip"))
            expect(sendToMain).toHaveBeenCalledWith(ToMain.BACKUP, { finished: true, path: zipPath })
            expect(openInSystem).not.toHaveBeenCalled()
        })

        it("returns entries directly for cloud sync", async () => {
            vi.mocked(readFolder).mockImplementation((folderPath: string) => {
                if (folderPath.endsWith("scriptures")) return ["KJV.json"]
                if (folderPath.endsWith("shows")) return ["song1.show"]
                return []
            })

            const result = await startBackup({ isCloudSync: true })

            expect(compressToZip).not.toHaveBeenCalled()
            expect(result?.entries).toEqual(
                expect.arrayContaining([
                    { name: "SYNCED_SETTINGS.json", filePath: "/mock/data/settings_synced.json" },
                    { name: "PROJECTS.json", filePath: "/mock/data/projects.json" },
                    { name: "MEDIA.json", filePath: "/mock/data/media.json" },
                    { name: "BIBLE_KJV.json", filePath: path.join("/mock/data/scriptures", "KJV.json") },
                    { name: "SHOWS/song1.show", filePath: path.join("/mock/data/shows", "song1.show") }
                ])
            )
        })

        it("handles zip compression error", async () => {
            vi.mocked(compressToZip).mockRejectedValueOnce(new Error("Zip compression failed"))

            await startBackup()

            expect(sendToMain).toHaveBeenCalledWith(ToMain.ALERT, "Could not create the backup file!")
            expect(sendToMain).toHaveBeenCalledWith(ToMain.BACKUP, {
                finished: false,
                path: path.join("/mock/data/backups", "2026-08-07_12-00-00.zip")
            })
        })
    })

    describe("restoreFiles", () => {
        it("returns early when no files are selected", async () => {
            vi.mocked(selectFilesDialog).mockReturnValue([])
            await restoreFiles()

            expect(sendToMain).toHaveBeenCalledWith(ToMain.RESTORE2, { finished: false })
            expect(sendToMain).not.toHaveBeenCalledWith(ToMain.RESTORE2, { starting: true })
        })

        it("restores stores, shows, and strips local paths from SETTINGS", async () => {
            vi.mocked(decompressZip).mockResolvedValue([
                { name: "SETTINGS.json", content: JSON.stringify({ theme: "dark", dataPath: "/old/path", showsPath: "/old/shows" }) },
                { name: "PROJECTS.json", content: JSON.stringify({ projects: { p1: { name: "Project 1" } } }) },
                { name: "SHOWS/test.show", content: JSON.stringify(["show1", { name: "Test Show" }]) }
            ] as any)

            await restoreFiles({ path: "/mock/backups/backup.zip" })

            expect(sendToMain).toHaveBeenCalledWith(ToMain.RESTORE2, { starting: true })
            expect(setStore).toHaveBeenCalledWith(_store.SETTINGS, { theme: "dark" })
            expect(setStore).toHaveBeenCalledWith(_store.PROJECTS, { projects: { p1: { name: "Project 1" } } })
            expect(writeFile).toHaveBeenCalledWith(path.resolve("/mock/data/shows", "test.show"), JSON.stringify(["show1", { name: "Test Show" }]))
            expect(sendMain).toHaveBeenCalledWith(Main.SHOWS, { "show-1": { name: "Test Show" } })
            expect(sendToMain).toHaveBeenCalledWith(ToMain.RESTORE2, { finished: true })
        })

        it("restores legacy SHOWS_CONTENT format", async () => {
            vi.mocked(readFolder).mockReturnValue(["SHOWS_CONTENT.json"])
            vi.mocked(readFile).mockReturnValue(JSON.stringify({ s1: { name: "Show One" } }))

            await restoreFiles({ path: "/mock/backups/unzipped_folder" })

            expect(writeFile).toHaveBeenCalledWith(path.resolve("/mock/data/shows", "Show One.show"), JSON.stringify(["s1", { name: "Show One" }]), "s1")
            expect(sendMain).toHaveBeenCalledWith(Main.SHOWS, expect.anything())
            expect(sendToMain).toHaveBeenCalledWith(ToMain.RESTORE2, { finished: true })
        })
    })
})
