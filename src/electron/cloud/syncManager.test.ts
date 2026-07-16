import fs from "fs"
import path from "path"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { _store, createStores } from "../data/store"
import { compressToZip, decompressZipStream } from "../data/zip"
import { getDataFolderPath, writeFileAsync } from "../utils/files"
import { resetSyncManagerModule, syncData } from "./syncManager"

// 1. Host the temporary folder setup so it runs before imports are resolved
const h = vi.hoisted(() => {
    const fs = require("fs")
    const path = require("path")
    const tempRoot = path.join(__dirname, "../../../tmp_test_sync")
    const tempDir = path.join(tempRoot, "temp")
    const userDataDir = path.join(tempRoot, "userData")

    // clean up any stale folder from previous test crashes
    if (fs.existsSync(tempRoot)) {
        fs.rmSync(tempRoot, { recursive: true, force: true })
    }

    fs.mkdirSync(tempRoot, { recursive: true })
    fs.mkdirSync(tempDir, { recursive: true })
    fs.mkdirSync(userDataDir, { recursive: true })

    return {
        tempRoot,
        tempDir,
        userDataDir,
        currentMachineId: "test-device-id"
    }
})

// Mock electron
vi.mock("electron", () => {
    return {
        app: {
            getPath: (name: string) => {
                if (name === "temp") return h.tempDir
                if (name === "userData") {
                    const fs = require("fs")
                    const path = require("path")
                    const deviceDir = path.join(h.userDataDir, h.currentMachineId)
                    if (!fs.existsSync(deviceDir)) {
                        fs.mkdirSync(deviceDir, { recursive: true })
                    }
                    return deviceDir
                }
                return h.tempDir
            },
            getName: () => "FreeShow-Test"
        },
        dialog: {},
        shell: {},
        ipcMain: {
            on: vi.fn(),
            handle: vi.fn(),
            removeHandler: vi.fn()
        }
    }
})

// Mock electron-store
vi.mock("electron-store", () => {
    return {
        default: class MockStore {
            private name: string
            private defaultData: any
            constructor(options: any = {}) {
                this.name = options.name || "config"
                this.defaultData = options.defaults || {}
                // Write defaults to disk immediately so they exist for yazl/stat
                const fs = require("fs")
                const file = this.getFilePath()
                const dir = require("path").dirname(file)
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
                if (!fs.existsSync(file)) {
                    fs.writeFileSync(file, JSON.stringify(this.defaultData))
                }
            }
            private getFilePath() {
                const path = require("path")
                // local stores are lowercase, while the cloud files are uppercase (store.ts)
                const fileName = this.name.toLowerCase()
                return path.join(h.userDataDir, h.currentMachineId, fileName + ".json")
            }
            private readData() {
                const fs = require("fs")
                const file = this.getFilePath()
                if (fs.existsSync(file)) {
                    try {
                        return JSON.parse(fs.readFileSync(file, "utf8"))
                    } catch {
                        return {}
                    }
                }
                // Write defaults if missing
                const dir = require("path").dirname(file)
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
                fs.writeFileSync(file, JSON.stringify(this.defaultData))
                return this.defaultData
            }
            private writeData(val: any) {
                const fs = require("fs")
                const file = this.getFilePath()
                const dir = require("path").dirname(file)
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
                fs.writeFileSync(file, JSON.stringify(val))
            }
            get(key: string) {
                if (key === "dataPath") {
                    const path = require("path")
                    return path.join(h.userDataDir, h.currentMachineId)
                }
                return this.getNestedValue(this.readData(), key)
            }
            set(key: string, val: any) {
                const data = this.readData()
                this.setNestedValue(data, key, val)
                this.writeData(data)
            }
            delete(key: string) {
                const data = this.readData()
                this.deleteNestedValue(data, key)
                this.writeData(data)
            }
            private getNestedValue(obj: any, pathStr: string) {
                const parts = pathStr.split(".")
                let current = obj
                for (const part of parts) {
                    if (current === null || current === undefined) return undefined
                    current = current[part]
                }
                return current
            }
            private setNestedValue(obj: any, pathStr: string, value: any) {
                const parts = pathStr.split(".")
                let current = obj
                for (let i = 0; i < parts.length - 1; i++) {
                    const part = parts[i]
                    if (current[part] === undefined || current[part] === null) {
                        current[part] = {}
                    }
                    current = current[part]
                }
                current[parts[parts.length - 1]] = value
            }
            private deleteNestedValue(obj: any, pathStr: string) {
                const parts = pathStr.split(".")
                let current = obj
                for (let i = 0; i < parts.length - 1; i++) {
                    const part = parts[i]
                    if (current[part] === undefined || current[part] === null) return
                    current = current[part]
                }
                delete current[parts[parts.length - 1]]
            }
            get path() {
                return this.getFilePath()
            }
            get store() {
                return this.readData()
            }
            set store(val: any) {
                this.writeData(val)
            }
        }
    }
})

// Mock IPC
vi.mock("../IPC/main", () => {
    return {
        sendMain: vi.fn(),
        sendToMain: vi.fn()
    }
})

// Mock index
vi.mock("../index", () => {
    return {
        isProd: false,
        isMac: false,
        isLinux: false,
        isWindows: true,
        mainWindow: null,
        setAutoProfile: vi.fn(),
        toApp: vi.fn()
    }
})

// Mock helpers for getMachineId
vi.mock("../utils/helpers", async (importOriginal) => {
    const actual = (await importOriginal()) as any
    return {
        ...actual,
        getMachineId: () => h.currentMachineId
    }
})

// Mock deleteFolderAsync to be synchronous to avoid background deletion race conditions
vi.mock("../utils/files", async (importOriginal) => {
    const actual = (await importOriginal()) as any
    return {
        ...actual,
        deleteFolderAsync: async (filePath: string) => {
            const fs = require("fs")
            if (fs.existsSync(filePath)) {
                fs.rmSync(filePath, { recursive: true, force: true })
            }
        }
    }
})

// Fake Cloud Provider
class MockProvider {
    public mockCloudZipPath: string | null = null

    async hasValidConnection() {
        return true
    }

    async getTeams() {
        return [{ id: "test-team", churchId: "test-church", name: "Test Team" }]
    }

    async existingData(churchId: string, teamId: string) {
        return this.mockCloudZipPath !== null
    }

    async hasChanged(churchId: string, teamId: string) {
        return true
    }

    async getData(churchId: string, teamId: string, outputFolderPath: string) {
        if (!this.mockCloudZipPath) return null
        fs.mkdirSync(outputFolderPath, { recursive: true })
        const dest = path.join(outputFolderPath, "current.zip")
        fs.copyFileSync(this.mockCloudZipPath, dest)
        return dest
    }

    async uploadData(teamId: string, zipPath: string) {
        const cloudDest = path.join(h.tempRoot, "cloud_current.zip")
        if (fs.existsSync(cloudDest)) {
            fs.unlinkSync(cloudDest)
        }
        fs.copyFileSync(zipPath, cloudDest)
        this.mockCloudZipPath = cloudDest
        return true
    }

    async getBackup(churchId: string, teamId: string, extractLocation: string) {
        return null
    }

    async uploadBackup(teamId: string, backupZipPath: string) {
        return true
    }
}

const mockProviderInstance = new MockProvider()

vi.mock("./ChurchAppsSyncManager", () => {
    return {
        getChurchAppsSyncManager: () => mockProviderInstance
    }
})

describe("syncManager tests", () => {
    beforeAll(() => {
        createStores()
    })

    async function createCloudState(files: { name: string; content: string }[], changesOverrides: any = {}) {
        const initialCreated: any = {}
        for (const file of files) {
            if (file.name.startsWith("SHOWS/")) {
                const basename = path.basename(file.name)
                initialCreated[`SHOWS_CONTENT_${basename}`] = ["test-device-id"]
            }
        }
        const changes = {
            version: "0.1.1",
            devices: ["other-device-id", "test-device-id"],
            modified: {},
            deleted: {},
            created: initialCreated,
            ...changesOverrides
        }
        const entries = [...files.map((f) => ({ name: f.name, content: f.content })), { name: "changes.json", content: JSON.stringify(changes) }]
        const cloudZipPath = path.join(h.tempRoot, "cloud_test_" + Math.random().toString(36).substring(7) + ".zip")
        await compressToZip(entries, cloudZipPath)
        mockProviderInstance.mockCloudZipPath = cloudZipPath
    }

    beforeEach(() => {
        // clear tempDir
        if (fs.existsSync(h.tempDir)) {
            fs.rmSync(h.tempDir, { recursive: true, force: true })
            fs.mkdirSync(h.tempDir, { recursive: true })
        }
        // clear local data directories to have a clean slate for each test
        const showsDir = getDataFolderPath("shows")
        const scripturesDir = getDataFolderPath("scriptures")
        if (fs.existsSync(showsDir)) {
            fs.rmSync(showsDir, { recursive: true, force: true })
        }
        if (fs.existsSync(scripturesDir)) {
            fs.rmSync(scripturesDir, { recursive: true, force: true })
        }
        fs.mkdirSync(showsDir, { recursive: true })
        fs.mkdirSync(scripturesDir, { recursive: true })

        // Reset mock provider zip
        mockProviderInstance.mockCloudZipPath = null

        // Reset stores to default
        if (_store.PROJECTS) _store.PROJECTS.store = { projects: {}, folders: {}, projectTemplates: {} }
        if (_store.SYNCED_SETTINGS) _store.SYNCED_SETTINGS.store = {}
    })

    afterAll(() => {
        fs.rmSync(h.tempRoot, { recursive: true, force: true })
    })

    it("should upload local data to cloud (upload method)", async () => {
        // Set up some local data
        const showsDir = getDataFolderPath("shows")
        await writeFileAsync(path.join(showsDir, "test-show.show"), JSON.stringify(["test-show-id", { name: "Test Show", slides: [] }]))

        // Create some local project
        if (_store.PROJECTS) {
            _store.PROJECTS.store = {
                projects: {
                    "proj-1": { name: "Project One", date: Date.now() }
                },
                folders: {},
                projectTemplates: {}
            }
        }

        const syncResult = await syncData({
            id: "churchApps",
            churchId: "test-church",
            teamId: "test-team",
            method: "upload"
        })

        expect((syncResult as any).success).toBe(true)
        expect(mockProviderInstance.mockCloudZipPath).not.toBeNull()
        expect(fs.existsSync(mockProviderInstance.mockCloudZipPath!)).toBe(true)
    })

    it("should replace local data with cloud data (replace method)", async () => {
        // 1. Create data and upload it to get a cloud ZIP
        const showsDir = getDataFolderPath("shows")
        await writeFileAsync(path.join(showsDir, "cloud-show.show"), JSON.stringify(["cloud-show-id", { name: "Cloud Show", slides: [] }]))
        if (_store.PROJECTS) {
            _store.PROJECTS.store = {
                projects: {
                    "proj-cloud": { name: "Cloud Project", date: Date.now() }
                },
                folders: {},
                projectTemplates: {}
            }
        }
        await syncData({
            id: "churchApps",
            churchId: "test-church",
            teamId: "test-team",
            method: "upload"
        })

        // 2. Wipe/alter local state
        await writeFileAsync(path.join(showsDir, "cloud-show.show"), "") // corrupt local
        await writeFileAsync(path.join(showsDir, "local-show.show"), JSON.stringify(["local-show-id", { name: "Local Show", slides: [] }]))
        if (_store.PROJECTS) {
            _store.PROJECTS.store = { projects: { "proj-local": { name: "Local Project" } }, folders: {}, projectTemplates: {} }
        }

        // 3. Perform replace sync
        const syncResult = await syncData({
            id: "churchApps",
            churchId: "test-church",
            teamId: "test-team",
            method: "replace"
        })

        expect((syncResult as any).success).toBe(true)

        // Local show directory should now only have cloud-show.show, and local-show.show is deleted
        const files = fs.readdirSync(showsDir)
        expect(files).toContain("cloud-show.show")
        expect(files).not.toContain("local-show.show")

        // Local PROJECTS store should match the cloud PROJECTS
        if (_store.PROJECTS) {
            expect(_store.PROJECTS.store.projects["proj-cloud"]).toBeDefined()
            expect(_store.PROJECTS.store.projects["proj-local"]).toBeUndefined()
        }
    })

    it("should merge local and cloud changes (merge method)", async () => {
        // 1. Create a cloud state (with a project, a show, a bible)
        const showsDir = getDataFolderPath("shows")
        const scripturesDir = getDataFolderPath("scriptures")
        await writeFileAsync(path.join(showsDir, "show-A.show"), JSON.stringify(["show-A-id", { name: "Show A", slides: [] }]))
        await writeFileAsync(path.join(scripturesDir, "Bible-A.txt"), "Genesis 1:1")
        if (_store.PROJECTS) {
            _store.PROJECTS.store = {
                projects: {
                    "proj-A": { name: "Project A", modified: 1000 }
                },
                folders: {},
                projectTemplates: {}
            }
        }
        await syncData({
            id: "churchApps",
            churchId: "test-church",
            teamId: "test-team",
            method: "upload"
        })

        // 2. Modify local state (create show-B, create proj-B, create Bible-B)
        // Also delete show-A, proj-A locally to see if it deletes in cloud or what
        await writeFileAsync(path.join(showsDir, "show-B.show"), JSON.stringify(["show-B-id", { name: "Show B", slides: [] }]))
        await writeFileAsync(path.join(scripturesDir, "Bible-B.txt"), "Exodus 1:1")

        // Remove show-A and Bible-A locally (simulating deletion)
        fs.unlinkSync(path.join(showsDir, "show-A.show"))
        fs.unlinkSync(path.join(scripturesDir, "Bible-A.txt"))

        if (_store.PROJECTS) {
            _store.PROJECTS.store = {
                projects: {
                    "proj-B": { name: "Project B", modified: 2000 }
                },
                folders: {},
                projectTemplates: {}
            }
        }

        // 3. Merge sync
        const syncResult = await syncData({
            id: "churchApps",
            churchId: "test-church",
            teamId: "test-team",
            method: "merge"
        })

        expect((syncResult as any).success).toBe(true)

        // Show B and Bible B should exist locally
        expect(fs.existsSync(path.join(showsDir, "show-B.show"))).toBe(true)
        expect(fs.existsSync(path.join(scripturesDir, "Bible-B.txt"))).toBe(true)

        // Verify that Show B and Bible B are now locally present
        const localShows = fs.readdirSync(showsDir)
        expect(localShows).toContain("show-B.show")
    })

    describe("explicit sync logic scenarios from comments", () => {
        it("Scenario 1: if not found locally, and marked as 'deleted' in cloud: skip", async () => {
            const showsDir = getDataFolderPath("shows")

            const dummyShowContent = JSON.stringify(["dummy-id", { name: "Dummy Show", slides: [], timestamps: { modified: Date.now() } }])
            // Set up cloud state where show is marked deleted, and not present in zip
            await createCloudState([{ name: "SHOWS/dummy.show", content: dummyShowContent }], {
                deleted: { "SHOWS_CONTENT_show-deleted.show": ["other-device-id"] }
            })

            // Run merge sync
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // The file should NOT exist locally
            expect(fs.existsSync(path.join(showsDir, "show-deleted.show"))).toBe(false)
        })

        it("Scenario 2: if not found locally, and marked as 'created' in cloud: download", async () => {
            const showsDir = getDataFolderPath("shows")

            const showContent = JSON.stringify(["show-created-id", { name: "Show Created", slides: [], timestamps: { modified: Date.now() } }])
            await createCloudState([{ name: "SHOWS/show-created.show", content: showContent }], {
                created: { "SHOWS_CONTENT_show-created.show": ["other-device-id"] }
            })

            // Run merge sync
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // The file should be downloaded locally
            expect(fs.existsSync(path.join(showsDir, "show-created.show"))).toBe(true)
        })

        it("Scenario 3 & 4: if not found locally, but not marked in cloud: mark as 'deleted' / if found locally only, and not marked in cloud: mark as 'created'", async () => {
            const showsDir = getDataFolderPath("shows")
            await writeFileAsync(path.join(showsDir, "show-local-only.show"), JSON.stringify(["show-local-only-id", { name: "Show Local Only", slides: [], timestamps: { modified: Date.now() } }]))

            await createCloudState([], {})
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // The local file should remain
            expect(fs.existsSync(path.join(showsDir, "show-local-only.show"))).toBe(true)
        })

        it("Scenario 5: if found locally, but marked as 'deleted' in cloud: delete locally", async () => {
            const showsDir = getDataFolderPath("shows")
            await writeFileAsync(path.join(showsDir, "show-to-delete.show"), JSON.stringify(["show-to-delete-id", { name: "Show To Delete", slides: [], timestamps: { modified: Date.now() } }]))

            const dummyShowContent = JSON.stringify(["dummy-id", { name: "Dummy Show", slides: [], timestamps: { modified: Date.now() } }])
            await createCloudState([{ name: "SHOWS/dummy.show", content: dummyShowContent }], {
                deleted: { "SHOWS_CONTENT_show-to-delete.show": ["other-device-id"] }
            })

            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            expect(fs.existsSync(path.join(showsDir, "show-to-delete.show"))).toBe(false)
        })

        it("Scenario 6: if found locally and in cloud: use newest version", async () => {
            const showsDir = getDataFolderPath("shows")

            // Local has old modified date
            const oldShow = ["show-mod-id", { name: "Show Old Version", slides: [], timestamps: { modified: 1000 } }]
            await writeFileAsync(path.join(showsDir, "show-mod.show"), JSON.stringify(oldShow))

            // Cloud has newer modified date
            const newShow = ["show-mod-id", { name: "Show New Version", slides: [], timestamps: { modified: 5000 } }]
            await createCloudState([{ name: "SHOWS/show-mod.show", content: JSON.stringify(newShow) }], {})

            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // Local version should be updated to the cloud version (new version)
            const content = fs.readFileSync(path.join(showsDir, "show-mod.show"), "utf-8")
            expect(content).toContain("Show New Version")
        })

        it("Scenario 7: if marked as deleted locally in cloud, but exists locally: unmark as deleted and mark as created", async () => {
            const showsDir = getDataFolderPath("shows")
            await writeFileAsync(path.join(showsDir, "show-revive.show"), JSON.stringify(["show-revive-id", { name: "Show Revive", slides: [], timestamps: { modified: Date.now() } }]))

            const dummyShowContent = JSON.stringify(["dummy-id", { name: "Dummy Show", slides: [], timestamps: { modified: Date.now() } }])
            await createCloudState([{ name: "SHOWS/dummy.show", content: dummyShowContent }], {
                deleted: { "SHOWS_CONTENT_show-revive.show": ["test-device-id"] }
            })

            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // The file should survive locally
            expect(fs.existsSync(path.join(showsDir, "show-revive.show"))).toBe(true)
        })
    })

    describe("multiple machines syncing workflow", () => {
        it("should successfully sync workflows between Device A and Device B", async () => {
            // 1. Device A creates a show and uploads it to the cloud
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()

            const showsDirA = getDataFolderPath("shows")
            const showContent = JSON.stringify(["multi-show-id", { name: "Multi Show", slides: [], timestamps: { modified: 1000 } }])
            await writeFileAsync(path.join(showsDirA, "multi-show.show"), showContent)

            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // Verify cloud ZIP is created
            expect(mockProviderInstance.mockCloudZipPath).not.toBeNull()

            // 2. Device B syncs with the cloud and downloads Device A's show
            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()

            const showsDirB = getDataFolderPath("shows")
            // Initially, Device B does not have the show
            expect(fs.existsSync(path.join(showsDirB, "multi-show.show"))).toBe(false)

            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // Now Device B should have downloaded the show
            expect(fs.existsSync(path.join(showsDirB, "multi-show.show"))).toBe(true)

            // 3. Device B modifies the show locally and uploads
            const updatedShowContent = JSON.stringify(["multi-show-id", { name: "Multi Show Updated", slides: [], timestamps: { modified: 5000 } }])
            await writeFileAsync(path.join(showsDirB, "multi-show.show"), updatedShowContent)

            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 4. Device A syncs and receives Device B's updates
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()

            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            const contentOnA = fs.readFileSync(path.join(showsDirA, "multi-show.show"), "utf8")
            expect(contentOnA).toContain("Multi Show Updated")
        })

        it("should successfully sync projects (create, modify, delete) between Device A and Device B", async () => {
            // Register devices in the ledger
            await createCloudState([{ name: "SHOWS/dummy.show", content: JSON.stringify(["dummy", { name: "Dummy", slides: [], timestamps: { modified: Date.now() } }]) }], {
                devices: ["device-A", "device-B", "test-device-id"],
                modified: {
                    "device-A": Date.now(),
                    "device-B": Date.now(),
                    "test-device-id": Date.now()
                }
            })

            const fileA = path.join(h.userDataDir, "device-A", "projects.json")
            const fileB = path.join(h.userDataDir, "device-B", "projects.json")

            // 1. Device A creates a project and uploads
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()

            const projectStoreA = { projects: { "proj-1": { id: "proj-1", name: "Project A", modified: 1000 } }, folders: {}, projectTemplates: {} }
            fs.mkdirSync(path.dirname(fileA), { recursive: true })
            fs.writeFileSync(fileA, JSON.stringify(projectStoreA))

            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 2. Device B syncs and downloads the project
            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()

            // Initially, Device B does not have the project
            const projectStoreB = { projects: {}, folders: {}, projectTemplates: {} }
            fs.mkdirSync(path.dirname(fileB), { recursive: true })
            fs.writeFileSync(fileB, JSON.stringify(projectStoreB))

            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // Verify downloaded state on disk for B
            const projectStoreB_updated = JSON.parse(fs.readFileSync(fileB, "utf8"))
            expect(projectStoreB_updated.projects["proj-1"]).toEqual({ id: "proj-1", name: "Project A", modified: 1000 })

            // 3. Device B modifies the project and syncs
            projectStoreB_updated.projects["proj-1"] = { id: "proj-1", name: "Project B Modified", modified: 5000 }
            fs.writeFileSync(fileB, JSON.stringify(projectStoreB_updated))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 4. Device A syncs and receives the modification
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()

            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            const projectStoreA_updated = JSON.parse(fs.readFileSync(fileA, "utf8"))
            expect(projectStoreA_updated.projects["proj-1"]).toEqual({ id: "proj-1", name: "Project B Modified", modified: 5000 })

            // 5. Device A deletes the project and syncs
            delete projectStoreA_updated.projects["proj-1"]
            fs.writeFileSync(fileA, JSON.stringify(projectStoreA_updated))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 6. Device B syncs and deletes the project locally
            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()

            // Restore Device B to its modified state before B's sync runs to verify deletion
            const projectStoreB_preDelete = { projects: { "proj-1": { id: "proj-1", name: "Project B Modified", modified: 5000 } }, folders: {}, projectTemplates: {} }
            fs.writeFileSync(fileB, JSON.stringify(projectStoreB_preDelete))

            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            const projectStoreB_final = JSON.parse(fs.readFileSync(fileB, "utf8"))
            expect(projectStoreB_final.projects["proj-1"]).toBeUndefined()
        })

        it("should force read-only mode if device's local state is stale relative to the cloud ledger (30+ days)", async () => {
            const now = Date.now()
            const staleTime = now - 32 * 24 * 60 * 60 * 1000 // 32 days ago

            // Register devices in the cloud ledger
            await createCloudState([{ name: "SHOWS/dummy.show", content: JSON.stringify(["dummy", { name: "Dummy", slides: [], timestamps: { modified: now } }]) }], {
                devices: ["device-A", "device-B"],
                modified: {
                    "device-A": staleTime, // Device A last synced 32 days ago
                    "device-B": now // Device B synced just now (latest cloud modified)
                }
            })

            // Run Device A sync
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()

            // We make a local change on Device A (create a show)
            const showsDirA = getDataFolderPath("shows")
            fs.mkdirSync(showsDirA, { recursive: true })
            const localShowContent = JSON.stringify(["local-show-id", { name: "Local Show A", slides: [], timestamps: { modified: now } }])
            await writeFileAsync(path.join(showsDirA, "local-show.show"), localShowContent)

            // Sync. This should trigger the stale merge guard and force A into read-only mode.
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // Verify that Device A's changes were NOT uploaded to the cloud zip since it ran in read-only mode
            // We can check if Device A's local-show.show exists in the cloud zip (it should not)
            const zipPath = mockProviderInstance.mockCloudZipPath
            expect(zipPath).not.toBeNull()

            // Decompress the cloud zip to inspect
            const extractPath = path.join(h.tempRoot, "inspect_stale_zip")
            const files = await decompressZipStream(zipPath!, false, {
                getOutputPath: (fileName: string) => path.join(extractPath, fileName)
            })

            const hasLocalShow = files.some((f) => f.name.includes("local-show.show"))
            expect(hasLocalShow).toBe(false) // Stale device should not have uploaded local changes
        })

        it("should download cloud updates but not upload local modifications when method is 'read_only'", async () => {
            const now = Date.now()

            // 1. Initial cloud state has a show (cloud-show)
            await createCloudState([{ name: "SHOWS/cloud-show.show", content: JSON.stringify(["cloud-show-id", { name: "Cloud Show", slides: [], timestamps: { modified: now } }]) }], {
                devices: ["device-A"],
                modified: {
                    "device-A": now
                }
            })

            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()

            // 2. Create a local show on Device A
            const showsDirA = getDataFolderPath("shows")
            fs.mkdirSync(showsDirA, { recursive: true })
            const localShowContent = JSON.stringify(["local-show-id", { name: "Local Show A", slides: [], timestamps: { modified: now } }])
            await writeFileAsync(path.join(showsDirA, "local-show.show"), localShowContent)

            // 3. Sync using method: "read_only"
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "read_only" })

            // 4. Verify Device A downloaded the cloud-show.show
            expect(fs.existsSync(path.join(showsDirA, "cloud-show.show"))).toBe(true)

            // 5. Verify Device A did NOT upload its local-show.show to the cloud
            const zipPath = mockProviderInstance.mockCloudZipPath
            expect(zipPath).not.toBeNull()

            const extractPath = path.join(h.tempRoot, "inspect_readonly_zip")
            const files = await decompressZipStream(zipPath!, false, {
                getOutputPath: (fileName: string) => path.join(extractPath, fileName)
            })

            const hasLocalShow = files.some((f) => f.name.includes("local-show.show"))
            expect(hasLocalShow).toBe(false) // Read-only sync should not push changes to the cloud
        })

        it("should successfully upload unique shows from a new device joining the sync team and not delete them on subsequent syncs", async () => {
            const now = Date.now()

            // 1. Initial cloud setup: Device A and Device B are synced
            await createCloudState([
                { name: "SHOWS/dummy.show", content: JSON.stringify(["dummy", { name: "Dummy", slides: [], timestamps: { modified: now } }]) }
            ], {
                devices: ["device-A", "device-B", "test-device-id"],
                modified: {
                    "device-A": now,
                    "device-B": now,
                    "test-device-id": now
                }
            })

            // 2. Device C (new device) joins with a unique show
            h.currentMachineId = "device-C"
            resetSyncManagerModule()
            createStores()

            const showsDirC = getDataFolderPath("shows")
            fs.mkdirSync(showsDirC, { recursive: true })
            const uniqueShowContent = JSON.stringify(["c-unique-id", { name: "C Unique Show", slides: [], timestamps: { modified: now } }])
            await writeFileAsync(path.join(showsDirC, "c-unique.show"), uniqueShowContent)

            // C syncs (uploads its unique show as a new device)
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 3. Device A syncs. It should download Device C's unique show (NOT mark it as deleted!)
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()

            const showsDirA = getDataFolderPath("shows")
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            expect(fs.existsSync(path.join(showsDirA, "c-unique.show"))).toBe(true)

            // 4. Device C syncs again. Its unique show should NOT be deleted!
            h.currentMachineId = "device-C"
            resetSyncManagerModule()
            createStores()

            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            expect(fs.existsSync(path.join(showsDirC, "c-unique.show"))).toBe(true)
        })
    })

    describe("multiple machines sync scenarios", () => {
        it("Scenario 1: if not found locally, and marked as 'deleted' in cloud: skip", async () => {
            // Register devices in the cloud ledger
            await createCloudState([{ name: "SHOWS/dummy.show", content: JSON.stringify(["dummy", { name: "Dummy", slides: [], timestamps: { modified: Date.now() } }]) }], {
                devices: ["device-A", "device-B", "device-C", "test-device-id"],
                modified: {
                    "device-A": Date.now(),
                    "device-B": Date.now(),
                    "device-C": Date.now(),
                    "test-device-id": Date.now()
                }
            })

            // Device A creates a show, uploads
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()
            const showsDirA = getDataFolderPath("shows")
            await writeFileAsync(path.join(showsDirA, "scenario-1.show"), JSON.stringify(["scen-1", { name: "Scen 1", slides: [], timestamps: { modified: Date.now() } }]))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // Device B downloads it
            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()
            const showsDirB = getDataFolderPath("shows")
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            expect(fs.existsSync(path.join(showsDirB, "scenario-1.show"))).toBe(true)

            // Device B deletes it and syncs (uploads deletion)
            fs.unlinkSync(path.join(showsDirB, "scenario-1.show"))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // Device C (which never had it) syncs. It should NOT download it because it is marked deleted in the cloud.
            h.currentMachineId = "device-C"
            resetSyncManagerModule()
            createStores()
            const showsDirC = getDataFolderPath("shows")
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            expect(fs.existsSync(path.join(showsDirC, "scenario-1.show"))).toBe(false)
        })

        it("Scenario 2: if not found locally, and marked as 'created' in cloud: download", async () => {
            // Register devices in the cloud ledger
            await createCloudState([{ name: "SHOWS/dummy.show", content: JSON.stringify(["dummy", { name: "Dummy", slides: [], timestamps: { modified: Date.now() } }]) }], {
                devices: ["device-A", "device-B", "device-C", "test-device-id"],
                modified: {
                    "device-A": Date.now(),
                    "device-B": Date.now(),
                    "device-C": Date.now(),
                    "test-device-id": Date.now()
                }
            })

            // Device A creates a show, uploads
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()
            const showsDirA = getDataFolderPath("shows")
            await writeFileAsync(path.join(showsDirA, "scenario-2.show"), JSON.stringify(["scen-2", { name: "Scen 2", slides: [], timestamps: { modified: Date.now() } }]))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // Device B (which does not have it locally) syncs and downloads it
            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()
            const showsDirB = getDataFolderPath("shows")
            expect(fs.existsSync(path.join(showsDirB, "scenario-2.show"))).toBe(false)
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            expect(fs.existsSync(path.join(showsDirB, "scenario-2.show"))).toBe(true)
        })

        it("Scenario 3 & 4: if found locally only, and not marked in cloud: mark as 'created' / if not found locally, but not marked in cloud: mark as 'deleted'", async () => {
            // Register devices in the cloud ledger
            await createCloudState([{ name: "SHOWS/dummy.show", content: JSON.stringify(["dummy", { name: "Dummy", slides: [], timestamps: { modified: Date.now() } }]) }], {
                devices: ["device-A", "device-B", "device-C", "test-device-id"],
                modified: {
                    "device-A": Date.now(),
                    "device-B": Date.now(),
                    "device-C": Date.now(),
                    "test-device-id": Date.now()
                }
            })

            // Scenario 4: Device A has a show locally only.
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()
            const showsDirA = getDataFolderPath("shows")
            await writeFileAsync(path.join(showsDirA, "scenario-3-4.show"), JSON.stringify(["scen-3-4", { name: "Scen 3-4", slides: [], timestamps: { modified: Date.now() } }]))

            // Syncing will mark it as created in the ledger because it exists locally only
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // Now, we simulate Scenario 3 by downloading on Device B
            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()
            const showsDirB = getDataFolderPath("shows")
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            expect(fs.existsSync(path.join(showsDirB, "scenario-3-4.show"))).toBe(true)
        })

        it("Scenario 5: if found locally, but marked as 'deleted' in cloud: delete locally", async () => {
            // Register devices in the cloud ledger
            await createCloudState([{ name: "SHOWS/dummy.show", content: JSON.stringify(["dummy", { name: "Dummy", slides: [], timestamps: { modified: Date.now() } }]) }], {
                devices: ["device-A", "device-B", "device-C", "test-device-id"],
                modified: {
                    "device-A": Date.now(),
                    "device-B": Date.now(),
                    "device-C": Date.now(),
                    "test-device-id": Date.now()
                }
            })

            // Device A creates a show and a dummy show, uploads
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()
            const showsDirA = getDataFolderPath("shows")
            await writeFileAsync(path.join(showsDirA, "scenario-5.show"), JSON.stringify(["scen-5", { name: "Scen 5", slides: [], timestamps: { modified: Date.now() } }]))
            await writeFileAsync(path.join(showsDirA, "scenario-5-dummy.show"), JSON.stringify(["scen-5-dummy", { name: "Scen 5 Dummy", slides: [], timestamps: { modified: Date.now() } }]))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // Device B downloads both
            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()
            const showsDirB = getDataFolderPath("shows")
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            expect(fs.existsSync(path.join(showsDirB, "scenario-5.show"))).toBe(true)
            expect(fs.existsSync(path.join(showsDirB, "scenario-5-dummy.show"))).toBe(true)

            // Device A deletes the show (but keeps dummy) and uploads deletion
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()
            fs.unlinkSync(path.join(showsDirA, "scenario-5.show"))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // Device B syncs and deletes scenario-5.show locally
            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            expect(fs.existsSync(path.join(showsDirB, "scenario-5.show"))).toBe(false)
            expect(fs.existsSync(path.join(showsDirB, "scenario-5-dummy.show"))).toBe(true)
        })

        it("Scenario 6: if found locally and in cloud: use newest version", async () => {
            // Register devices in the cloud ledger
            await createCloudState([{ name: "SHOWS/dummy.show", content: JSON.stringify(["dummy", { name: "Dummy", slides: [], timestamps: { modified: Date.now() } }]) }], {
                devices: ["device-A", "device-B", "device-C", "test-device-id"],
                modified: {
                    "device-A": Date.now(),
                    "device-B": Date.now(),
                    "device-C": Date.now(),
                    "test-device-id": Date.now()
                }
            })

            // Device A uploads an old version (modified: 1000)
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()
            const showsDirA = getDataFolderPath("shows")
            await writeFileAsync(path.join(showsDirA, "scenario-6.show"), JSON.stringify(["scen-6", { name: "Scen 6 Version A", slides: [], timestamps: { modified: 1000 } }]))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // Device B downloads it
            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()
            const showsDirB = getDataFolderPath("shows")
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // Device B modifies it with a newer timestamp (modified: 5000) and syncs
            await writeFileAsync(path.join(showsDirB, "scenario-6.show"), JSON.stringify(["scen-6", { name: "Scen 6 Version B", slides: [], timestamps: { modified: 5000 } }]))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // Device A modifies it with an older timestamp (modified: 2000)
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()
            await writeFileAsync(path.join(showsDirA, "scenario-6.show"), JSON.stringify(["scen-6", { name: "Scen 6 Version A Modified", slides: [], timestamps: { modified: 2000 } }]))

            // Device A syncs. Since Device B's cloud version is newer (5000 > 2000), Device A should be updated to B's version
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            const content = fs.readFileSync(path.join(showsDirA, "scenario-6.show"), "utf8")
            expect(content).toContain("Scen 6 Version B")
        })

        it("Scenario 7: if marked as deleted locally in cloud, but exists locally: unmark as deleted and mark as created", async () => {
            // Register devices in the cloud ledger
            await createCloudState([{ name: "SHOWS/dummy.show", content: JSON.stringify(["dummy", { name: "Dummy", slides: [], timestamps: { modified: Date.now() } }]) }], {
                devices: ["device-A", "device-B", "device-C", "test-device-id"],
                modified: {
                    "device-A": Date.now(),
                    "device-B": Date.now(),
                    "device-C": Date.now(),
                    "test-device-id": Date.now()
                }
            })

            // 1. Device A creates a show and uploads
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()
            const showsDirA = getDataFolderPath("shows")
            await writeFileAsync(path.join(showsDirA, "scenario-7.show"), JSON.stringify(["scen-7", { name: "Scen 7", slides: [], timestamps: { modified: 1000 } }]))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 2. Device A deletes the show locally and syncs (uploads A's deletion)
            fs.unlinkSync(path.join(showsDirA, "scenario-7.show"))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 3. Device A restores/creates the show again locally
            await writeFileAsync(path.join(showsDirA, "scenario-7.show"), JSON.stringify(["scen-7", { name: "Scen 7 Revived", slides: [], timestamps: { modified: 2000 } }]))

            // 4. Device A syncs again.
            // Since it exists locally on A, but the cloud ledger says "device-A" deleted it,
            // A should unmark it as deleted, mark it as created, and upload it!
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            expect(fs.existsSync(path.join(showsDirA, "scenario-7.show"))).toBe(true)

            // 5. Device B syncs. It should download it!
            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()
            const showsDirB = getDataFolderPath("shows")
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            expect(fs.existsSync(path.join(showsDirB, "scenario-7.show"))).toBe(true)
        })

        it("Scenario 8: if Device A deletes all shows, Device B should delete all local shows upon sync (prevent resurrection)", async () => {
            // Register devices in the cloud ledger
            await createCloudState([{ name: "SHOWS/dummy.show", content: JSON.stringify(["dummy", { name: "Dummy", slides: [], timestamps: { modified: Date.now() } }]) }], {
                devices: ["device-A", "device-B", "device-C", "test-device-id"],
                modified: {
                    "device-A": Date.now(),
                    "device-B": Date.now(),
                    "device-C": Date.now(),
                    "test-device-id": Date.now()
                }
            })

            // 1. Device A creates a show, uploads
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()
            const showsDirA = getDataFolderPath("shows")
            await writeFileAsync(path.join(showsDirA, "scenario-8.show"), JSON.stringify(["scen-8", { name: "Scen 8", slides: [], timestamps: { modified: Date.now() } }]))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 2. Device B downloads it
            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()
            const showsDirB = getDataFolderPath("shows")
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            expect(fs.existsSync(path.join(showsDirB, "scenario-8.show"))).toBe(true)

            // 3. Device A deletes ALL shows (including dummy) and uploads empty state
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()
            fs.unlinkSync(path.join(showsDirA, "scenario-8.show"))
            const dummyA = path.join(showsDirA, "dummy.show")
            if (fs.existsSync(dummyA)) fs.unlinkSync(dummyA)
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 4. Device B syncs. Since the cloud has NO shows, B should still propagate deletions and delete both scenario-8.show and dummy.show
            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            expect(fs.existsSync(path.join(showsDirB, "scenario-8.show"))).toBe(false)
            expect(fs.existsSync(path.join(showsDirB, "dummy.show"))).toBe(false)
        })
    })

    describe("three-machine sync scenarios", () => {
        it("should resolve modification conflicts correctly when Device B and Device C both modify the same project", async () => {
            const now = Date.now()
            
            // Register devices in the ledger
            await createCloudState([
                { name: "SHOWS/dummy.show", content: JSON.stringify(["dummy", { name: "Dummy", slides: [], timestamps: { modified: now } }]) }
            ], {
                devices: ["device-A", "device-B", "device-C", "test-device-id"],
                modified: {
                    "device-A": now,
                    "device-B": now,
                    "device-C": now,
                    "test-device-id": now
                }
            })

            const fileA = path.join(h.userDataDir, "device-A", "projects.json")
            const fileB = path.join(h.userDataDir, "device-B", "projects.json")
            const fileC = path.join(h.userDataDir, "device-C", "projects.json")

            // 1. Device A creates a project and syncs
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()

            const projectStoreA = { projects: { "proj-shared": { id: "proj-shared", name: "Original Project", modified: 1000 } }, folders: {}, projectTemplates: {} }
            fs.mkdirSync(path.dirname(fileA), { recursive: true })
            fs.writeFileSync(fileA, JSON.stringify(projectStoreA))

            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 2. Device B downloads the project
            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()
            
            fs.mkdirSync(path.dirname(fileB), { recursive: true })
            fs.writeFileSync(fileB, JSON.stringify({ projects: {}, folders: {}, projectTemplates: {} }))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 3. Device C downloads the project
            h.currentMachineId = "device-C"
            resetSyncManagerModule()
            createStores()
            
            fs.mkdirSync(path.dirname(fileC), { recursive: true })
            fs.writeFileSync(fileC, JSON.stringify({ projects: {}, folders: {}, projectTemplates: {} }))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 4. Device B modifies the project with an older change (modified = 5000) and syncs
            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()

            const projectStoreB_updated = JSON.parse(fs.readFileSync(fileB, "utf8"))
            projectStoreB_updated.projects["proj-shared"] = { id: "proj-shared", name: "Project Modified by B", modified: 5000 }
            fs.writeFileSync(fileB, JSON.stringify(projectStoreB_updated))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 5. Device C modifies the project with a newer change (modified = 10000) and syncs
            h.currentMachineId = "device-C"
            resetSyncManagerModule()
            createStores()

            const projectStoreC_updated = JSON.parse(fs.readFileSync(fileC, "utf8"))
            projectStoreC_updated.projects["proj-shared"] = { id: "proj-shared", name: "Project Modified by C (Newest)", modified: 10000 }
            fs.writeFileSync(fileC, JSON.stringify(projectStoreC_updated))
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 6. Device A and B sync again to receive the newest modification (from C)
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            
            const projectStoreA_final = JSON.parse(fs.readFileSync(fileA, "utf8"))
            expect(projectStoreA_final.projects["proj-shared"].name).toBe("Project Modified by C (Newest)")

            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            
            const projectStoreB_final = JSON.parse(fs.readFileSync(fileB, "utf8"))
            expect(projectStoreB_final.projects["proj-shared"].name).toBe("Project Modified by C (Newest)")
        })

        it("should successfully propagate show creations among three machines (Device A, B, and C)", async () => {
            const now = Date.now()
            
            // Register devices in the ledger
            await createCloudState([
                { name: "SHOWS/dummy.show", content: JSON.stringify(["dummy", { name: "Dummy", slides: [], timestamps: { modified: now } }]) }
            ], {
                devices: ["device-A", "device-B", "device-C", "test-device-id"],
                modified: {
                    "device-A": now,
                    "device-B": now,
                    "device-C": now,
                    "test-device-id": now
                }
            })

            const showsDirA = path.join(h.userDataDir, "device-A", "Shows")
            const showsDirB = path.join(h.userDataDir, "device-B", "Shows")
            const showsDirC = path.join(h.userDataDir, "device-C", "Shows")

            // 1. Device A creates show-A and syncs
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()

            const showAContent = JSON.stringify(["show-A-id", { name: "Show A", slides: [], timestamps: { modified: 1000 } }])
            fs.mkdirSync(showsDirA, { recursive: true })
            await writeFileAsync(path.join(showsDirA, "show-A.show"), showAContent)
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 2. Device B syncs (downloads show-A), creates show-B, and syncs
            h.currentMachineId = "device-B"
            resetSyncManagerModule()
            createStores()

            fs.mkdirSync(showsDirB, { recursive: true })
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            expect(fs.existsSync(path.join(showsDirB, "show-A.show"))).toBe(true)

            const showBContent = JSON.stringify(["show-B-id", { name: "Show B", slides: [], timestamps: { modified: 2000 } }])
            await writeFileAsync(path.join(showsDirB, "show-B.show"), showBContent)
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })

            // 3. Device C syncs. It should download both show-A and show-B
            h.currentMachineId = "device-C"
            resetSyncManagerModule()
            createStores()

            fs.mkdirSync(showsDirC, { recursive: true })
            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            expect(fs.existsSync(path.join(showsDirC, "show-A.show"))).toBe(true)
            expect(fs.existsSync(path.join(showsDirC, "show-B.show"))).toBe(true)

            // 4. Device A syncs again and downloads show-B
            h.currentMachineId = "device-A"
            resetSyncManagerModule()
            createStores()

            await syncData({ id: "churchApps", churchId: "test-church", teamId: "test-team", method: "merge" })
            expect(fs.existsSync(path.join(showsDirA, "show-B.show"))).toBe(true)
        })
    })
})
