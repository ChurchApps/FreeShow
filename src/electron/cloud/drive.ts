import { auth, drive, type drive_v3 } from "@googleapis/drive"
import type { GaxiosResponse } from "gaxios"
import path from "path"
import { isProd } from ".."
import { Main } from "../../types/IPC/Main"
import type { DriveData } from "../../types/Main"
import type { Show, TrimmedShow } from "../../types/Show"
import { stores } from "../data/store"
import { sendMain } from "../IPC/main"
import { checkShowsFolder, dataFolderNames, deleteFile, doesPathExist, getDataFolder, getFileStats, loadShows, readFileAsync, writeFile } from "../utils/files"
import { trimShow } from "../utils/shows"
import type { BibleCategories } from "./../../types/Tabs"

let driveClient: drive_v3.Drive | null = null
const DEBUG = !isProd

export async function authenticate(keysFilePath: string) {
    let status: { status?: string; error?: string } = {}

    try {
        const authData = new auth.GoogleAuth({ keyFile: keysFilePath, scopes: ["https://www.googleapis.com/auth/drive"] })
        const authClient = await authData.getClient()
        if ("refreshAccessToken" in authClient) {
            driveClient = drive({ version: "v3", auth: authClient })
            status = { status: "connected" }
        } else {
            status = { error: "Client error!" }
        }
    } catch (err) {
        console.error(err)
        status = { error: "Could not connect to the account!" }
    }

    return status
}

export async function listFolders(pageSize = 20, sort = "modified") {
    if (!driveClient) return

    let res: GaxiosResponse<drive_v3.Schema$FileList>
    try {
        res = await driveClient.files.list({
            pageSize,
            q: "mimeType='application/vnd.google-apps.folder'",
            fields: "nextPageToken, files(id, name, modifiedTime)",
        })
    } catch (err) {
        console.error(err)
        return null
    }

    let files = res.data.files || []

    if (sort === "modified") {
        // get oldest folder
        files = files.sort((a, b) => (a.modifiedTime! < b.modifiedTime! ? -1 : 1))
    }

    return files
}

export async function listFiles(pageSize = 50, query = "") {
    if (!driveClient) return null

    // let q = "mimeType!='application/vnd.google-apps.folder'"
    // if (query) q += " and " + query

    let res: GaxiosResponse<drive_v3.Schema$FileList>
    try {
        res = await driveClient.files.list({
            pageSize,
            q: query,
            fields: "nextPageToken, files(id, name, mimeType)",
        })
    } catch (err) {
        console.error(err)
        return null
    }

    return res.data?.files || []
}

export const types = {
    jpg: "image/jpg",
    png: "image/png",
    json: "application/json",
    txt: "application/txt",
    folder: "application/vnd.google-apps.folder",
}

export function createFile(parent: string, { type, name }: { type: keyof typeof types; name: string }, body: string) {
    const metaData = { name, parents: [parent] }
    const media = { mimeType: types[type], body }

    return { resource: metaData, media } as drive_v3.Params$Resource$Files$Create
}

export function createFolder(parent: string, name: string) {
    const metaData = { name, parents: [parent], mimeType: types.folder }

    return { resource: metaData } as drive_v3.Params$Resource$Files$Create
}

// , q: string = ""
export async function getFile(id: string) {
    if (!id || !driveClient) return null

    // fileId: id
    const data: drive_v3.Params$Resource$Files$Get = { fields: "id,modifiedTime" }
    if (id) data.fileId = id
    // if (q) data.q = q

    let file: GaxiosResponse<drive_v3.Schema$File>
    try {
        file = await driveClient.files.get(data)
    } catch (err) {
        console.error(err)
        return null
    }

    return file
}

// drive_v3.Params$Resource$Files$Update | drive_v3.Params$Resource$Files$Create
export async function uploadFile(data: any, updateId = "") {
    if (!driveClient) return null

    // const isFolder = data.resource.mimeType === types.folder
    let response: GaxiosResponse<drive_v3.Schema$FileList | drive_v3.Schema$File> | null
    let error

    try {
        if (updateId) {
            delete data.resource.parents
            response = await driveClient.files.update({ fileId: updateId, ...data, fields: "id" })
        } else {
            response = await driveClient.files.create({ ...data, fields: "id" })
        }
    } catch (err) {
        response = null
        error = (err )?.errors || err
    }

    switch (response?.status) {
        case 200:
            // console.log("File created, id:", response.data.id)
            break

        default:
            console.error("Error creating file:", error)
            break
    }

    return response
}

// async function removeFile(id: string) {
//     if (!driveClient) return
//     let response = await driveClient.files.delete({ fileId: id })
//     return response
// }

// drive_v3.Schema$File | null
export async function downloadFile(fileId: string): Promise<any> {
    if (!driveClient || !fileId) return null

    // https://developers.google.com/drive/api/guides/manage-downloads#node.js

    return new Promise((resolve) => {
        driveClient!.files.get({ fileId, alt: "media" }, (err, res) => {
            if (err) {
                console.error("The API returned an error:", err)
                resolve(null)
                return
            }

            resolve(res?.data || null)
        })
    })
}

const SHOWS_CONTENT = "SHOWS_CONTENT"
const combineLocations = ["PROJECTS"]
const storesToSave: (keyof typeof stores)[] = ["EVENTS", "OVERLAYS", "PROJECTS", "SYNCED_SETTINGS", "STAGE_SHOWS", "TEMPLATES", "THEMES", "MEDIA"]
// don't upload: settings.json, config.json, cache.json, history.json

export let currentlyDeletedShows: string[] = []
export async function syncDataDrive(data: DriveData) {
    if (!data.mainFolderId) return { error: "Error: Could not get main folder ID!" }

    const listedFiles = await listFiles(20, "'" + data.mainFolderId + "' in parents")
    if (listedFiles === null) return { error: "Error: Could not get files! Have you shared a folder with the service account?" }
    const files = listedFiles

    const changes: { type: string; action: "upload" | "download" | "upload_failed" | "download_failed"; name: string; count?: number }[] = []

    // let mainFolder = files.find((a) => a.id === data.mainFolderId)
    const mainFolder = await getFile(data.mainFolderId)
    if (!mainFolder) return { error: "Error: Could not find main folder! Have you shared it with the service account?" }
    console.info("Syncing to Drive")

    // let shows = null
    let bibles: { [key: string]: BibleCategories } | null = null

    // CONFIGS
    await Promise.all(storesToSave.map(syncStores))

    // SCRIPTURE
    if (bibles === null) bibles = stores.SYNCED_SETTINGS.store?.scriptures
    if (bibles) await syncBibles(data.dataPath)

    // SHOWS
    const syncStates: { [key: string]: number } = {}
    await syncAllShows()
    if (DEBUG) console.info(JSON.stringify(syncStates))

    return changes

    /// //

    async function syncStores(id: keyof typeof stores) {
        const store = stores[id]
        const storeData: any = store.store
        const name = id + ".json"

        const driveFileId = files.find((a) => a.name === name)?.id || ""

        const driveFile = await getFile(driveFileId)

        const newest = getNewest({ driveFile, localPath: store.path })
        if (newest === "same") return

        const driveContent = await downloadFile(driveFileId)
        const storeContent: string = JSON.stringify(storeData)
        const matchingContent: boolean = !!driveContent && JSON.stringify(driveContent) === storeContent

        if (matchingContent) return

        // combine
        if (data.method !== "upload" && data.method !== "download" && driveFile && storeContent && combineLocations.includes(id)) {
            const project = () => ({
                projects: combineFiles(driveContent?.projects, storeData.projects, newest),
                folders: combineFiles(driveContent?.folders, storeData.folders, newest),
                projectTemplates: combineFiles(driveContent?.projectTemplates, storeData.projectTemplates, newest),
            })
            const combined = id === "PROJECTS" ? project() : combineFiles(driveContent, storeData, newest)

            // download
            sendMain(id as Main, combined)
            changes.push({ type: "config", action: "download", name })

            // upload
            const file1 = createFile(data.mainFolderId!, { type: "json", name }, JSON.stringify(combined))
            const response1 = await uploadFile(file1, driveFileId)
            if (response1?.status !== 200) {
                changes.push({ type: "config", action: "upload_failed", name })
                return
            }
            changes.push({ type: "config", action: "upload", name })

            if (DEBUG) console.info("COMBINED " + name)
            return
        }

        // download
        if (driveFile && (newest === "cloud" || data.method === "download") && data.method !== "upload") {
            if (!driveContent) {
                changes.push({ type: "config", action: "download_failed", name })
                return
            }

            if (id === "SYNCED_SETTINGS") bibles = driveContent?.scriptures

            sendMain(id as Main, driveContent)

            changes.push({ type: "config", action: "download", name })
            if (DEBUG) console.info("DOWNLOADED " + name)
            return
        }

        // upload (newest === "local")
        if (data.method === "download") return
        if (id === "SYNCED_SETTINGS") bibles = storeData?.scriptures

        const file2 = createFile(data.mainFolderId!, { type: "json", name }, storeContent)
        const response2 = await uploadFile(file2, driveFileId)

        if (response2?.status !== 200) {
            changes.push({ type: "config", action: "upload_failed", name })
            return
        }

        changes.push({ type: "config", action: "upload", name })
        if (DEBUG) console.info("UPLOADED " + name)
        // responses.push(response)
    }

    async function syncBibles(dataPath: string) {
        const localBibles: string[] = Object.values(bibles!)
            .filter((a) => !a.api && !a.collection)
            .map((a) => a.name + ".fsb")

        if (!localBibles.length) return

        let driveBiblesFolderId = files.find((a) => a.name === "Bibles")?.id

        // create bible folder
        if (!driveBiblesFolderId) {
            const folder = createFolder(data.mainFolderId!, "Bibles")
            const response = await uploadFile(folder)
            driveBiblesFolderId = (response?.data as drive_v3.Schema$File)?.id
            if (!driveBiblesFolderId) return
        }

        // this sets a limit to 100 bibles downloaded from cloud
        const driveBibles = await listFiles(100, "'" + driveBiblesFolderId + "' in parents")

        const localBiblesFolder: string = getDataFolder(dataPath, dataFolderNames.scriptures)

        await Promise.all(localBibles.map(syncBible))

        async function syncBible(name: string) {
            const driveFileId = driveBibles?.find((a) => a.name === name)?.id || ""

            const driveFile = await getFile(driveFileId)

            const localBiblePath: string = path.resolve(localBiblesFolder, name)
            const localFile: string = await readFileAsync(localBiblePath)

            const newest = getNewest({ driveFile, localPath: localBiblePath })

            if (newest === "same") return

            const driveContent = await downloadFile(driveFileId)

            const matchingContent: boolean = !!driveContent && JSON.stringify(driveContent) === localFile
            if (matchingContent) return

            // download
            if (driveFile && (newest === "cloud" || data.method === "download") && data.method !== "upload") {
                if (!driveContent) {
                    changes.push({ type: "bible", action: "download_failed", name })
                    return
                }

                writeFile(localBiblePath, JSON.stringify(driveContent))

                changes.push({ type: "bible", action: "download", name })
                return
            }

            // upload (newest === "local")
            if (data.method === "download") return
            if (!localFile) return
            const file = createFile(driveBiblesFolderId!, { type: "json", name }, localFile)
            const response = await uploadFile(file, driveFileId)

            if (response?.status !== 200) {
                changes.push({ type: "bible", action: "upload_failed", name })
                return
            }

            changes.push({ type: "bible", action: "upload", name })
        }
    }

    async function syncAllShows() {
        const showsPath = checkShowsFolder(data.path || "")
        if (!showsPath) return

        if (DEBUG) console.info("Path:", data.path)
        if (DEBUG) console.info("Method:", data.method)

        const name = SHOWS_CONTENT + ".json"
        const driveFileId = files.find((a) => a.name === name)?.id || ""

        const driveFile = await getFile(driveFileId)
        // download shows
        const driveContent = driveFile ? await downloadFile(driveFileId) : null

        const localShows = loadShows({ showsPath }, true)
        // some might have the same id
        const shows: { [key: string]: TrimmedShow | Show } = { ...localShows, ...(driveContent || {}) }
        if (DEBUG) console.info("Local shows count:", Object.keys(localShows).length)
        if (DEBUG) console.info("Cloud shows count:", Object.keys(driveContent || {}).length)

        let downloadCount = 0
        let uploadCount = 0
        const allShows: { [key: string]: Show | { deleted: boolean; name: string } } = {}

        await Promise.all(Object.entries(shows).map(checkShow))
        async function checkShow([id, show]: [string, TrimmedShow | Show]) {
            const showName = (localShows[id]?.name || show?.name || id) + ".show"
            const localShowPath = path.join(showsPath, showName)

            let newest = getNewest({ driveFile, localPath: localShowPath })
            // DEBUG:
            if (!syncStates[newest]) syncStates[newest] = 0
            syncStates[newest]++

            if (newest === "same") {
                const showContent = driveContent?.[id] || (await readFileAsync(localShowPath))
                if (showContent) allShows[id] = showContent
                return
            }

            // get existing content
            const cloudContent = driveContent?.[id] ? JSON.stringify([id, driveContent[id]]) : null
            const localContent = await readFileAsync(localShowPath, "utf8")

            // double check with content timestamp
            if (newest === "cloud" && cloudContent && localContent) {
                const actualDrivetime = driveContent?.[id]?.timestamps?.modified || 0
                if (actualDrivetime && actualDrivetime < lastLocalTimestamp) {
                    newest = "local"
                    // DEBUG:
                    syncStates.cloud--
                    if (!syncStates.localX) syncStates.localX = 0
                    syncStates.localX++
                }
            }

            const isDeleted = currentlyDeletedShows.includes(id) || driveContent?.[id]?.deleted
            if ((newest === "cloud" || data.method === "download" || isDeleted) && cloudContent) {
                // deleted locally
                if (currentlyDeletedShows.includes(id)) {
                    allShows[id] = { deleted: true, name: driveContent[id].name || "" }

                    delete shows[id]
                    uploadCount++
                    if (DEBUG) console.info("Show has been deleted from cloud:", driveContent[id]?.name || "")

                    return
                }

                allShows[id] = driveContent[id]

                // if a show is deleted, synced and undone it can't be restored unless a duplicate is created with new ID!
                // but it can be restored when deleted before it's synced
                // deleted in cloud
                if (driveContent[id].deleted === true) {
                    const filePath: string = path.join(showsPath, showName)
                    if (doesPathExist(filePath)) {
                        deleteFile(filePath)
                        downloadCount++
                        if (DEBUG) console.info("Show has been deleted locally:", driveContent[id]?.name || "")
                    }

                    delete shows[id]

                    return
                }
            } else if (localContent) {
                try {
                    if (!isDeleted) allShows[id] = JSON.parse(localContent)[1]
                } catch (err) {
                    console.error(`Could not parse show ${showName}.`, err)
                    return
                }
            }

            if (cloudContent && localContent === cloudContent) return

            // "download" show
            if (cloudContent && (newest === "cloud" || data.method === "download") && data.method !== "upload") {
                const newName = (show?.name || id) + ".show"
                if (localShows[id] && newName !== showName) {
                    if (DEBUG) console.info("Rename file:", showName, "->", newName)
                    deleteFile(localShowPath) // renamed
                }
                const newPath = path.join(showsPath, newName)

                writeFile(newPath, cloudContent, id)

                const trimmedShow = trimShow({ ...(driveContent?.[id] || {}), name: show?.name || id })
                if (!trimmedShow) {
                    delete shows[id]
                    return
                }

                shows[id] = trimmedShow
                downloadCount++

                return
            }

            // "upload" show
            if (localContent) {
                uploadCount++
                return
            }

            // something is wrong with the file
            if (!cloudContent && !localContent) delete shows[id]
        }
        if (DEBUG) console.info("Shows checked!")

        if (downloadCount) {
            if (DEBUG) console.info("Downloading shows:", downloadCount)
            changes.push({ type: "show", action: "download", name, count: downloadCount })
            if (DEBUG) console.info("Trimmed shows:", Object.keys(shows).length)
            if (Object.keys(shows).length) sendMain(Main.SHOWS, shows)
        }
        if (!uploadCount) return
        if (DEBUG) console.info("Uploading shows:", uploadCount)

        // upload shows
        if (data.method === "download") return
        if (DEBUG) console.info("Drive shows:", Object.keys(allShows).length)
        const file = createFile(data.mainFolderId!, { type: "json", name }, JSON.stringify(allShows))
        const response = await uploadFile(file, driveFileId)
        currentlyDeletedShows = []

        if (response?.status !== 200) {
            changes.push({ type: "show", action: "upload_failed", name })
            return
        }

        changes.push({ type: "show", action: "upload", name, count: uploadCount })
    }
}

const TEN_SECONDS_MS = 10 * 1000
let lastLocalTimestamp = 0
function getNewest({ driveFile, localPath }: { driveFile: GaxiosResponse<drive_v3.Schema$File> | null; localPath: string }) {
    const storeInfo = getFileStats(localPath, true)?.stat

    const driveModified = driveFile?.data?.modifiedTime ? new Date(driveFile.data.modifiedTime).getTime() : 0
    const storeModified = storeInfo?.mtimeMs || 0
    lastLocalTimestamp = storeModified

    if (!driveModified || storeModified > driveModified) return "local"
    if (driveModified > storeModified + TEN_SECONDS_MS) return "cloud"

    return "same"
}

// combine local & cloud based on modified
function combineFiles(cloudContent: any, localContent: any, newest: string) {
    const content = (newest === "cloud" ? cloudContent : localContent) || {}
    const olderContent = (newest === "cloud" ? localContent : cloudContent) || {}

    Object.keys(olderContent).forEach((id) => {
        const olderIsNewer = (content[id]?.modified || 0) < (olderContent[id]?.modified || 0)
        if (!content[id] || olderIsNewer) content[id] = olderContent[id]
    })

    return content
}

// a custom drive media folder is not planned as discussed here:
// https://github.com/ChurchApps/FreeShow/issues/402
