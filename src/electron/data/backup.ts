import path from "path"
import type { Main } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import type { SaveActions } from "../../types/Save"
import type { Show, Shows, TrimmedShow, TrimmedShows } from "../../types/Show"
import { sendMain, sendToMain } from "../IPC/main"
import { createFolder, dataFolderNames, doesPathExist, getDataFolder, getTimePointString, makeDir, openSystemFolder, readFile, readFileAsync, selectFilesDialog, writeFile, writeFileAsync } from "../utils/files"
import { stores, updateDataPath } from "./store"
import { wait } from "../utils/helpers"

// "SYNCED_SETTINGS" and "STAGE_SHOWS" has to be before "SETTINGS" and "SHOWS"
const storesToSave: (keyof typeof stores)[] = ["SYNCED_SETTINGS", "STAGE_SHOWS", "SHOWS", "EVENTS", "OVERLAYS", "PROJECTS", "SETTINGS", "TEMPLATES", "THEMES", "MEDIA"]
// don't upload: config.json, cache.json, history.json, DRIVE_API_KEY.json

export async function startBackup({ showsPath, dataPath, scripturePath, customTriggers }: { showsPath: string; dataPath: string; scripturePath: string; customTriggers: SaveActions }) {
    let shows: TrimmedShows | null = null
    // let bibles = null
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

    sendToMain(ToMain.BACKUP, { finished: true, path: backupFolder })

    if (customTriggers?.changeUserData) updateDataPath(customTriggers.changeUserData)
    else if (!customTriggers?.silent) openSystemFolder(backupFolder)

    /////

    async function syncStores(id: keyof typeof stores) {
        let store = stores[id]
        let name = id + ".json"

        if (id === "SHOWS") shows = store.store as TrimmedShows
        // else if (id === "SYNCED_SETTINGS") bibles = store.store?.scriptures

        let content: string = JSON.stringify(store.store)
        let p: string = path.resolve(backupFolder, name)
        await writeFileAsync(p, content)
    }

    async function syncAllShows() {
        if (!shows || !showsPath) return

        let name: string = "SHOWS_CONTENT.json"
        let allShows: Shows = {}

        await Promise.all(Object.entries(shows).map(checkShow))
        async function checkShow([id, show]: [string, TrimmedShow]) {
            let name = (show.name || id) + ".show"
            let localShowPath = path.join(showsPath, name)

            let localContent = await readFileAsync(localShowPath)
            if (localContent && isValidJSON(localContent)) allShows[id] = JSON.parse(localContent)[1]
        }

        // ensure all shows are added correctly
        // https://github.com/ChurchApps/FreeShow/issues/1492
        await wait(Object.keys(shows).length * 0.4)

        let content: string = JSON.stringify(allShows)
        let p: string = path.resolve(backupFolder, name)
        await writeFileAsync(p, content)
    }
}

// RESTORE

export function restoreFiles({ showsPath }: { showsPath: string }) {
    let files = selectFilesDialog("", { name: "FreeShow Backup Files", extensions: ["json"] })
    if (!files?.length) return sendToMain(ToMain.RESTORE2, { finished: false })
    sendToMain(ToMain.RESTORE2, { starting: true })

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

    sendToMain(ToMain.RESTORE2, { finished: true })
    return

    /////

    function restoreStore(filePath: string, storeId: keyof typeof stores) {
        let file = readFile(filePath)
        if (!stores[storeId] || !file || !isValidJSON(file)) return

        let data = JSON.parse(file)

        // don't replace certain settings
        if (storeId === "SETTINGS") {
            data.dataPath = dataPath
            data.showsPath = showsPath
        }

        stores[storeId].clear()
        ;(stores[storeId] as any).set(data)
        // WIP restoring synced settings will reset settings
        sendMain(storeId as Main, data)
    }

    function restoreShows(filePath: string) {
        let file = readFile(filePath)
        if (!file || !isValidJSON(file)) return

        let shows: Shows = JSON.parse(file)

        // create Shows folder if it does not exist
        if (!doesPathExist(showsPath)) makeDir(showsPath)

        Object.entries(shows).forEach(saveShow)
        function saveShow([id, value]: [string, Show]) {
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
