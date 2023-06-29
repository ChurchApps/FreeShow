import { auth, drive } from "@googleapis/drive"
import path from "path"
import { toApp } from ".."
import { STORE } from "../../types/Channels"
import { checkShowsFolder, getDocumentsFolder, getFileStats, readFile, writeFile } from "../utils/files"
import { stores } from "../utils/store"

let driveClient: any = null

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

const ONE_MINUTE_MS = 60 * 1000
const SHOWS_CONTENT = "SHOWS_CONTENT"
const storesToSave = ["SHOWS", "EVENTS", "OVERLAYS", "PROJECTS", "SYNCED_SETTINGS", "STAGE_SHOWS", "TEMPLATES", "THEMES", "MEDIA"]
// don't upload: settings.json, config.json, cache.json, history.json

export async function syncDataDrive(data: any) {
    let files = await listFiles(20, "'" + data.mainFolderId + "' in parents")
    if (files === null) return { error: "Error: Could not get files! Have you shared a folder with the service account?" }

    let changes: any[] = []

    // let mainFolder = files.find((a: any) => a.id === data.mainFolderId)
    let mainFolder = await getFile(data.mainFolderId)
    if (!mainFolder) return { error: "Error: Could not find main folder! Have you shared it with the service account?" }

    let shows: any = null
    let bibles: any = null

    // CONFIGS
    await Promise.all(storesToSave.map(syncStores))

    // SCRIPTURE
    if (bibles === null) bibles = stores.SYNCED_SETTINGS.store?.scriptures
    if (bibles) await syncBibles()

    // SHOWS
    await syncAllShows()

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

        // download
        if (driveFile && (newest === "cloud" || data.method === "download") && data.method !== "upload") {
            if (!driveContent) {
                changes.push({ type: "config", action: "download_failed", name })
                return
            }

            if (id === "SHOWS") shows = driveContent
            else if (id === "SYNCED_SETTINGS") bibles = driveContent?.scriptures

            toApp(STORE, { channel: id, data: driveContent })

            changes.push({ type: "config", action: "download", name })
            // console.log("DOWNLOADED " + name)
            return
        }

        // upload (newest === "local")
        if (data.method === "download") return
        if (id === "SHOWS") shows = store.store
        else if (id === "SYNCED_SETTINGS") bibles = store.store?.scriptures

        let file = createFile(data.mainFolderId, { type: "json", name }, storeContent)
        let response = await uploadFile(file, driveFileId)

        if (response?.status != 200) {
            changes.push({ type: "config", action: "upload_failed", name })
            return
        }

        changes.push({ type: "config", action: "upload", name })
        // console.log("UPLOADED " + name)
        // responses.push(response)
    }

    async function syncBibles() {
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

        let localBiblesFolder: string = getDocumentsFolder(null, "Bibles")

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
        if (shows === null) shows = stores.SHOWS.store || null
        if (shows === null) return

        let name: string = SHOWS_CONTENT + ".json"
        let driveFileId = files.find((a: any) => a.name === name)?.id
        let driveFile = await getFile(driveFileId)
        // download shows
        let driveContent: any = driveFile ? await downloadFile(driveFileId) : null

        let showsPath: string = checkShowsFolder(data.path)
        if (!showsPath) return

        let downloadCount: number = 0
        let uploadCount: number = 0
        let allShows: any = {}

        await Promise.all(Object.entries(shows).map(checkShow))
        async function checkShow([id, show]: any) {
            let name = (show.name || id) + ".show"
            let localShowPath = path.join(showsPath, name)

            // check existing content
            let cloudContent = driveContent ? JSON.stringify([id, driveContent[id]]) : null
            let localContent = readFile(localShowPath)
            if (localContent) allShows[id] = JSON.parse(localContent)[1]
            if (cloudContent && localContent === cloudContent) return

            let newest = await getNewest({ driveFile, localPath: localShowPath })

            if (newest === "same") return

            // "download" show
            if (cloudContent && (newest === "cloud" || data.method === "download") && data.method !== "upload") {
                writeFile(localShowPath, cloudContent, id)
                downloadCount++

                return
            }

            // upload shows
            uploadCount++
        }

        if (downloadCount) changes.push({ type: "show", action: "download", name, count: downloadCount })
        if (!uploadCount) return

        // upload shows
        if (data.method === "download") return
        let file = createFile(data.mainFolderId, { type: "json", name }, JSON.stringify(allShows))
        let response = await uploadFile(file, driveFileId)

        if (response?.status != 200) {
            changes.push({ type: "show", action: "upload_failed", name })
            return
        }

        changes.push({ type: "show", action: "upload", name, count: uploadCount })
    }
}

async function getNewest({ driveFile, localPath }: any) {
    let storeInfo = getFileStats(localPath)?.stat

    let driveModified = driveFile ? new Date(driveFile.data.modifiedTime).getTime() : 0
    let storeModified = storeInfo?.mtimeMs || 0

    if (!driveModified || storeModified > driveModified) return "local"
    if (driveModified > storeModified + ONE_MINUTE_MS) return "cloud"

    return "same"
}

// TODO: drive media folder...
