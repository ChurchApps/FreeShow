import type { Bible } from "json-bible/lib/Bible"
import path from "path"
import type { Main } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import type { SaveData } from "../../types/Save"
import { currentlyDeletedShows } from "../cloud/drive"
import { startBackup } from "../data/backup"
import { defaultSettings, defaultSyncedSettings } from "../data/defaults"
import { _store } from "../data/store"
import { sendMain, sendToMain } from "../IPC/main"
import { deleteFile, doesPathExist, getDataFolderPath, parseShow, readFile, writeFile } from "../utils/files"
import { clone, wait } from "../utils/helpers"
import { renameShows } from "../utils/shows"

let isSaving = false
export async function save(data: SaveData) {
    if (isSaving) return
    isSaving = true

    const reset = !!data.customTriggers?.reset
    if (reset) {
        data.SETTINGS = clone(defaultSettings)
        data.SYNCED_SETTINGS = clone(defaultSyncedSettings)
    }

    // save to files
    Object.entries(_store).forEach(storeData as any)
    function storeData([key, store]: [keyof typeof _store, any]) {
        if (!(data as any)[key] || checkIfMatching(store.store, (data as any)[key])) return

        store.clear()
        store.set((data as any)[key])

        if (reset) sendMain(key as Main, (data as any)[key])
    }

    // scriptures
    const scriptureFolderPath = getDataFolderPath("scriptures")
    if (data.scripturesCache) Object.entries(data.scripturesCache).forEach(saveScripture)
    function saveScripture([id, value]: [string, Bible]) {
        if (!value) return
        const filePath: string = path.join(scriptureFolderPath, value.name + ".fsb")
        writeFile(filePath, JSON.stringify([id, value]), id)
    }

    const showsPath = getDataFolderPath("shows")
    // rename shows
    if (data.renamedShows) {
        const renamedShows = data.renamedShows.filter(({ id }: { id: string }) => !data.deletedShows?.find((a) => a.id === id))
        renameShows(renamedShows, showsPath)
        // rename should be sync, but sometimes it might not be finished right away
        // so add some extra wait time just in case
        await wait(200)
    }

    // shows
    if (data.showsCache) Object.entries(data.showsCache).forEach(saveShow)
    function saveShow([id, value]: [string, any]) {
        if (!value) return
        const filePath: string = path.join(showsPath, String(value.name || id) + ".show")
        writeFile(filePath, JSON.stringify([id, value]), id)
    }

    // delete shows
    if (data.deletedShows) data.deletedShows.forEach(deleteShow)
    function deleteShow({ name, id }: { name: string; id: string }) {
        if (!id || data.showsCache?.[id]) return

        const filePath: string = path.join(showsPath, (name || id) + ".show")
        if (!doesPathExist(filePath)) return

        // load file to double check the ID (as a new show with the same name might have been created)
        const jsonData = readFile(filePath) || "{}"
        const show = parseShow(jsonData)
        if (show?.[0] !== id) return

        deleteFile(filePath)

        // update cloud
        currentlyDeletedShows.push(id)
    }

    // SAVED

    if (data.customTriggers?.backup || data.customTriggers?.reset) startBackup({ customTriggers: data.customTriggers })

    if (data.closeWhenFinished) await wait(300) // make sure files are written before closing
    if (!reset) sendToMain(ToMain.SAVE2, { closeWhenFinished: data.closeWhenFinished, customTriggers: data.customTriggers })

    isSaving = false
}

// a few keys might not be placed in the same order in JS object vs store file
function checkIfMatching(a: object, b: object): boolean {
    return JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())
}
