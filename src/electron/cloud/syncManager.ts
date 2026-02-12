import { app } from "electron"
import path from "path"
import { isProd } from ".."
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

const DEBUG_MODE = false && !isProd

const EXTRACT_LOCATION = path.join(app.getPath("temp"), "freeshow-cloud")
const MERGE_INDIVIDUAL = ["OVERLAYS", "PROJECTS", "STAGE", "TEMPLATES"] // "EVENTS", "THEMES"

export async function syncData(data: { id: SyncProviderId; churchId: string; teamId: string; method: "merge" | "read_only" | "upload" | "replace" }) {
    const readOnly = data.method === "read_only" || data.method === "replace" // never write to cloud
    const changedFiles: string[] = [] // WIP write changes
    deletedNow = []

    const provider = getManager[data.id]()
    if (!provider) return { changedFiles }

    if (data.method === "replace") deleteLocalFiles()

    console.log("Syncing to cloud")

    if (data.method === "upload") {
        await uploadLocalData()
        return finish()
    }

    // clear any uncleared previous data
    if (!DEBUG_MODE && (await doesPathExistAsync(EXTRACT_LOCATION))) deleteFolder(EXTRACT_LOCATION)

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
                    const localBiblePath = path.join(biblesFolder, bibleName)
                    cloudBibleNames.push(bibleName)

                    if (data.method === "replace") {
                        await moveFileAsync(cloudPath, localBiblePath)
                        return
                    }

                    const getLocalData = async () => await doesPathExistAsync(localBiblePath)
                    const isCloudNewer = async () => await isCloudNewerThanFile(localBiblePath, modifiedDates[file.name])

                    const result = await checkCloudEntry("BIBLES", bibleName, null, getLocalData, isCloudNewer)

                    if (result.action === "delete") deleteFile(localBiblePath)
                    else if (result.action === "create" || result.action === "download") await moveFileAsync(cloudPath, localBiblePath)
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
                            const localShowPath = path.join(showsFolder, fileName)
                            cloudShowNames.push(fileName)

                            if (data.method === "replace") {
                                await download(true)
                                return
                            }

                            const getLocalData = async () => {
                                const localFile = await readFileAsync(localShowPath)
                                if (!localFile || !isValidJSON(localFile)) return null
                                return JSON.parse(localFile)[1] as Show
                            }

                            const result = await checkCloudEntry("SHOWS_CONTENT", fileName, show, getLocalData)

                            if (result.action === "delete") deleteFile(localShowPath)
                            else if (result.action === "create") await download(true)
                            else if (result.action === "download") await download(false)

                            async function download(isNew: boolean) {
                                if (!isNew) replacedShows.push(show.name)
                                await writeFileAsync(localShowPath, JSON.stringify([id, show]))
                            }
                        } catch (err) {
                            console.error("Failed to write show:", show.name, err)
                        }
                    })
                )

                // check any local instance not in cloud
                const showNames = await readFolderAsync(showsFolder)
                const localShows = getLocalOnlyKeys(cloudShowNames, showNames)
                for (const fileName of localShows) {
                    const result = checkLocalEntry(id, fileName)

                    const localShowPath = path.join(showsFolder, fileName)
                    if (result.action === "delete") deleteFile(localShowPath)
                }

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
                if (data.method === "replace" || isNewDevice || (await isCloudNewerThanFile(localPath, modifiedDates[file.name]))) {
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
                // promises not needed here, but keeps the code consistent
                await Promise.all(
                    Object.entries<{ projects: Projects; folders: Folders; projectTemplates: Projects }>(cloudFileData).map(async ([type, object]) => {
                        if (!localData[type]) localData[type] = {}

                        await Promise.all(
                            Object.entries(object).map(async ([key, value]) => {
                                if (value.deleted) {
                                    // from old cloud sync
                                    delete localData[type][key]
                                    return
                                }

                                const getLocalData = () => localData[type][key]

                                const result = await checkCloudEntry(id, key, value, getLocalData)

                                if (result.action === "delete") delete localData[type][key]
                                else if (result.action === "create" || result.action === "download") localData[type][key] = value
                            })
                        )

                        // check any local instance not in cloud
                        const localKeys = getLocalOnlyKeys(object, localData[type])
                        for (const key of localKeys) {
                            const result = checkLocalEntry(id, key)

                            if (result.action === "delete") delete localData[type][key]
                        }
                    })
                )
            } else {
                // promises not needed here, but keeps the code consistent
                await Promise.all(
                    Object.entries<{ [key: string]: any; modified?: number }>(cloudFileData).map(async ([key, value]) => {
                        const getLocalData = () => localData[key]

                        const result = await checkCloudEntry(id, key, value, getLocalData)

                        if (result.action === "delete") delete localData[key]
                        else if (result.action === "create" || result.action === "download") localData[key] = value
                    })
                )

                // check any local instance not in cloud
                const localKeys = getLocalOnlyKeys(cloudFileData, localData)
                for (const key of localKeys) {
                    const result = checkLocalEntry(id, key)

                    if (result.action === "delete") delete localData[key]
                }
            }

            // any local changes
            const hasChanged = JSON.stringify(localData) !== JSON.stringify(localStore.store)
            if (!hasChanged) return

            // changedFiles.push(id)
            setStore(localStore, localData)
            sendMain(Main[id], localData) // send to frontend
        })
    )

    // check any local instance not in cloud
    const bibleNames = await readFolderAsync(biblesFolder)
    const localBibles = getLocalOnlyKeys(cloudBibleNames, bibleNames)
    for (const fileName of localBibles) {
        const result = checkLocalEntry("BIBLES", fileName)

        const localBiblePath = path.join(biblesFolder, fileName)
        if (result.action === "delete") deleteFile(localBiblePath)
    }

    if (readOnly) return finish()

    const success = await uploadLocalData()

    // silently backup in the background, this is skipped when the program is being closed
    setTimeout(async () => {
        if (DEBUG_MODE) return
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
        if (!DEBUG_MODE) deleteFolder(EXTRACT_LOCATION)
        console.log("Sync completed!")
        isNewDevice = false
        return { success, changedFiles }
    }
}

async function isCloudNewerThanFile(localFilePath: any, cloudDate: Date): Promise<boolean> {
    const localStats = await getFileStatsAsync(localFilePath)
    if (!cloudDate) return false
    if (!localStats) return true

    return cloudDate.getTime() > localStats.mtime.getTime()
}

function getLocalOnlyKeys(cloudKeys: any, localKeys: any): string[] {
    const cloud = Array.isArray(cloudKeys) ? cloudKeys : Object.keys(cloudKeys || {})
    const local = Array.isArray(localKeys) ? localKeys : Object.keys(localKeys || {})
    return local.filter((key) => !cloud.includes(key))
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

async function checkCloudEntry(id: ChangeId, key: string, cloudData: any, getLocalData: () => Promise<any>, isCloudNewer?: () => Promise<boolean>) {
    const cloudModTime = getModifiedDate(cloudData)
    if (cloudData !== null && !cloudModTime) return { action: "skip" } // invalid: no modified time

    const localValue = await getLocalData()

    // exists only in cloud
    if (!localValue) {
        if (isDeleted(id, key)) return { action: "skip" }

        // if marked as created and not yet created locally
        if (isCreated(id, key) && !isCreatedLocally(id, key)) return { action: "create" }

        markAsDeleted(id, key)
        return { action: "skip" }
    }

    if (isDeleted(id, key)) return { action: "delete" }

    let localModTime = getModifiedDate(localValue)
    if (cloudData !== null && !localModTime) localModTime = setModifiedDate()

    // exists both locally and in cloud
    const cloudIsNewer = isCloudNewer ? await isCloudNewer() : cloudModTime > localModTime
    if (cloudIsNewer) return { action: "download" }

    return { action: "upload" }

    function getModifiedDate(data: any): number {
        if (!data) return 0
        // shows
        if (data.timestamps?.modified) return data.timestamps.modified
        if (data.timestamps?.created) return data.timestamps.created
        // everything else
        return data.modified || 0
    }

    // some entries might be missing the "modified" key, this ensures they all have it
    function setModifiedDate() {
        const now = Date.now()
        localValue.modified = now
        return now
    }
}

// exists only locally
function checkLocalEntry(id: ChangeId, key: string) {
    // marked as deleted in general
    if (isDeleted(id, key)) {
        // marked as already deleted for this device
        if (isDeletedLocally(id, key)) {
            // revert deletion when local file is restored
            unmarkAsDeleted(id, key)
            markAsCreated(id, key)
            return { action: "upload" }
        }

        // delete local file/instance
        return { action: "delete" }
    }

    // mark as created, for other devices to download
    markAsCreated(id, key)
    return { action: "upload" }
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
const version = "0.1.1"
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

function getInstanceId(storeId: ChangeId, key: string) {
    return `${storeId}_${key}`
}

type ChangeId = keyof typeof _store | "SHOWS_CONTENT" | "BIBLES"
let deletedNow: string[] = []
function markAsDeleted(storeId: ChangeId, key: string) {
    const instanceId = getInstanceId(storeId, key)
    unmarkAsCreated(storeId, key)
    markAs("deleted", instanceId)
    deletedNow.push(instanceId)
}

function markAsCreated(storeId: ChangeId, key: string) {
    const instanceId = getInstanceId(storeId, key)
    unmarkAsDeleted(storeId, key)
    markAs("created", instanceId)
}

const deviceId = getMachineId()
function markAs(type: "deleted" | "created", instanceId: string) {
    if (!CHANGES.devices.includes(deviceId)) CHANGES.devices.push(deviceId)
    if (CHANGES.devices.length < 2) return

    // init
    if (!CHANGES[type]) CHANGES[type] = {}
    if (!CHANGES[type][instanceId]) CHANGES[type][instanceId] = []

    // already marked for this device
    if (CHANGES[type][instanceId].includes(deviceId)) return

    CHANGES[type][instanceId].push(deviceId)

    // remove entry if all devices have the instance
    if (CHANGES[type][instanceId].length >= CHANGES.devices.length) {
        delete CHANGES[type][instanceId]
    }
}

function unmarkAsDeleted(storeId: ChangeId, key: string) {
    if (!CHANGES.deleted) return

    const instanceId = getInstanceId(storeId, key)
    delete CHANGES.deleted[instanceId]
}

function unmarkAsCreated(storeId: ChangeId, key: string) {
    if (!CHANGES.created) return

    const instanceId = getInstanceId(storeId, key)
    delete CHANGES.created[instanceId]
}

function isDeleted(storeId: ChangeId, key: string): boolean {
    const instanceId = getInstanceId(storeId, key)
    return !!CHANGES.deleted?.[instanceId]
}

function isCreated(storeId: ChangeId, key: string): boolean {
    if (isNewDevice) return true
    const instanceId = getInstanceId(storeId, key)
    return !!CHANGES.created?.[instanceId]
}

function isDeletedLocally(storeId: ChangeId, key: string): boolean {
    const instanceId = getInstanceId(storeId, key)
    if (deletedNow.includes(instanceId)) return false
    return !!cloudChanges?.deleted?.[instanceId]?.includes(deviceId)
}

function isCreatedLocally(storeId: ChangeId, key: string): boolean {
    const instanceId = getInstanceId(storeId, key)
    return !!cloudChanges?.created?.[instanceId]?.includes(deviceId)
}
