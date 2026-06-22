import fs from "fs"
import path from "path"
import { Main } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import type { SaveActions } from "../../types/Save"
import type { Show, Shows } from "../../types/Show"
import { sendMain, sendToMain } from "../IPC/main"
import { deleteFile, deleteFolder, doesPathExist, getDataFolderPath, getFileStats, getTimePointString, loadShows, makeDir, openInSystem, readFile, readFolder, selectFilesDialog, writeFile } from "../utils/files"
import { _store, setStore, storeFilesData } from "./store"
import { compressToZip, decompressZip } from "./zip"

export async function startBackup({ customTriggers, isCloudSync }: { customTriggers?: SaveActions; isCloudSync?: boolean } = {}): Promise<{ entries?: { name: string; content?: string | Buffer; filePath?: string }[]; path?: string } | void> {
    // no need to backup shows on auto backup (as that just takes a lot of space)
    const isAutoBackup = !!customTriggers?.isAutoBackup

    const folderName = getTimePointString() + (isAutoBackup ? "_auto" : "")
    const backupFolder = path.join(getDataFolderPath("backups"), folderName)
    const entries: { name: string; content?: string | Buffer; filePath?: string }[] = []

    // CONFIGS
    await Promise.all(
        Object.entries(storeFilesData).map(async ([id, data]) => {
            if (!data.portable) return
            await syncStores(id as keyof typeof _store)
        })
    )

    // bibles are not backed up because they are located in the Bibles folder
    if (isCloudSync) {
        await syncStores("MEDIA") // sync media data
        await syncBibles()
    } else {
        // "SYNCED_SETTINGS" and "STAGE" has to be before "SETTINGS" and "SHOWS" (can't remember why)
        await syncStores("SETTINGS")
    }

    // SHOWS
    if (!isAutoBackup || customTriggers?.backupShows) await syncAllShows()

    if (isCloudSync) return { entries }

    const zipPath = backupFolder + ".zip"
    await compressToZip(entries, zipPath)

    sendToMain(ToMain.BACKUP, { finished: true, path: zipPath })

    if (!isAutoBackup) openInSystem(zipPath, true)

    /// //

    async function syncStores(id: keyof typeof _store) {
        const store = _store[id]
        if (!store) return

        const name = id + ".json"
        entries.push({ name, filePath: store.path })
    }

    async function syncBibles() {
        const biblesPath = getDataFolderPath("scriptures")
        if (!fs.existsSync(biblesPath)) return

        const bibleFiles = readFolder(biblesPath)

        bibleFiles.forEach((fileName) => {
            const sourcePath = path.join(biblesPath, fileName)
            const destPath = `BIBLE_${fileName}`
            entries.push({ name: destPath, filePath: sourcePath })
        })
    }

    async function syncAllShows() {
        const showsPath = getDataFolderPath("shows")
        if (!fs.existsSync(showsPath)) return

        const showFilesOnDisk = readFolder(showsPath)

        for (const fileName of showFilesOnDisk) {
            if (fileName.toLowerCase().endsWith(".show")) {
                entries.push({ name: "SHOWS/" + fileName, filePath: path.join(showsPath, fileName) })
            }
        }
    }
}

export function getBackups() {
    const backupsFolder = getDataFolderPath("backups")
    const files = readFolder(backupsFolder)

    const backups: { path: string; name: string; date: number; size: number }[] = []
    files.forEach((name) => {
        const filePath = path.resolve(backupsFolder, name)
        const stat = getFileStats(filePath)
        if (!stat) return

        if (name.endsWith(".zip")) {
            backups.push({ path: filePath, name: name.replace(".zip", ""), date: stat.stat.ctimeMs, size: stat.stat.size })
        } else if (stat.folder) {
            let size = 0
            readFolder(filePath).forEach((fileName) => {
                const fileStat = getFileStats(path.resolve(filePath, fileName))
                if (fileStat) size += fileStat.stat.size
            })
            if (size > 0) backups.push({ path: filePath, name, date: stat.stat.ctimeMs, size })
        }
    })

    return backups
}

export function deleteBackup(data: { path: string }) {
    if (!data?.path) return

    const backupsFolder = getDataFolderPath("backups")
    const folderPath = path.resolve(backupsFolder, data.path)

    const stats = getFileStats(folderPath)
    if (stats?.folder) deleteFolder(folderPath)
    else deleteFile(folderPath)
}

// RESTORE

export async function restoreFiles(data?: { path: string }) {
    let files: { name: string; content: string | Buffer }[] = []

    if (data?.path) {
        if (data.path.endsWith(".zip")) {
            const decompressed = await decompressZip([data.path], false)
            files = decompressed.map((d) => ({ name: d.name, content: d.content }))
        } else {
            files = readFolder(data.path).map((name) => ({ name, content: readFile(path.join(data.path, name)) || "" }))
        }
    } else {
        const initialPath = getDataFolderPath("backups")
        const selectedPaths = selectFilesDialog("", { name: "FreeShow Backup Files", extensions: ["json", "zip"] }, true, initialPath)

        if (selectedPaths?.length) {
            for (const p of selectedPaths) {
                if (p.endsWith(".zip")) {
                    const decompressed = await decompressZip([p], false)
                    files.push(...decompressed.map((d) => ({ name: d.name, content: d.content })))
                } else {
                    files.push({ name: path.basename(p), content: readFile(p) || "" })
                }
            }
        }
    }

    if (!files?.length) return sendToMain(ToMain.RESTORE2, { finished: false })
    sendToMain(ToMain.RESTORE2, { starting: true })

    const showsPath = getDataFolderPath("shows")
    const portableStoreFiles = Object.entries(storeFilesData)
        .filter(([_, data]) => data.portable)
        .map(([key, _]) => key)

    let showsRestored = false
    files.forEach((file: { name: string; content: string | Buffer }) => {
        if (typeof file.content !== "string") return
        const filePath = file.name

        if (filePath.includes("SHOWS_CONTENT")) {
            restoreShows(file.content)
            showsRestored = true
            return
        }

        if (filePath.startsWith("SHOWS/")) {
            restoreSingleShow(file.name, file.content)
            showsRestored = true
            return
        }

        if (filePath.includes("SETTINGS")) {
            restoreStore(file.content, "SETTINGS")
            return
        }

        const storeId = portableStoreFiles.find((a) => filePath.includes(a))

        if (!storeId) return
        restoreStore(file.content, storeId as keyof typeof _store)
    })

    if (showsRestored) sendMain(Main.SHOWS, loadShows())

    sendToMain(ToMain.RESTORE2, { finished: true })
    return

    /// //

    function restoreStore(file: string, storeId: keyof typeof _store) {
        if (!_store[storeId] || !file || !isValidJSON(file)) return

        const data = JSON.parse(file)

        if (storeId === "SETTINGS") {
            delete data.dataPath
            delete data.showsPath
        }

        setStore(_store[storeId], data)

        sendMain(storeId as Main, data)
    }

    function restoreShows(file: string) {
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

    function restoreSingleShow(name: string, content: string) {
        if (!content || !isValidJSON(content)) return

        const fileName = path.basename(name)
        const showPath = path.resolve(showsPath, fileName)

        if (!doesPathExist(showsPath)) makeDir(showsPath)
        writeFile(showPath, content)
    }
}

export function isValidJSON(file: string) {
    try {
        JSON.parse(file)
        return true
    } catch {
        return false
    }
}
