import path from "path"
import { toApp } from ".."
import { MAIN, STORE } from "../../types/Channels"
import { createFolder, dataFolderNames, doesPathExist, getDataFolder, getTimePointString, makeDir, openSystemFolder, readFile, selectFilesDialog, writeFile } from "../utils/files"
import { stores, updateDataPath } from "./store"

// "SYNCED_SETTINGS" and "STAGE_SHOWS" has to be before "SETTINGS" and "SHOWS"
const storesToSave = ["SYNCED_SETTINGS", "STAGE_SHOWS", "SHOWS", "EVENTS", "OVERLAYS", "PROJECTS", "SETTINGS", "TEMPLATES", "THEMES", "MEDIA"]
// don't upload: config.json, cache.json, history.json, DRIVE_API_KEY.json

export async function startBackup({ showsPath, dataPath, scripturePath, customTriggers }: any) {
    let shows: any = null
    // let bibles: any = null
    console.log(scripturePath)

    let backupPath: string = getDataFolder(dataPath, dataFolderNames.backups)
    let backupFolder = createFolder(path.join(backupPath, getTimePointString()))

    // CONFIGS
    await Promise.all(storesToSave.map(syncStores))

    // SCRIPTURE
    // bibles are not backed up because the are located in the Bibles folder
    // if (bibles) await syncBibles()

    // SHOWS
    await syncAllShows()

    toApp(MAIN, { channel: "BACKUP", data: { finished: true, path: backupFolder } })

    if (customTriggers?.changeUserData) updateDataPath(customTriggers.changeUserData)
    else if (!customTriggers?.silent) openSystemFolder(backupFolder)

    return

    /////

    async function syncStores(id: string) {
        let store = stores[id]
        let name = id + ".json"

        if (id === "SHOWS") shows = store.store
        // else if (id === "SYNCED_SETTINGS") bibles = store.store?.scriptures

        let content: string = JSON.stringify(store.store)
        let p: string = path.resolve(backupFolder, name)
        writeFile(p, content)
    }

    async function syncAllShows() {
        if (!shows || !showsPath) return

        let name: string = "SHOWS_CONTENT.json"
        let allShows: any = {}

        await Promise.all(Object.entries(shows).map(checkShow))
        async function checkShow([id, show]: any) {
            let name = (show.name || id) + ".show"
            let localShowPath = path.join(showsPath, name)

            let localContent = readFile(localShowPath)
            if (localContent && isValidJSON(localContent)) allShows[id] = JSON.parse(localContent)[1]
        }

        let content: string = JSON.stringify(allShows)
        let p: string = path.resolve(backupFolder, name)
        writeFile(p, content)
    }
}

// RESTORE

export function restoreFiles({ showsPath }: any) {
    let files: any = selectFilesDialog("", { name: "FreeShow Backup Files", extensions: ["json"] })
    if (!files?.length) return toApp(MAIN, { channel: "RESTORE", data: { finished: false } })
    toApp(MAIN, { channel: "RESTORE", data: { starting: true } })

    // don't replace certain settings
    let settings = stores.SETTINGS.store
    let dataPath: string = settings.dataPath

    files.forEach((path: string) => {
        if (path.includes("SHOWS_CONTENT")) {
            restoreShows(path)
            return
        }

        let storeId = storesToSave.find((a) => path.includes(a))

        if (!storeId) return
        restoreStore(path, storeId)
    })

    toApp(MAIN, { channel: "RESTORE", data: { finished: true } })
    return

    /////

    function restoreStore(filePath: string, storeId: string) {
        let file = readFile(filePath)
        if (!stores[storeId] || !file || !isValidJSON(file)) return

        let data = JSON.parse(file)

        // don't replace certain settings
        if (storeId === "SETTINGS") {
            data.dataPath = dataPath
            data.showsPath = showsPath
        }

        stores[storeId].clear()
        stores[storeId].set(data)
        // WIP restoring synced settings will reset settings
        toApp(STORE, { channel: storeId, data })
    }

    function restoreShows(filePath: string) {
        let file = readFile(filePath)
        if (!file || !isValidJSON(file)) return

        let shows = JSON.parse(file)

        // create Shows folder if it does not exist
        if (!doesPathExist(showsPath)) makeDir(showsPath)

        Object.entries(shows).forEach(saveShow)
        function saveShow([id, value]: any) {
            if (!value) return
            let p: string = path.resolve(showsPath, (value.name || id) + ".show")
            writeFile(p, JSON.stringify([id, value]), id)
        }
    }
}

function isValidJSON(file: string) {
    try {
        JSON.parse(file)
        return true
    } catch {
        return false
    }
}
