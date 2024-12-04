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

    const backupPath: string = getDataFolder(dataPath, dataFolderNames.backups)
    const backupFolder = createFolder(path.join(backupPath, getTimePointString()))

    // CONFIGS
    await Promise.all(storesToSave.map(syncStores))

    // SCRIPTURE
    // bibles are not backed up because the are located in the Bibles folder
    // if (bibles) await syncBibles()

    // SHOWS
    await syncAllShows()

    toApp(MAIN, {
        channel: "BACKUP",
        data: { finished: true, path: backupFolder },
    })

    if (customTriggers?.changeUserData) updateDataPath(customTriggers.changeUserData)
    else if (!customTriggers?.silent) openSystemFolder(backupFolder)

    return

    /////

    async function syncStores(id: string) {
        const store = stores[id]
        const name = id + ".json"

        if (id === "SHOWS") shows = store.store
        // else if (id === "SYNCED_SETTINGS") bibles = store.store?.scriptures

        const content: string = JSON.stringify(store.store)
        const p: string = path.resolve(backupFolder, name)
        writeFile(p, content)
    }

    async function syncAllShows() {
        if (!shows || !showsPath) return

        const name = "SHOWS_CONTENT.json"
        const allShows: any = {}

        await Promise.all(Object.entries(shows).map(checkShow))
        async function checkShow([id, show]: any) {
            const name = (show.name || id) + ".show"
            const localShowPath = path.join(showsPath, name)

            const localContent = readFile(localShowPath)
            if (localContent) allShows[id] = JSON.parse(localContent)[1]
        }

        const content: string = JSON.stringify(allShows)
        const p: string = path.resolve(backupFolder, name)
        writeFile(p, content)
    }
}

// RESTORE

export function restoreFiles({ showsPath }: any) {
    const files: any = selectFilesDialog("", {
        name: "FreeShow Backup Files",
        extensions: ["json"],
    })
    if (!files?.length) return toApp(MAIN, { channel: "RESTORE", data: { finished: false } })
    toApp(MAIN, { channel: "RESTORE", data: { starting: true } })

    // don't replace certain settings
    const settings = stores.SETTINGS.store
    const dataPath: string = settings.dataPath

    files.forEach((path: string) => {
        if (path.includes("SHOWS_CONTENT")) {
            restoreShows(path)
            return
        }

        const storeId = storesToSave.find((a) => path.includes(a))

        if (!storeId) return
        restoreStore(path, storeId)
    })

    toApp(MAIN, { channel: "RESTORE", data: { finished: true } })
    return

    /////

    function restoreStore(filePath: string, storeId: string) {
        const file = readFile(filePath)
        if (!stores[storeId] || !file || !isValidJSON(file)) return

        const data = JSON.parse(file)

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
        const file = readFile(filePath)
        if (!file || !isValidJSON(file)) return

        const shows = JSON.parse(file)

        // create Shows folder if it does not exist
        if (!doesPathExist(showsPath)) makeDir(showsPath)

        Object.entries(shows).forEach(saveShow)
        function saveShow([id, value]: any) {
            if (!value) return
            const p: string = path.resolve(showsPath, (value.name || id) + ".show")
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
