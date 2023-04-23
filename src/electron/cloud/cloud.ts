import path from "path"
import { toApp } from ".."
import { CLOUD, STORE } from "../../types/Channels"
import { checkShowsFolder, getFileStats, writeFile } from "../utils/files"
import { stores } from "../utils/store"
import { authenticate, createFile, createFolder, downloadFile, getFile, listFiles, listFolders, uploadFile } from "./drive"

export async function cloudConnect(e: any, { channel, data }: any) {
    if (!cloudHelpers[channel]) return

    let reply = await cloudHelpers[channel](data)
    if (reply) e.reply(CLOUD, { channel, data: reply })
}

const cloudHelpers: any = {
    // SAVE_KEY_FILE: (data: any) => {
    //     console.log(data)

    //     let p: string = path.resolve(getDocumentsFolder(null, "Cloud"), "GOOGLE_CLIENT_SECRET")
    //     writeFile(p, JSON.stringify(data))

    //     return { status: "created" }
    // },
    DRIVE_CONNECT: async () => {
        let keysFilePath = stores.DRIVE_API_KEY.path

        await authenticate(keysFilePath)

        // TODO: return actual status
        return { status: "connected" }
    },
    GET_MAIN_FOLDER: async () => {
        let folders = await listFolders()
        if (!folders?.[0]) return

        // WIP return error when no file (did you share?)
        return { id: folders[0].id }
    },
    SYNC_DATA: async (data: any) => {
        if (!data.mainFolderId) return

        let files = await listFiles(20, "'" + data.mainFolderId + "' in parents")
        if (!files.length) return

        // ! TEMPORARY
        // delete files
        // await Promise.all(
        //     files.map(async (a: any) => {
        //         if (a.name === "Untitled") await deleteFile(a.id)
        //         // if (a.id !== "1i3KsM9MINak2r8g-aJlFA-OfRat-gBvu") await deleteFile(a.id)
        //     })
        // )

        // let mainFolder = files.find((a: any) => a.id === data.mainFolderId)
        let mainFolder = await getFile(data.mainFolderId)
        if (!mainFolder) return

        const ONE_MINUTE_MS = 60 * 1000

        let shows: any = {}

        let responses: any[] = []
        await Promise.all(
            storesToSave.map(async (id) => {
                let store = stores[id]
                let name = id + ".json"

                let driveFileId = files.find((a: any) => a.name === name)?.id
                let driveFile = await getFile(driveFileId)

                let storeInfo = getFileStats(store.path)?.stat

                let driveModified = driveFile ? new Date(driveFile.data.modifiedTime).getTime() : 0
                let storeModified = storeInfo?.mtimeMs || 0
                // console.log(driveModified, storeModified)
                // console.log(new Date(driveModified), new Date(storeModified))

                // TODO: syncing files to disk...
                // saving file to disk -> uploading to cloud = two matching files
                // downloading file from cloud -> to store (also disk?) = store is much newer
                // saving will store to disk & to cloud (the exact same file...)
                // fixing:
                // check that content is the same...
                // having a uuid in the file for each update...

                let newest: "same" | "cloud" | "local" = "same"
                if (!driveModified || storeModified > driveModified) newest = "local"
                else if (driveModified > storeModified + ONE_MINUTE_MS) newest = "cloud"

                if (newest === "same") return

                // check if content is the same
                // if (driveFile?.body === JSON.stringify(store.store)) return

                let driveContent: any = await downloadFile(driveFileId)
                let storeContent: string = JSON.stringify(store.store)
                if (driveContent && JSON.stringify(driveContent) === storeContent) return

                if (newest === "cloud") {
                    if (!driveContent) return
                    console.log("DOWNLOADED " + name)

                    if (id === "SHOWS") shows = driveContent
                    toApp(STORE, { channel: id, data: driveContent })
                    return
                }

                // newest === "local"
                console.log("UPLOADED " + name)

                if (id === "SHOWS") shows = store.store

                let file = createFile(data.mainFolderId, { type: "json", name }, storeContent)
                // let response =
                await uploadFile(file, driveFileId)
                // console.log(response)
                // responses.push(response)
            })
        )

        if (true) return

        // WIP bibles

        // SHOWS
        let showsFolderId: string = files.find((a: any) => a.name === "Shows")?.id
        if (!showsFolderId) {
            // create shows folder
            let folder = createFolder(data.mainFolderId, "Shows")
            let response = await uploadFile(folder)
            showsFolderId = response?.data?.id
            if (!showsFolderId) return
        }

        let showsPath = checkShowsFolder(data.path)
        await Promise.all(
            Object.entries(shows).map(async ([id, show]: any) => {
                let driveId = show.driveId
                let name = show.name + ".show"

                let driveFile = await getFile(driveId)

                let storeInfo = getFileStats(path.join(showsPath, name))?.stat

                let driveModified = driveFile ? new Date(driveFile.data.modifiedTime).getTime() : 0
                let storeModified = storeInfo?.mtimeMs || 0

                let newest: "same" | "cloud" | "local" = "same"
                if (!driveModified || storeModified > driveModified) newest = "local"
                else if (driveModified > storeModified + ONE_MINUTE_MS) newest = "cloud"

                if (newest === "same") return

                if (!driveId || !driveFile) {
                    let file = createFile(showsFolderId, { type: "json", name }, JSON.stringify([id, show]))
                    let response = await uploadFile(file)
                    shows[id].driveId = response.data.id
                    responses.push(response)
                    return
                }

                let p: string = path.resolve(showsPath, name)
                writeFile(p, driveFile.body, id)
            })
        )

        // TODO: update local+cloud shows (with driveIds)

        // // scriptures
        // if (data.scripturesCache) Object.entries(data.scripturesCache).forEach(saveScripture)
        // function saveScripture([id, value]: any) {
        //     let p: string = path.resolve(getDocumentsFolder(null, "Bibles"), value.name + ".fsb")
        //     writeFile(p, JSON.stringify([id, value]), id)
        // }

        // TODO: compare file versions, download/upload new files & download/upload the latest updated files (if difference is more than 2 minutes)
        // use shows file to find any updated shows (then double check the main files)
        //
        // update list
        // events.json
        // media.json ???
        // overlays.json
        // projects.json
        // settings.json
        // shows.json -> check each show
        // stage.json
        // templates.json
        // themes.json
        //
        // documents:
        // Bibles
        // (Shows (only from shows.json))
        //
        // return a list of things updated
    },
}

const storesToSave = ["SHOWS", "EVENTS", "OVERLAYS", "PROJECTS", "SETTINGS", "STAGE_SHOWS", "TEMPLATES", "THEMES"] // MEDIA

// TODO: drive media folder...
