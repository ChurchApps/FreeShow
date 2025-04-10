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

export async function listFiles(pageSize = 50, q: string = "") {
    if (!driveClient) return null

    // let q = "mimeType!='application/vnd.google-apps.folder'"
    // if (query) q += " and " + query

    let res: GaxiosResponse<drive_v3.Schema$FileList>
    try {
        res = await driveClient.files.list({
            pageSize,
            q,
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
    let metaData = { name, parents: [parent] }
    let media = { mimeType: types[type], body }

    return { resource: metaData, media } as drive_v3.Params$Resource$Files$Create
}

export function createFolder(parent: string, name: string) {
    let metaData = { name, parents: [parent], mimeType: types.folder }

    return { resource: metaData } as drive_v3.Params$Resource$Files$Create
}

// , q: string = ""
export async function getFile(id: string) {
    if (!id || !driveClient) return null

    // fileId: id
    let data: drive_v3.Params$Resource$Files$Get = { fields: "id,modifiedTime" }
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
export async function uploadFile(data: any, updateId: string = "") {
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
        error = (err as any)?.errors || err
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
        driveClient!.files.get({ fileId: fileId, alt: "media" }, (err, res) => {
            if (err) {
                console.error("The API returned an error: " + err)
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

    let changes: { type: string; action: "upload" | "download" | "upload_failed" | "download_failed"; name: string; count?: number }[] = []

    // let mainFolder = files.find((a) => a.id === data.mainFolderId)
    let mainFolder = await getFile(data.mainFolderId)
    if (!mainFolder) return { error: "Error: Could not find main folder! Have you shared it with the service account?" }
    console.log("Syncing to Drive")

    // let shows = null
    let bibles: { [key: string]: BibleCategories } | null = null

    // CONFIGS
    await Promise.all(storesToSave.map(syncStores))

    // SCRIPTURE
    if (bibles === null) bibles = stores.SYNCED_SETTINGS.store?.scriptures
    if (bibles) await syncBibles(data.dataPath)

    // SHOWS
    let syncStates: { [key: string]: number } = {}
    await syncAllShows()
    if (DEBUG) console.log(JSON.stringify(syncStates))

    return changes

    /////

    async function syncStores(id: keyof typeof stores) {
        let store = stores[id]
        let storeData: any = store.store
        let name = id + ".json"

        let driveFileId = files.find((a) => a.name === name)?.id
        if (!driveFileId) return

        let driveFile = await getFile(driveFileId)

        let newest = getNewest({ driveFile, localPath: store.path })
        if (newest === "same") return

        let driveContent = await downloadFile(driveFileId)
        let storeContent: string = JSON.stringify(storeData)
        let matchingContent: boolean = !!driveContent && JSON.stringify(driveContent) === storeContent

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
            let file = createFile(data.mainFolderId!, { type: "json", name }, JSON.stringify(combined))
            let response = await uploadFile(file, driveFileId)
            if (response?.status != 200) {
                changes.push({ type: "config", action: "upload_failed", name })
                return
            }
            changes.push({ type: "config", action: "upload", name })

            if (DEBUG) console.log("COMBINED " + name)
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
            if (DEBUG) console.log("DOWNLOADED " + name)
            return
        }

        // upload (newest === "local")
        if (data.method === "download") return
        if (id === "SYNCED_SETTINGS") bibles = storeData?.scriptures

        let file = createFile(data.mainFolderId!, { type: "json", name }, storeContent)
        let response = await uploadFile(file, driveFileId)

        if (response?.status != 200) {
            changes.push({ type: "config", action: "upload_failed", name })
            return
        }

        changes.push({ type: "config", action: "upload", name })
        if (DEBUG) console.log("UPLOADED " + name)
        // responses.push(response)
    }

    async function syncBibles(dataPath: string) {
        let localBibles: string[] = Object.values(bibles!)
            .filter((a) => !a.api && !a.collection)
            .map((a) => a.name + ".fsb")

        if (!localBibles.length) return

        let driveBiblesFolderId = files.find((a) => a.name === "Bibles")?.id

        // create bible folder
        if (!driveBiblesFolderId) {
            let folder = createFolder(data.mainFolderId!, "Bibles")
            let response = await uploadFile(folder)
            driveBiblesFolderId = (response?.data as drive_v3.Schema$File)?.id
            if (!driveBiblesFolderId) return
        }

        // this sets a limit to 100 bibles downloaded from cloud
        let driveBibles = await listFiles(100, "'" + driveBiblesFolderId + "' in parents")
        if (!driveBibles) return

        let localBiblesFolder: string = getDataFolder(dataPath, dataFolderNames.scriptures)

        await Promise.all(localBibles.map(syncBible))

        async function syncBible(name: string) {
            let driveFileId = driveBibles!.find((a) => a.name === name)?.id
            if (!driveFileId) return

            let driveFile = await getFile(driveFileId)

            let localBiblePath: string = path.resolve(localBiblesFolder, name)
            let localFile: string = await readFileAsync(localBiblePath)

            let newest = getNewest({ driveFile, localPath: localBiblePath })

            if (newest === "same") return

            let driveContent = await downloadFile(driveFileId)

            let matchingContent: boolean = !!driveContent && JSON.stringify(driveContent) === localFile
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
            let file = createFile(driveBiblesFolderId!, { type: "json", name }, localFile)
            let response = await uploadFile(file, driveFileId)

            if (response?.status != 200) {
                changes.push({ type: "bible", action: "upload_failed", name })
                return
            }

            changes.push({ type: "bible", action: "upload", name })
        }
    }

    async function syncAllShows() {
        let showsPath = checkShowsFolder(data.path || "")
        if (!showsPath) return

        if (DEBUG) console.log("Path:", data.path)
        if (DEBUG) console.log("Method:", data.method)

        let name = SHOWS_CONTENT + ".json"
        let driveFileId = files.find((a) => a.name === name)?.id
        if (!driveFileId) return

        let driveFile = await getFile(driveFileId)
        // download shows
        let driveContent = driveFile ? await downloadFile(driveFileId) : null

        let localShows = loadShows({ showsPath }, true)
        // some might have the same id
        let shows: { [key: string]: TrimmedShow | Show } = { ...localShows, ...(driveContent || {}) }
        if (DEBUG) console.log("Local shows count:", Object.keys(localShows).length)
        if (DEBUG) console.log("Cloud shows count:", Object.keys(driveContent || {}).length)

        let downloadCount: number = 0
        let uploadCount: number = 0
        let allShows: { [key: string]: Show | { deleted: boolean; name: string } } = {}

        await Promise.all(Object.entries(shows).map(checkShow))
        async function checkShow([id, show]: [string, TrimmedShow | Show]) {
            let name = (localShows[id]?.name || show?.name || id) + ".show"
            let localShowPath = path.join(showsPath, name)

            let newest = getNewest({ driveFile, localPath: localShowPath })
            // DEBUG:
            if (!syncStates[newest]) syncStates[newest] = 0
            syncStates[newest]++

            if (newest === "same") {
                let showContent = driveContent?.[id] || (await readFileAsync(localShowPath))
                if (showContent) allShows[id] = showContent
                return
            }

            // get existing content
            let cloudContent = driveContent?.[id] ? JSON.stringify([id, driveContent[id]]) : null
            let localContent = await readFileAsync(localShowPath, "utf8")

            // double check with content timestamp
            if (newest === "cloud" && cloudContent && localContent) {
                let actualDrivetime = driveContent?.[id]?.timestamps?.modified || 0
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
                    allShows[id] = { deleted: true, name: driveContent![id].name || "" }

                    delete shows[id]
                    uploadCount++
                    if (DEBUG) console.log("Show has been deleted from cloud:", driveContent[id]?.name || "")

                    return
                }

                allShows[id] = driveContent![id]

                // if a show is deleted, synced and undone it can't be restored unless a duplicate is created with new ID!
                // but it can be restored when deleted before it's synced
                // deleted in cloud
                if (driveContent![id].deleted === true) {
                    let p: string = path.join(showsPath, name)
                    if (doesPathExist(p)) {
                        deleteFile(p)
                        downloadCount++
                        if (DEBUG) console.log("Show has been deleted locally:", driveContent![id]?.name || "")
                    }

                    delete shows[id]

                    return
                }
            } else if (localContent) {
                try {
                    if (!isDeleted) allShows[id] = JSON.parse(localContent)[1]
                } catch (err) {
                    console.log(`Could not parse show ${name}.`, err)
                    return
                }
            }

            if (cloudContent && localContent === cloudContent) return

            // "download" show
            if (cloudContent && (newest === "cloud" || data.method === "download") && data.method !== "upload") {
                let newName = (show?.name || id) + ".show"
                if (localShows[id] && newName !== name) {
                    if (DEBUG) console.log("Rename file:", name, "->", newName)
                    deleteFile(localShowPath) // renamed
                }
                let newPath = path.join(showsPath, newName)

                writeFile(newPath, cloudContent, id)

                let trimmedShow = trimShow({ ...(driveContent?.[id] || {}), name: show?.name || id })
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
        if (DEBUG) console.log("Shows checked!")

        if (downloadCount) {
            if (DEBUG) console.log("Downloading shows:", downloadCount)
            changes.push({ type: "show", action: "download", name, count: downloadCount })
            if (DEBUG) console.log("Trimmed shows:", Object.keys(shows).length)
            if (Object.keys(shows).length) sendMain(Main.SHOWS, shows)
        }
        if (!uploadCount) return
        if (DEBUG) console.log("Uploading shows:", uploadCount)

        // upload shows
        if (data.method === "download") return
        if (DEBUG) console.log("Drive shows:", Object.keys(allShows).length)
        let file = createFile(data.mainFolderId!, { type: "json", name }, JSON.stringify(allShows))
        let response = await uploadFile(file, driveFileId)
        currentlyDeletedShows = []

        if (response?.status != 200) {
            changes.push({ type: "show", action: "upload_failed", name })
            return
        }

        changes.push({ type: "show", action: "upload", name, count: uploadCount })
    }
}

const TEN_SECONDS_MS = 10 * 1000
let lastLocalTimestamp = 0
function getNewest({ driveFile, localPath }: { driveFile: GaxiosResponse<drive_v3.Schema$File> | null; localPath: string }) {
    let storeInfo = getFileStats(localPath, true)?.stat

    let driveModified = driveFile?.data?.modifiedTime ? new Date(driveFile.data.modifiedTime).getTime() : 0
    let storeModified = storeInfo?.mtimeMs || 0
    lastLocalTimestamp = storeModified

    if (!driveModified || storeModified > driveModified) return "local"
    if (driveModified > storeModified + TEN_SECONDS_MS) return "cloud"

    return "same"
}

// combine local & cloud based on modified
function combineFiles(cloudContent: any, localContent: any, newest: string) {
    let content = (newest === "cloud" ? cloudContent : localContent) || {}
    const olderContent = (newest === "cloud" ? localContent : cloudContent) || {}

    Object.keys(olderContent).forEach((id) => {
        const olderIsNewer = (content[id]?.modified || 0) < (olderContent[id]?.modified || 0)
        if (!content[id] || olderIsNewer) content[id] = olderContent[id]
    })

    return content
}

// a custom drive media folder is not planned as discussed here:
// https://github.com/ChurchApps/FreeShow/issues/402
