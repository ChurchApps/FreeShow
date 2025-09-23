import path from "path"
import type { Main } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import type { SaveActions } from "../../types/Save"
import type { Show, Shows, TrimmedShow, TrimmedShows } from "../../types/Show"
import { sendMain, sendToMain } from "../IPC/main"
import { createFolder, dataFolderNames, doesPathExist, getDataFolder, getTimePointString, makeDir, openInSystem, readFile, readFileAsync, selectFilesDialog, writeFile, writeFileAsync } from "../utils/files"
import { stores, updateDataPath } from "./store"
import { wait } from "../utils/helpers"

// "SYNCED_SETTINGS" and "STAGE_SHOWS" has to be before "SETTINGS" and "SHOWS"
const storesToSave: (keyof typeof stores)[] = ["SYNCED_SETTINGS", "STAGE_SHOWS", "SHOWS", "EVENTS", "OVERLAYS", "PROJECTS", "SETTINGS", "TEMPLATES", "THEMES", "MEDIA"]
// don't upload: config.json, cache.json, history.json, DRIVE_API_KEY.json

export async function startBackup({ showsPath, dataPath, customTriggers }: { showsPath: string; dataPath: string; customTriggers: SaveActions }) {
    let shows: TrimmedShows | null = null
    // let bibles = null

    // no need to backup shows on auto backup (as that just takes a lot of space)
    const isAutoBackup = !!customTriggers?.isAutoBackup

    const backupPath: string = getDataFolder(dataPath, dataFolderNames.backups)
    const backupFolder = createFolder(path.join(backupPath, getTimePointString() + (isAutoBackup ? "_auto" : "")))

    // CONFIGS
    await Promise.all(storesToSave.map(syncStores))

    // SCRIPTURE
    // bibles are not backed up because they are located in the Bibles folder
    // if (bibles) await syncBibles()

    // SHOWS
    if (!isAutoBackup || customTriggers?.backupShows) await syncAllShows()

    sendToMain(ToMain.BACKUP, { finished: true, path: backupFolder })

    if (customTriggers?.changeUserData) updateDataPath(customTriggers.changeUserData)
    else if (!isAutoBackup) openInSystem(backupFolder, true)

    /// //

    async function syncStores(id: keyof typeof stores) {
        const store = stores[id]
        const name = id + ".json"

        if (id === "SHOWS" && isAutoBackup) return
        if (id === "SHOWS") shows = store.store as TrimmedShows
        // else if (id === "SYNCED_SETTINGS") bibles = store.store?.scriptures

        const content: string = JSON.stringify(store.store)
        const filePath: string = path.resolve(backupFolder, name)
        await writeFileAsync(filePath, content)
    }

    async function syncAllShows() {
        if (!shows || !showsPath) return

        const name = "SHOWS_CONTENT.json"
        const allShows: Shows = {}

        await Promise.all(Object.entries(shows).map(checkShow))
        async function checkShow([id, show]: [string, TrimmedShow]) {
            const fileName = (show.name || id) + ".show"
            const localShowPath = path.join(showsPath, fileName)

            const localContent = await readFileAsync(localShowPath)
            if (localContent && isValidJSON(localContent)) allShows[id] = JSON.parse(localContent)[1]
        }

        // ensure all shows are added correctly
        // https://github.com/ChurchApps/FreeShow/issues/1492
        await wait(Object.keys(shows).length * 0.4)

        const content: string = JSON.stringify(allShows)
        const filePath: string = path.resolve(backupFolder, name)
        await writeFileAsync(filePath, content)
    }
}

// RESTORE

export function restoreFiles({ showsPath }: { showsPath: string }) {
    const files = selectFilesDialog("", { name: "FreeShow Backup Files", extensions: ["json"] })
    if (!files?.length) return sendToMain(ToMain.RESTORE2, { finished: false })
    sendToMain(ToMain.RESTORE2, { starting: true })

    // don't replace certain settings
    const settings = stores.SETTINGS.store
    const dataPath: string = settings.dataPath

    files.forEach((filePath: string) => {
        if (filePath.includes("SHOWS_CONTENT")) {
            restoreShows(filePath)
            return
        }

        const storeId = storesToSave.find((a) => filePath.includes(a))

        if (!storeId) return
        restoreStore(filePath, storeId)
    })

    sendToMain(ToMain.RESTORE2, { finished: true })
    return

    /// //

    function restoreStore(filePath: string, storeId: keyof typeof stores) {
        const file = readFile(filePath)
        if (!stores[storeId] || !file || !isValidJSON(file)) return

        const data = JSON.parse(file)

        // don't replace certain settings
        if (storeId === "SETTINGS") {
            data.dataPath = dataPath
            data.showsPath = showsPath
        }

        stores[storeId].clear()
            ; (stores[storeId] as any).set(data)
        // WIP restoring synced settings will reset settings
        sendMain(storeId as Main, data)
    }

    function restoreShows(filePath: string) {
        const file = readFile(filePath)
        if (!file || !isValidJSON(file)) return

        const shows: Shows = JSON.parse(file)

        // create Shows folder if it does not exist
        if (!doesPathExist(showsPath)) makeDir(showsPath)

        Object.entries(shows).forEach(saveShow)
        function saveShow([id, value]: [string, Show]) {
            if (!value) return
            const showPath: string = path.resolve(showsPath, (value.name || id) + ".show")
            writeFile(showPath, JSON.stringify([id, value]), id)
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
