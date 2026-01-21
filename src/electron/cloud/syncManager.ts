import { app } from "electron"
import path from "path"
import { Main } from "../../types/IPC/Main"
import type { Folders, Projects } from "../../types/Projects"
import type { Show } from "../../types/Show"
import { isValidJSON, startBackup } from "../data/backup"
import { _store, setStore } from "../data/store"
import { compressToZip, decompressZipStream, getZipModifiedDates } from "../data/zip"
import { sendMain } from "../IPC/main"
import { createFolder, deleteFile, deleteFolder, doesPathExistAsync, getDataFolderPath, getFileStatsAsync, getTimePointString, loadShows, moveFileAsync, readFileAsync, readFolderAsync, writeFileAsync } from "../utils/files"
import { clone, getMachineId } from "../utils/helpers"
import { getChurchAppsSyncManager } from "./ChurchAppsSyncManager"

export type SyncProviderId = "churchApps"
const getManager = {
    churchApps: getChurchAppsSyncManager
}

export async function canSync({ id }: { id: SyncProviderId } = { id: "churchApps" }): Promise<boolean> {
    const provider = getManager[id]()
    if (!provider) return false

    return await provider.hasValidConnection()
}

export async function getSyncTeams({ id }: { id: SyncProviderId } = { id: "churchApps" }): Promise<{ id: string; churchId: string; name: string }[]> {
    const provider = getManager[id]()
    if (!provider) return []

    return provider.getTeams()
}

export async function hasTeamData({ id, churchId, teamId }: { id: SyncProviderId; churchId: string; teamId: string }) {
    const provider = getManager[id]()
    if (!provider) return false

    return await provider.existingData(churchId, teamId)
}

export async function hasDataChanged({ id, churchId, teamId }: { id: SyncProviderId; churchId: string; teamId: string }) {
    const provider = getManager[id]()
    if (!provider) return false

    return await provider.hasChanged(churchId, teamId)
}

function deleteLocalFiles() {
    // reset syncable (portable) Config files
    // no need, these will get auto replaced by the downloaded files
    // Object.entries(storeFilesData).forEach(([id, data]) => {
    //     if (!data.portable && id !== "MEDIA") return
    //     // reset
    // })

    // delete all show files
    const showsPath = getDataFolderPath("shows")
    deleteFolder(showsPath)
}

const EXTRACT_LOCATION = path.join(app.getPath("temp"), "freeshow-cloud")
const MERGE_INDIVIDUAL = ["OVERLAYS", "PROJECTS", "STAGE", "TEMPLATES"] // "EVENTS", "THEMES"

export async function syncData(data: { id: SyncProviderId; churchId: string; teamId: string; method: "merge" | "read_only" | "upload" | "replace" }) {
    const readOnly = data.method === "read_only" || data.method === "replace" // never write to cloud
    const changedFiles: string[] = [] // WIP write changes

    const provider = getManager[data.id]()
    if (!provider) return { changedFiles }

    if (data.method === "replace") deleteLocalFiles()

    console.log("Syncing to cloud")

    if (data.method === "upload") {
        await uploadLocalData()
        return finish()
    }

    // clear any uncleared previous data
    if (await doesPathExistAsync(EXTRACT_LOCATION)) deleteFolder(EXTRACT_LOCATION)

    const cloudDataPath = await provider.getData(data.churchId, data.teamId, EXTRACT_LOCATION)
    if (!cloudDataPath) {
        await uploadLocalData()
        return finish()
    }

    // extract cloud data
    createFolder(EXTRACT_LOCATION) // should already be created
    const extractedFiles = await decompressZipStream(cloudDataPath, true, {
        getOutputPath: (fileName: string) => path.join(EXTRACT_LOCATION, fileName)
    })
    const modifiedDates = await getZipModifiedDates(cloudDataPath)
    console.log("Files:", extractedFiles.length)

    const showsFolder = getDataFolderPath("shows")
    const biblesFolder = getDataFolderPath("scriptures")

    const changesFile = extractedFiles.find((file) => file.name === changes_name)
    if (typeof changesFile?.content === "string") {
        const changesContent = await readFileAsync(changesFile.content)
        if (isValidJSON(changesContent)) CHANGES = JSON.parse(changesContent)
        if (CHANGES.version !== version) CHANGES = clone(DEFAULT_CHANGES)
        cloudChanges = clone(CHANGES)
        isNewDevice = !CHANGES.devices.find((id) => id === deviceId)
    }
    // console.log("Devices:", CHANGES.devices)

    // MERGE
    let cloudBibleNames: string[] = []
    await Promise.all(
        extractedFiles.map(async (file) => {
            if (file.name === changes_name) return
            if (typeof file.content !== "string") return
            const cloudPath = file.content

            // download new/modified Bibles
            if (file.name.startsWith("BIBLE_")) {
                try {
                    const bibleName = file.name.replace("BIBLE_", "")
                    cloudBibleNames.push(bibleName)

                    if (isDeleted("BIBLES", bibleName)) return

                    const bibleDestPath = path.join(biblesFolder, bibleName)

                    // exists only in cloud
                    const existsLocally = await doesPathExistAsync(bibleDestPath)
                    if (!existsLocally) {
                        if (isCreated("BIBLES", bibleName)) await download()
                        else markAsDeleted("BIBLES", bibleName)
                        return
                    }

                    // exists both locally and in cloud
                    if (await cloudIsNewer(bibleDestPath, modifiedDates[file.name])) await download()

                    async function download() {
                        await moveFileAsync(cloudPath, bibleDestPath)
                    }
                } catch (err) {
                    console.error("Failed to write bible:", file.name, err)
                }
                return
            }

            const cloudFile = await readFileAsync(cloudPath)
            if (!isValidJSON(cloudFile)) return
            const cloudFileData = JSON.parse(cloudFile)

            const id = path.basename(file.name, path.extname(file.name)) as keyof typeof _store

            // download new/modified shows
            if (file.name === "SHOWS_CONTENT.json") {
                let cloudShowNames: string[] = []
                let replacedShows: string[] = []

                await Promise.all(
                    Object.entries<Show>(cloudFileData).map(async ([id, show]) => {
                        try {
                            const fileName = (show.name || id) + ".show"
                            cloudShowNames.push(fileName)

                            if (isDeleted("SHOWS_CONTENT", fileName)) return

                            const localShowPath = path.join(showsFolder, fileName)
                            const localFile = await readFileAsync(localShowPath)

                            const cloudModTime = show.timestamps?.modified || show.timestamps?.created
                            if (!cloudModTime) return

                            // exists only in cloud
                            const existsLocally = !!localFile
                            if (!existsLocally) {
                                if (isCreated("SHOWS_CONTENT", fileName)) await download()
                                else markAsDeleted("SHOWS_CONTENT", fileName)
                                return
                            }

                            if (!isValidJSON(localFile)) {
                                await download()
                                return
                            }

                            const localShow: Show = JSON.parse(localFile)[1]
                            const localModTime = localShow.timestamps?.modified || localShow.timestamps?.created

                            // exists both locally and in cloud
                            const cloudIsNewer = cloudModTime > localModTime
                            if (cloudIsNewer) {
                                replacedShows.push(show.name)
                                await download()
                            }

                            async function download() {
                                await writeFileAsync(localShowPath, JSON.stringify([id, show]))
                            }
                        } catch (err) {
                            console.error("Failed to write show:", show.name, err)
                        }
                    })
                )

                // check any local instance not in cloud (exists only locally)
                const showNames = await readFolderAsync(showsFolder)
                const localShows = showNames.filter((key) => !cloudShowNames.includes(key))
                await Promise.all(
                    localShows.map(async (fileName) => {
                        const localShowPath = path.join(showsFolder, fileName)
                        await createOrDeleteLocalFile(id, fileName, localShowPath)
                    })
                )

                // send to frontend
                loadShows(false, replacedShows)
                if (_store.SHOWS) sendMain(Main.SHOWS, _store.SHOWS.store)
                return
            }

            if (id === "ACCESS" || id === "ERROR_LOG" || id === "CACHE_SYNC") return // type safety

            const localStore = _store[id]
            if (!localStore) {
                console.warn("No local store for cloud data:", id)
                return
            }

            // replace full files
            if (data.method === "replace" || !MERGE_INDIVIDUAL.includes(id)) {
                const localPath = localStore.path
                // replace local file if cloud is newer or new device
                if (data.method === "replace" || isNewDevice || (await cloudIsNewer(localPath, modifiedDates[file.name]))) {
                    await moveFileAsync(cloudPath, localPath)

                    // send to frontend
                    const localData = localStore.store
                    sendMain(Main[id], localData)
                }
                return
            }

            // replace objets within files
            const localData = clone(localStore.store)

            if (id === "PROJECTS") {
                Object.entries<{ projects: Projects; folders: Folders; projectTemplates: Projects }>(cloudFileData).forEach(([type, object]) => {
                    if (!localData[type]) localData[type] = {}

                    Object.entries(object).forEach(([key, value]) => {
                        if (value.deleted) {
                            // from old cloud sync
                            delete localData[type][key]
                            return
                        }

                        const newLocalValue = checkCloudEntry(localData[type][key], key, value)
                        if (newLocalValue) localData[type][key] = newLocalValue
                    })

                    // check any local instance not in cloud (exists only locally)
                    const localKeys = getLocalOnlyKeys(object, localData[type])
                    localKeys.forEach((key) => {
                        if (isDeleted(id, key)) {
                            if (isDeletedLocally(id, key)) {
                                if (!localData[type][key]) return

                                unmarkAsDeleted(id, key)
                                markAsCreated(id, key)
                                return
                            }

                            delete localData[type][key]
                            return
                        }

                        // new file
                        markAsCreated(id, key)
                    })
                })
            } else {
                Object.entries<{ [key: string]: any; modified?: number }>(cloudFileData).forEach(([key, value]) => {
                    const newLocalValue = checkCloudEntry(localData[key], key, value)
                    if (newLocalValue) localData[key] = newLocalValue
                })

                // check any local instance not in cloud (exists only locally)
                const localKeys = getLocalOnlyKeys(cloudFileData, localData)
                localKeys.forEach((key) => {
                    if (isDeleted(id, key)) {
                        // restore if previously deleted in cloud but restored locally
                        if (isDeletedLocally(id, key)) {
                            if (!localData[key]) return

                            unmarkAsDeleted(id, key)
                            markAsCreated(id, key)
                            return
                        }

                        delete localData[key]
                        return
                    }

                    // new file
                    markAsCreated(id, key)
                })
            }

            // any local changes
            const hasChanged = JSON.stringify(localData) !== JSON.stringify(localStore.store)
            if (!hasChanged) return

            // changedFiles.push(id)
            setStore(localStore, localData)
            sendMain(Main[id], localData) // update frontend data

            function checkCloudEntry(localValue: any, key: string, value: { [key: string]: any; modified?: number }) {
                if (isDeleted(id, key)) return localValue

                const cloudModTime = value.modified
                if (!cloudModTime) return localValue // invalid: no modified time

                // exists only in cloud
                const existsLocally = !!localValue
                if (!existsLocally) {
                    if (isCreated(id, key)) localValue = value
                    else markAsDeleted(id, key)
                    return localValue
                }

                if (!localValue.modified) localValue.modified = Date.now()

                // exists both locally and in cloud
                const localModTime = localValue.modified
                const cloudIsNewer = cloudModTime > localModTime
                if (cloudIsNewer) localValue = value

                return localValue
            }
        })
    )

    // check any local instance not in cloud (exists only locally)
    const bibleNames = await readFolderAsync(biblesFolder)
    const localBibles = bibleNames.filter((key) => !cloudBibleNames.includes(key))
    await Promise.all(
        localBibles.map(async (fileName) => {
            const localBiblePath = path.join(biblesFolder, fileName)
            await createOrDeleteLocalFile("BIBLES", fileName, localBiblePath)
        })
    )

    if (readOnly) return finish()

    const success = await uploadLocalData()

    // silently backup in the background, this is skipped when the program is being closed
    setTimeout(async () => {
        await uploadBackupData()
        deleteFolder(EXTRACT_LOCATION)
        console.log("Backup sync completed!")
    }, 1000)

    return finish(success)

    async function uploadLocalData() {
        const zipPath = await compressUserData()
        const uploadSuccess = await provider!.uploadData(data.teamId, zipPath)
        return uploadSuccess
    }

    // if cloud backup is non existent or older than a week
    async function uploadBackupData() {
        console.log("Syncing backup data")
        const backupPath = await provider!.getBackup(data.churchId, data.teamId, EXTRACT_LOCATION)
        if (!backupPath) return await upload()

        const oneWeek = ONE_HOUR * 24 * 7
        const now = Date.now()
        const stats = await getFileStatsAsync(backupPath)
        if (!stats) return await upload()

        const age = now - stats.mtime.getTime()
        if (age > oneWeek) return await upload()

        return false

        async function upload() {
            const cloudZipsPath = getDataFolderPath("cloud")
            const zipFiles = await getFilesSortedByDate(cloudZipsPath)
            const backupZipPath = zipFiles[0]?.path
            if (!backupZipPath) return false

            return await provider!.uploadBackup(data.teamId, backupZipPath)
        }
    }

    function finish(success: boolean = true) {
        deleteFolder(EXTRACT_LOCATION)
        console.log("Sync completed!")
        isNewDevice = false
        return { success, changedFiles }
    }
}

async function cloudIsNewer(localFilePath: any, cloudDate: Date): Promise<boolean> {
    const localStats = await getFileStatsAsync(localFilePath)
    if (!cloudDate) return false
    if (!localStats) return true

    return cloudDate.getTime() > localStats.mtime.getTime()
}

function getLocalOnlyKeys(cloudKeys: any, localKeys: any): string[] {
    const keys1 = Object.keys(cloudKeys || {})
    const keys2 = Object.keys(localKeys || {})
    return keys2.filter((key) => !keys1.includes(key))
}

// WRITE USER DATA

async function compressUserData(): Promise<string> {
    const backupPath = path.join(EXTRACT_LOCATION, "Backup")
    createFolder(backupPath)
    await startBackup({ customOutputLocation: backupPath })
    const filesNames = await readFolderAsync(backupPath)
    if (!filesNames.length) return ""

    const files: { name: string; content?: Buffer | string; filePath?: string }[] = filesNames.map((fileName) => ({ name: fileName, filePath: path.join(backupPath, fileName) }))

    // changes.json
    files.push({ name: changes_name, content: JSON.stringify(getLatestChanges()) })

    const outputFolderPath = getDataFolderPath("cloud")
    const zipName = `${getTimePointString()}.zip`
    const zipPath = path.join(outputFolderPath, zipName)

    try {
        await compressToZip(files, zipPath)
    } catch (err) {
        console.error("Could not compress user data for cloud sync:", err)
        return ""
    }

    await deleteUnusedZips(outputFolderPath, zipPath)

    return zipPath
}

async function getFilesSortedByDate(folderPath: string) {
    const currentFiles = await readFolderAsync(folderPath)

    const zipFiles = await Promise.all(
        currentFiles.map(async (file) => {
            const filePath = path.join(folderPath, file)
            const stats = await getFileStatsAsync(filePath)
            return { path: filePath, ctime: stats ? stats.ctime.getTime() : 0 }
        })
    )

    // sort by date created
    return zipFiles.sort((a, b) => b.ctime - a.ctime)
}

// delete any existing zips that are less than an hour old
// or any more than two weeks old, but keep the two newest zips
const ONE_HOUR = 1000 * 60 * 60
async function deleteUnusedZips(folderPath: string, excludeZip: string) {
    const zipFiles = (await getFilesSortedByDate(folderPath)).filter((a) => a.path !== excludeZip) // .filter((file) => file.path.endsWith(".zip"))

    const now = Date.now()
    for (let i = 0; i < zipFiles.length; i++) {
        const file = zipFiles[i]
        const age = now - file.ctime

        // less than an hour old
        if (age < ONE_HOUR) {
            deleteFile(file.path)
            continue
        }

        if (i < 2) continue // keep two newest regardless

        // more than two weeks old
        if (age > ONE_HOUR * 24 * 14) {
            deleteFile(file.path)
            continue
        }
    }
}

async function createOrDeleteLocalFile(id: ChangeId, fileName: string, localPath: string) {
    // marked as deleted in general
    if (isDeleted(id, fileName)) {
        // marked as already deleted for this device
        if (isDeletedLocally(id, fileName)) {
            // already deleted locally
            if (!(await doesPathExistAsync(localPath))) return

            // revert if not deleted anymore
            unmarkAsDeleted(id, fileName)
            markAsCreated(id, fileName)
            return
        }

        // delete local file
        deleteFile(localPath)
        return
    }

    // new file
    markAsCreated(id, fileName)
}

// SYNC LOGIC
// if not found locally, and marked as "deleted" in cloud: skip
// if not found locally, and marked as "created" in cloud: download
// if not found locally, but not marked in cloud: mark as "deleted"
// if found locally only, and not marked in cloud: mark as "created"
// if found locally, but marked as "deleted" in cloud: delete locally
// if found locally and in cloud: use newest version
// if marked as deleted locally in cloud, but exists locally: unmark as deleted and mark as created

type Changes = { version: string; devices: string[]; modified: { [key: string]: number }; deleted: { [key: string]: string[] }; created: { [key: string]: string[] } }
const changes_name = "changes.json"
const version = "0.1.0"
const DEFAULT_CHANGES: Changes = { version, devices: [], modified: {}, deleted: {}, created: {} }
let CHANGES: Changes = clone(DEFAULT_CHANGES)
let cloudChanges: Changes | null = null
let isNewDevice = false

// keep track of last changed time so we can know which devices to ignore eventually
function getLatestChanges() {
    if (!CHANGES.modified) CHANGES.modified = {}
    CHANGES.modified[deviceId] = Date.now()
    return CHANGES
}

type ChangeId = keyof typeof _store | "SHOWS_CONTENT" | "BIBLES"
function markAsDeleted(storeId: ChangeId, key: string) {
    const instanceId = `${storeId}_${key}`
    unmarkAsCreated(storeId, key)
    markAs("deleted", instanceId)
}

function markAsCreated(storeId: ChangeId, key: string) {
    const instanceId = `${storeId}_${key}`
    unmarkAsDeleted(storeId, key)
    markAs("created", instanceId)
}

const deviceId = getMachineId()
function markAs(type: "deleted" | "created", instanceId: string) {
    // if (!CHANGES[instanceId]) CHANGES[instanceId] = { devices: [], deleted: {} }
    if (!CHANGES.devices.includes(deviceId)) CHANGES.devices.push(deviceId)
    if (CHANGES.devices.length < 2) return

    if (!CHANGES[type]) CHANGES[type] = {}
    if (!CHANGES[type][instanceId]) CHANGES[type][instanceId] = []
    CHANGES[type][instanceId].push(deviceId)

    // remove entry if all devices have the instance
    if (CHANGES[type][instanceId].length >= CHANGES.devices.length) {
        delete CHANGES[type][instanceId]
    }
}

function unmarkAsDeleted(storeId: ChangeId, key: string) {
    if (!CHANGES.deleted) return

    const instanceId = `${storeId}_${key}`
    delete CHANGES.deleted[instanceId]
}

function unmarkAsCreated(storeId: ChangeId, key: string) {
    if (!CHANGES.created) return

    const instanceId = `${storeId}_${key}`
    delete CHANGES.created[instanceId]
}

function isDeleted(storeId: ChangeId, key: string): boolean {
    const instanceId = `${storeId}_${key}`
    return !!CHANGES.deleted?.[instanceId]
}

function isCreated(storeId: ChangeId, key: string): boolean {
    if (isNewDevice) return true
    const instanceId = `${storeId}_${key}`
    return !!CHANGES.created?.[instanceId]
}

function isDeletedLocally(storeId: ChangeId, key: string): boolean {
    const instanceId = `${storeId}_${key}`
    return !!cloudChanges?.deleted?.[instanceId]?.includes(deviceId)
}
