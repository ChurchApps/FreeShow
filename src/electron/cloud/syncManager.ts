import { app } from "electron"
import path from "path"
import { Main } from "../../types/IPC/Main"
import type { Folders, Projects } from "../../types/Projects"
import type { Show } from "../../types/Show"
import { isValidJSON, startBackup } from "../data/backup"
import { _store, setStore } from "../data/store"
import { compressToZip, decompressZipStream } from "../data/zip"
import { sendMain } from "../IPC/main"
import { getMachineId } from "../IPC/responsesMain"
import { createFolder, deleteFile, doesPathExistAsync, getDataFolderPath, getFileStatsAsync, getTimePointString, moveFileAsync, readFileAsync, readFolderAsync, writeFileAsync } from "../utils/files"
import { clone } from "../utils/helpers"
import { getChurchAppsSyncManager } from "./ChurchAppsSyncManager"

export type SyncProviderId = "churchApps"
const getManager = {
    churchApps: getChurchAppsSyncManager
}

export function canSync({ id }: { id: SyncProviderId } = { id: "churchApps" }): boolean {
    const provider = getManager[id]()
    if (!provider) return false

    return provider.hasValidConnection()
}

export async function getSyncTeams({ id }: { id: SyncProviderId } = { id: "churchApps" }): Promise<{ id: string; churchId: string; name: string }[]> {
    const provider = getManager[id]()
    if (!provider) return []

    return provider.getTeams()
}

const EXTRACT_LOCATION = path.join(app.getPath("temp"), "freeshow-cloud")
const MERGE_INDIVIDUAL = ["OVERLAYS", "PROJECTS", "STAGE", "TEMPLATES"] // "EVENTS", "THEMES"

export async function syncData(data: { id: SyncProviderId; churchId: string; teamId: string }) {
    const readOnly = false // never write to cloud
    const changedFiles: string[] = [] // WIP write to this

    const provider = getManager[data.id]()
    if (!provider) return { changedFiles }

    console.log(data)

    // DEBUG
    const backupPath = getDataFolderPath("cloud")
    const files = await readFolderAsync(backupPath)
    const firstBackupPath = files.length ? path.join(backupPath, files[0]) : null
    const cloudDataPath = firstBackupPath
    // const cloudDataPath = await provider.getData(data.churchId, data.teamId, EXTRACT_LOCATION)
    console.log("Downloaded data to path:", cloudDataPath)
    if (!cloudDataPath) {
        await uploadLocalData()
        return finish()
    }

    // extract cloud data
    createFolder(EXTRACT_LOCATION)
    const extractedFiles = await decompressZipStream(cloudDataPath, true, {
        getOutputPath: (fileName: string) => path.join(EXTRACT_LOCATION, fileName)
    })
    console.log("Extracted files:", extractedFiles)

    const showsFolder = getDataFolderPath("shows")
    const biblesFolder = getDataFolderPath("scriptures")

    const changesFile = extractedFiles.find((file) => file.name === changes_name)
    if (typeof changesFile?.content === "string") {
        const changesContent = await readFileAsync(changesFile.content)
        if (isValidJSON(changesContent)) CHANGES = JSON.parse(changesContent)
    }
    console.log("CHANGES DEVICES:", CHANGES.devices)

    // MERGE
    let cloudBibleNames: string[] = []
    extractedFiles.forEach(async (file) => {
        if (file.name === changes_name) return
        if (typeof file.content !== "string") return
        const cloudPath = file.content

        // download new/modified Bibles
        if (file.name.startsWith("BIBLE_")) {
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
            if (await cloudIsNewer(cloudPath, bibleDestPath)) await download()

            async function download() {
                // await copyFileAsync(cloudPath, bibleDestPath)
                await moveFileAsync(cloudPath, bibleDestPath)
            }

            return
        }

        const cloudFile = await readFileAsync(cloudPath)
        if (!isValidJSON(cloudFile)) return
        const cloudFileData = JSON.parse(cloudFile)

        // download new/modified shows
        if (file.name === "SHOWS_CONTENT.json") {
            let cloudShowNames: string[] = []

            await Promise.all(
                Object.entries<Show>(cloudFileData).map(async ([id, show]) => {
                    const fileName = (show.name || id) + ".show"
                    cloudShowNames.push(fileName)

                    if (isDeleted("SHOWS_CONTENT", fileName)) return

                    const localShowPath = path.join(showsFolder, fileName)
                    const localStats = await getFileStatsAsync(localShowPath)

                    const cloudModTime = show.timestamps?.modified
                    if (!cloudModTime) return

                    // exists only in cloud
                    const existsLocally = !!localStats
                    if (!existsLocally) {
                        if (isCreated("SHOWS_CONTENT", fileName)) await download()
                        else markAsDeleted("SHOWS_CONTENT", fileName)
                        return
                    }

                    // exists both locally and in cloud
                    const cloudIsNewer = !localStats || cloudModTime > localStats.mtime.getTime()
                    if (cloudIsNewer) await download()

                    async function download() {
                        await writeFileAsync(localShowPath, JSON.stringify([id, show]))
                    }
                })
            )

            // check any local instance not in cloud (exists only locally)
            const showNames = await readFolderAsync(showsFolder)
            const localShows = showNames.filter((key) => !cloudShowNames.includes(key))
            localShows.forEach((fileName) => {
                if (isDeleted(id, fileName)) {
                    const localShowPath = path.join(showsFolder, fileName)
                    deleteFile(localShowPath)
                    return
                }

                // new file
                markAsCreated(id, fileName)
            })
            return
        }

        const id = path.basename(file.name, path.extname(file.name)) as keyof typeof _store
        if (id === "ACCESS" || id === "ERROR_LOG") return // type safety

        const localStore = _store[id]
        if (!localStore) {
            console.warn("No local store for cloud data:", id)
            return
        }

        // replace full files (settings)
        if (!MERGE_INDIVIDUAL.includes(id)) {
            const localPath = localStore.path
            if (await cloudIsNewer(cloudPath, localPath)) {
                // await copyFileAsync(cloudPath, localPath)
                await moveFileAsync(cloudPath, localPath)
            }
            return
        }

        // replace objets within files
        const localData = clone(localStore.store)

        if (id === "PROJECTS") {
            Object.entries<{ projects: Projects; folders: Folders; projectTemplates: Projects }>(cloudFileData).forEach(([type, object]) => {
                if (!localData[type]) localData[type] = {}

                Object.entries(object).forEach(([key, value]) => {
                    const newLocalValue = checkCloudEntry(localData[type][key], key, value)
                    if (newLocalValue) localData[type][key] = newLocalValue
                })

                // check any local instance not in cloud (exists only locally)
                const localKeys = getLocalOnlyKeys(object, localData[type])
                localKeys.forEach((key) => {
                    if (isDeleted(id, key)) {
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

            // exists both locally and in cloud
            const localModTime = localValue?.modified
            const cloudIsNewer = !localModTime || cloudModTime > localModTime
            if (cloudIsNewer) localValue = value

            return localValue
        }
    })

    // check any local instance not in cloud (exists only locally)
    const bibleNames = await readFolderAsync(biblesFolder)
    const localBibles = bibleNames.filter((key) => !cloudBibleNames.includes(key))
    localBibles.forEach((fileName) => {
        if (isDeleted("BIBLES", fileName)) {
            const localBiblePath = path.join(biblesFolder, fileName)
            deleteFile(localBiblePath)
            return
        }

        // new file
        markAsCreated("BIBLES", fileName)
    })

    await uploadLocalData()

    await uploadBackupData()

    return finish()

    async function uploadLocalData() {
        if (readOnly) return

        const zipPath = await compressUserData()
        return // DEBUG
        const uploadSuccess = await provider!.uploadData(data.teamId, zipPath)
        console.log("Uploaded merged data to cloud:", uploadSuccess)
    }

    // if cloud backup is non existent or older than a week
    async function uploadBackupData() {
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

    function finish() {
        // deleteFolder(EXTRACT_LOCATION) // DEBUG
        return { changedFiles }
    }
}

async function cloudIsNewer(cloudFilePath: any, localFilePath: any): Promise<boolean> {
    const cloudStats = await getFileStatsAsync(cloudFilePath)
    const localStats = await getFileStatsAsync(localFilePath)
    if (!cloudStats) return false
    if (!localStats) return true

    return cloudStats.mtime > localStats.mtime
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
    files.push({ name: changes_name, content: JSON.stringify(CHANGES) })

    const outputFolderPath = getDataFolderPath("cloud")
    const zipName = `${getTimePointString()}.zip`
    const zipPath = path.join(outputFolderPath, zipName)

    try {
        await compressToZip(files, zipPath)
    } catch (err) {
        console.error("Could not compress user data for cloud sync:", err)
        return ""
    }

    await deleteUnusedZips(outputFolderPath)

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
async function deleteUnusedZips(folderPath: string) {
    const zipFiles = await getFilesSortedByDate(folderPath) // .filter((file) => file.path.endsWith(".zip"))

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

// SYNC LOGIC
// if not found locally, and marked as "deleted" in cloud: skip
// if not found locally, and marked as "created" in cloud: download
// if not found locally, but not marked in cloud: mark as "deleted"
// if found locally only, and not marked in cloud: mark as "created"
// if found locally, but marked as "deleted" in cloud: delete locally
// if found locally and in cloud: use newest version

const changes_name = "changes.json"
let CHANGES: { devices: string[]; deleted: { [key: string]: string[] }; created: { [key: string]: string[] } } = { devices: [], deleted: {}, created: {} }

type ChangeId = keyof typeof _store | "SHOWS_CONTENT" | "BIBLES"
function markAsDeleted(storeId: ChangeId, key: string) {
    const instanceId = `${storeId}_${key}`
    if (CHANGES.created[instanceId]) delete CHANGES.created[instanceId]
    markAs("deleted", instanceId)
}

function markAsCreated(storeId: ChangeId, key: string) {
    const instanceId = `${storeId}_${key}`
    markAs("created", instanceId)
}

const deviceId = getMachineId()
function markAs(type: "deleted" | "created", instanceId: string) {
    // if (!CHANGES[instanceId]) CHANGES[instanceId] = { devices: [], deleted: {} }
    if (!CHANGES.devices.includes(deviceId)) CHANGES.devices.push(deviceId)
    if (CHANGES.devices.length < 2) return

    if (!CHANGES[type][instanceId]) CHANGES[type][instanceId] = []
    CHANGES[type][instanceId].push(deviceId)

    // remove entry if all devices have the instance
    if (CHANGES[type][instanceId].length >= CHANGES.devices.length) {
        delete CHANGES[type][instanceId]
    }
}

function isDeleted(storeId: ChangeId, key: string): boolean {
    const instanceId = `${storeId}_${key}`
    return !!CHANGES.deleted?.[instanceId]
}

function isCreated(storeId: ChangeId, key: string): boolean {
    const instanceId = `${storeId}_${key}`
    return !!CHANGES.created?.[instanceId]
}
