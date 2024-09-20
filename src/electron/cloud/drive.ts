import { auth, drive } from "@googleapis/drive"
import path from "path"
import { isProd, toApp } from ".."
import { STORE } from "../../types/Channels"
import { stores } from "../data/store"
import { checkShowsFolder, dataFolderNames, deleteFile, doesPathExist, getDataFolder, getFileStats, loadShows, readFile, writeFile } from "../utils/files"
import { trimShow } from "../utils/responses"

let driveClient: any = null
const DEBUG = !isProd

export async function authenticate(keysFilePath: string) {
    let status: any = {}

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

    let res: any = {}
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
        files = files.sort((a: any, b: any) => (a.modifiedTime < b.modifiedTime ? -1 : 1))
    }

    return files
}

export async function listFiles(pageSize = 50, q: string = "") {
    if (!driveClient) return

    // let q = "mimeType!='application/vnd.google-apps.folder'"
    // if (query) q += " and " + query

    let res: any = {}
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

export const types: any = {
    jpg: "image/jpg",
    png: "image/png",
    json: "application/json",
    txt: "application/txt",
    folder: "application/vnd.google-apps.folder",
}

export function createFile(parent: string, { type, name }: any, body: string) {
    let metaData = { name, parents: [parent] }
    let media = { mimeType: types[type], body }

    return { resource: metaData, media }
}

export function createFolder(parent: string, name: string) {
    let metaData = { name, parents: [parent], mimeType: types.folder }

    return { resource: metaData }
}

export async function getFile(id: string, q: string = "") {
    if (!id || !driveClient) return null

    // fileId: id
    let data: any = { fields: "id,modifiedTime" }
    if (id) data.fileId = id
    if (q) data.q = q

    let file = null
    try {
        file = await driveClient.files.get(data)
    } catch (err) {
        console.error(err)
    }

    return file
}

export async function uploadFile(data: any, updateId: string = "") {
    if (!driveClient) return

    let response: any = null

    try {
        if (updateId) {
            delete data.resource.parents
            response = await driveClient.files.update({ fileId: updateId, ...data, fields: "id" })
        } else {
            response = await driveClient.files.create({ ...data, fields: "id" })
        }
    } catch (error) {
        response = error
    }

    switch (response?.status) {
        case 200:
            // console.log("File created, id:", response.data.id)
            break

        default:
            console.error("Error creating file:", response?.errors || response)
            break
    }

    return response
}

// async function removeFile(id: string) {
//     if (!driveClient) return
//     let response = await driveClient.files.delete({ fileId: id })
//     return response
// }

export async function downloadFile(fileId: string) {
    if (!driveClient || !fileId) return

    // https://developers.google.com/drive/api/guides/manage-downloads#node.js

    return new Promise((resolve, reject) => {
        driveClient.files.get({ fileId: fileId, alt: "media" }, (err: any, res: any) => {
            if (err) {
                reject(err)
                return console.error("The API returned an error: " + err)
            }
            resolve(res.data)
        })
    })
}

const SHOWS_CONTENT = "SHOWS_CONTENT"
const combineLocations = ["PROJECTS"]
const storesToSave = ["EVENTS", "OVERLAYS", "PROJECTS", "SYNCED_SETTINGS", "STAGE_SHOWS", "TEMPLATES", "THEMES", "MEDIA"]
// don't upload: settings.json, config.json, cache.json, history.json

export let currentlyDeletedShows: string[] = []
export async function syncDataDrive(data: any) {
    let files = await listFiles(20, "'" + data.mainFolderId + "' in parents")
    if (files === null) return { error: "Error: Could not get files! Have you shared a folder with the service account?" }

    let changes: any[] = []

    // let mainFolder = files.find((a: any) => a.id === data.mainFolderId)
    let mainFolder = await getFile(data.mainFolderId)
    if (!mainFolder) return { error: "Error: Could not find main folder! Have you shared it with the service account?" }
    console.log("Syncing to Drive")

    // let shows: any = null
    let bibles: any = null

    // CONFIGS
    await Promise.all(storesToSave.map(syncStores))

    // SCRIPTURE
    if (bibles === null) bibles = stores.SYNCED_SETTINGS.store?.scriptures
    if (bibles) await syncBibles(data.dataPath)

    // SHOWS
    let syncStates: any = {}
    await syncAllShows()
    if (DEBUG) console.log(JSON.stringify(syncStates))

    return changes

    /////

    async function syncStores(id: string) {
        let store = stores[id]
        let name = id + ".json"

        let driveFileId = files.find((a: any) => a.name === name)?.id
        let driveFile = await getFile(driveFileId)

        let newest = await getNewest({ driveFile, localPath: store.path })
        if (newest === "same") return

        let driveContent: any = await downloadFile(driveFileId)
        let storeContent: string = JSON.stringify(store.store)
        let matchingContent: boolean = driveContent && JSON.stringify(driveContent) === storeContent

        if (matchingContent) return

        // combine
        if (data.method !== "upload" && data.method !== "download" && driveFile && storeContent && combineLocations.includes(id)) {
            const project = () => ({ projects: combineFiles(driveContent.projects, store.store.projects, newest), folders: combineFiles(driveContent.folders, store.store.folders, newest) })
            const combined = id === "PROJECTS" ? project() : combineFiles(driveContent, store.store, newest)

            // download
            toApp(STORE, { channel: id, data: combined })
            changes.push({ type: "config", action: "download", name })

            // upload
            let file = createFile(data.mainFolderId, { type: "json", name }, JSON.stringify(combined))
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

            toApp(STORE, { channel: id, data: driveContent })

            changes.push({ type: "config", action: "download", name })
            if (DEBUG) console.log("DOWNLOADED " + name)
            return
        }

        // upload (newest === "local")
        if (data.method === "download") return
        if (id === "SYNCED_SETTINGS") bibles = store.store?.scriptures

        let file = createFile(data.mainFolderId, { type: "json", name }, storeContent)
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
        let localBibles: string[] = Object.values(bibles)
            .filter((a: any) => !a.api && !a.collection)
            .map((a: any) => a.name + ".fsb")

        if (!localBibles.length) return

        let driveBiblesFolderId: string = files.find((a: any) => a.name === "Bibles")?.id

        // create bible folder
        if (!driveBiblesFolderId) {
            let folder = createFolder(data.mainFolderId, "Bibles")
            let response = await uploadFile(folder)
            driveBiblesFolderId = response?.data?.id
            if (!driveBiblesFolderId) return
        }

        // this sets a limit to 100 bibles downloaded from cloud
        let driveBibles = await listFiles(100, "'" + driveBiblesFolderId + "' in parents")

        let localBiblesFolder: string = getDataFolder(dataPath, dataFolderNames.scriptures)

        await Promise.all(localBibles.map(syncBible))

        async function syncBible(name: string) {
            let driveFileId = driveBibles.find((a: any) => a.name === name)?.id
            let driveFile = await getFile(driveFileId)

            let localBiblePath: string = path.resolve(localBiblesFolder, name)
            let localFile: string = readFile(localBiblePath)

            let newest = await getNewest({ driveFile, localPath: localBiblePath })

            if (newest === "same") return

            let driveContent: any = await downloadFile(driveFileId)

            let matchingContent: boolean = driveContent && JSON.stringify(driveContent) === localFile
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
            let file = createFile(driveBiblesFolderId, { type: "json", name }, localFile)
            let response = await uploadFile(file, driveFileId)

            if (response?.status != 200) {
                changes.push({ type: "bible", action: "upload_failed", name })
                return
            }

            changes.push({ type: "bible", action: "upload", name })
        }
    }

    async function syncAllShows() {
        let showsPath: string = checkShowsFolder(data.path)
        if (!showsPath) return

        if (DEBUG) console.log("Path:", data.path)
        if (DEBUG) console.log("Method:", data.method)

        let name: string = SHOWS_CONTENT + ".json"
        let driveFileId = files.find((a: any) => a.name === name)?.id
        let driveFile = await getFile(driveFileId)
        // download shows
        let driveContent: any = driveFile ? await downloadFile(driveFileId) : null

        let localShows = loadShows({ showsPath }, true)
        // some might have the same id
        let shows = { ...localShows, ...(driveContent || {}) }
        if (DEBUG) console.log("Local shows count:", Object.keys(localShows).length)
        if (DEBUG) console.log("Cloud shows count:", Object.keys(driveContent || {}).length)

        let downloadCount: number = 0
        let uploadCount: number = 0
        let allShows: any = {}

        await Promise.all(Object.entries(shows).map(checkShow))
        async function checkShow([id, show]: any) {
            let name = (localShows[id]?.name || show?.name || id) + ".show"
            let localShowPath = path.join(showsPath, name)

            let newest = await getNewest({ driveFile, localPath: localShowPath })
            // DEBUG:
            if (!syncStates[newest]) syncStates[newest] = 0
            syncStates[newest]++

            if (newest === "same") {
                let showContent = driveContent?.[id] || readFile(localShowPath)
                if (showContent) allShows[id] = showContent
                return
            }

            // get existing content
            let cloudContent = driveContent?.[id] ? JSON.stringify([id, driveContent[id]]) : null
            let localContent = readFile(localShowPath, "utf8", true)

            // double check with content timestamp
            if (newest === "cloud" && cloudContent && localContent) {
                let actualDrivetime = driveContent[id].timestamps?.modified || 0
                if (actualDrivetime && actualDrivetime < lastLocalTimestamp) {
                    newest = "local"
                    // DEBUG:
                    syncStates.cloud--
                    if (!syncStates.localX) syncStates.localX = 0
                    syncStates.localX++
                }
            }

            if ((newest === "cloud" || data.method === "download") && cloudContent) {
                // deleted locally
                if (currentlyDeletedShows.includes(id)) {
                    allShows[id] = { deleted: true, name: driveContent[id]?.name || "" }

                    delete shows[id]
                    uploadCount++
                    if (DEBUG) console.log("Show has been deleted from cloud:", driveContent[id]?.name || "")

                    return
                }

                allShows[id] = driveContent[id]

                // if a show is deleted, synced and undone it can't be restored unless a duplicate is created with new ID!
                // but it can be restored when deleted before it's synced
                // deleted in cloud
                if (driveContent[id].deleted === true) {
                    let p: string = path.join(showsPath, name)
                    if (doesPathExist(p)) {
                        deleteFile(p)
                        downloadCount++
                        if (DEBUG) console.log("Show has been deleted locally:", driveContent[id]?.name || "")
                    }

                    delete shows[id]

                    return
                }
            } else if (localContent) {
                try {
                    allShows[id] = JSON.parse(localContent)[1]
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
            if (Object.keys(shows).length) toApp(STORE, { channel: "SHOWS", data: shows })
        }
        if (!uploadCount) return
        if (DEBUG) console.log("Uploading shows:", uploadCount)

        // upload shows
        if (data.method === "download") return
        if (DEBUG) console.log("Drive shows:", Object.keys(allShows).length)
        let file = createFile(data.mainFolderId, { type: "json", name }, JSON.stringify(allShows))
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
async function getNewest({ driveFile, localPath }: any) {
    let storeInfo = getFileStats(localPath, true)?.stat

    let driveModified = driveFile ? new Date(driveFile.data.modifiedTime).getTime() : 0
    let storeModified = storeInfo?.mtimeMs || 0
    lastLocalTimestamp = storeModified

    if (!driveModified || storeModified > driveModified) return "local"
    if (driveModified > storeModified + TEN_SECONDS_MS) return "cloud"

    return "same"
}

// combine local & cloud based on modified
function combineFiles(cloudContent: any, localContent: any, newest: string) {
    let content = newest === "cloud" ? cloudContent : localContent
    const olderContent = newest === "cloud" ? localContent : cloudContent

    Object.keys(olderContent).forEach((id) => {
        const olderIsNewer = (content[id]?.modified || 0) < (olderContent[id]?.modified || 0)
        if (!content[id] || olderIsNewer) content[id] = olderContent[id]
    })

    return content
}

// a custom drive media folder is not planned as discussed here:
// https://github.com/ChurchApps/FreeShow/issues/402
