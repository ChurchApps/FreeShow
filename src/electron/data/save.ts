import path from "path"
import type { Bible } from "../../types/Bible"
import type { Main } from "../../types/IPC/Main"
import { ToMain } from "../../types/IPC/ToMain"
import type { SaveData } from "../../types/Save"
import { currentlyDeletedShows } from "../cloud/drive"
import { startBackup } from "../data/backup"
import { defaultSettings, defaultSyncedSettings } from "../data/defaults"
import { stores } from "../data/store"
import { sendMain, sendToMain } from "../IPC/main"
import { checkShowsFolder, dataFolderNames, deleteFile, getDataFolder, writeFile } from "../utils/files"
import { renameShows } from "../utils/shows"

export function save(data: SaveData) {
    const reset = !!data.customTriggers?.changeUserData?.reset
    if (reset) {
        data.SETTINGS = JSON.parse(JSON.stringify(defaultSettings))
        data.SYNCED_SETTINGS = JSON.parse(JSON.stringify(defaultSyncedSettings))
    }

    // save to files
    Object.entries(stores).forEach(storeData as any)
    function storeData([key, store]: [keyof typeof stores, any]) {
        if (!(data as any)[key] || JSON.stringify(store.store) === JSON.stringify((data as any)[key])) return

        store.clear()
        store.set((data as any)[key])

        if (reset) sendMain(key as Main, (data as any)[key])
    }

    // scriptures
    let scripturePath = getDataFolder(data.dataPath, dataFolderNames.scriptures)
    if (data.scripturesCache) Object.entries(data.scripturesCache).forEach(saveScripture)
    function saveScripture([id, value]: [string, Bible]) {
        if (!value) return
        let p: string = path.join(scripturePath, value.name + ".fsb")
        writeFile(p, JSON.stringify([id, value]), id)
    }

    data.path = checkShowsFolder(data.path)
    // rename shows
    if (data.renamedShows) {
        let renamedShows = data.renamedShows.filter(({ id }: { id: string }) => !data.deletedShows?.find((a) => a.id === id))
        renameShows(renamedShows, data.path)
    }

    // let rename finish
    setTimeout(() => {
        // shows
        if (data.showsCache) Object.entries(data.showsCache).forEach(saveShow)
        function saveShow([id, value]: [string, any]) {
            if (!value) return
            let p: string = path.join(data.path, (value.name || id) + ".show")
            writeFile(p, JSON.stringify([id, value]), id)
        }

        // delete shows
        if (data.deletedShows) data.deletedShows.forEach(deleteShow)
        function deleteShow({ name, id }: { name: string; id: string }) {
            if (!name || data.showsCache?.[id]) return

            let p: string = path.join(data.path, (name || id) + ".show")
            deleteFile(p)

            // update cloud
            currentlyDeletedShows.push(id)
        }

        // SAVED
        if (!reset) {
            setTimeout(() => {
                sendToMain(ToMain.SAVE2, { closeWhenFinished: data.closeWhenFinished, customTriggers: data.customTriggers })
            }, 300)
        }

        if (data.customTriggers?.backup || data.customTriggers?.changeUserData) startBackup({ showsPath: data.path, dataPath: data.dataPath, scripturePath, customTriggers: data.customTriggers })
    }, 700)
}
