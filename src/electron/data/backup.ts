import path from "path"
import { Main } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import type { SaveActions } from "../../types/Save"
import type { Show, Shows, TrimmedShow } from "../../types/Show"
import { sendMain, sendToMain } from "../IPC/main"
import { deleteFolder, doesPathExist, getDataFolderPath, getFileStats, getTimePointString, loadShows, makeDir, openInSystem, readFile, readFileAsync, readFolder, selectFilesDialog, writeFile, writeFileAsync } from "../utils/files"
import { wait } from "../utils/helpers"
import { _store, getStore, storeFilesData } from "./store"

export async function startBackup({ customTriggers }: { customTriggers: SaveActions }) {
    let shows = getStore("SHOWS")
    // let bibles = null

    // no need to backup shows on auto backup (as that just takes a lot of space)
    const isAutoBackup = !!customTriggers?.isAutoBackup

    const folderName = getTimePointString() + (isAutoBackup ? "_auto" : "")
    const backupFolder = getDataFolderPath("backups", folderName)

    // CONFIGS
    await Promise.all(
        Object.entries(storeFilesData).map(([id, data]) => {
            if (!data.portable) return
            syncStores(id as keyof typeof _store)
        })
    )
    // "SYNCED_SETTINGS" and "STAGE" has to be before "SETTINGS" and "SHOWS" (can't remember why)
    syncStores("SETTINGS")

    // SCRIPTURE
    // bibles are not backed up because they are located in the Bibles folder
    // if (bibles) await syncBibles()

    // SHOWS
    if (!isAutoBackup || customTriggers?.backupShows) await syncAllShows()

    sendToMain(ToMain.BACKUP, { finished: true, path: backupFolder })

    if (!isAutoBackup) openInSystem(backupFolder, true)

    /// //

    async function syncStores(id: keyof typeof _store) {
        const store = _store[id]
        if (!store) return

        const name = id + ".json"

        const content: string = JSON.stringify(store.store)
        const filePath: string = path.resolve(backupFolder, name)
        await writeFileAsync(filePath, content)
    }

    async function syncAllShows() {
        if (!shows) return

        const name = "SHOWS_CONTENT.json"
        const allShows: Shows = {}
        const showsPath = getDataFolderPath("shows")

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

export function getBackups() {
    const backupsFolder = getDataFolderPath("backups")
    const files = readFolder(backupsFolder)

    let backups: { path: string; name: string; date: number; size: number }[] = []
    files.forEach((name) => {
        const filePath = path.resolve(backupsFolder, name)
        const stat = getFileStats(filePath)
        if (!stat?.folder) return

        let size = 0
        readFolder(filePath).forEach((fileName) => {
            const fileStat = getFileStats(path.resolve(filePath, fileName))
            if (fileStat) size += fileStat.stat.size
        })
        if (size === 0) return

        backups.push({ path: filePath, name, date: stat.stat.ctimeMs, size })
    })

    return backups
}

export function deleteBackup(data: { path: string }) {
    if (!data?.path) return

    const backupsFolder = getDataFolderPath("backups")
    const folderPath = path.resolve(backupsFolder, data.path)

    deleteFolder(folderPath)
}

// RESTORE

// WIP should be case insensitive
export function restoreFiles(data?: { folder: string }) {
    let files: string[] = []

    if (data?.folder) {
        const backupsFolder = getDataFolderPath("backups", data.folder)
        files = readFolder(backupsFolder).map((name) => path.join(backupsFolder, name))
    } else {
        const initialPath = getDataFolderPath("backups")
        files = selectFilesDialog("", { name: "FreeShow Backup Files", extensions: ["json"] }, true, initialPath)
    }

    if (!files?.length) return sendToMain(ToMain.RESTORE2, { finished: false })
    sendToMain(ToMain.RESTORE2, { starting: true })

    const showsPath = getDataFolderPath("shows")
    const portableStoreFiles = Object.entries(storeFilesData)
        .filter(([_, data]) => data.portable)
        .map(([key, _]) => key)

    files.forEach((filePath: string) => {
        if (filePath.includes("SHOWS_CONTENT")) {
            restoreShows(filePath)
            return
        }

        if (filePath.includes("SETTINGS")) {
            restoreStore(filePath, "SETTINGS")
            return
        }

        const storeId = portableStoreFiles.find((a) => filePath.includes(a))

        if (!storeId) return
        restoreStore(filePath, storeId as keyof typeof _store)
    })

    sendToMain(ToMain.RESTORE2, { finished: true })
    return

    /// //

    function restoreStore(filePath: string, storeId: keyof typeof _store) {
        const file = readFile(filePath)
        if (!_store[storeId] || !file || !isValidJSON(file)) return

        const data = JSON.parse(file)

        _store[storeId]?.clear()
        _store[storeId]?.set(data)

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

        sendMain(Main.SHOWS, loadShows())
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
