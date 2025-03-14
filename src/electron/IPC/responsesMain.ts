import { app } from "electron"
import { machineIdSync } from "node-machine-id"
import os from "os"
import { getMainWindow, isProd } from ".."
import { Main, MainResponses } from "../../types/IPC/Main"
import { save } from "../data/save"
import { getStore, updateDataPath, userDataPath } from "../data/store"
import { getTempPaths } from "../utils/files"

export const mainResponses: MainResponses = {
    [Main.SAVE]: async (a) => {
        if (userDataPath === null) updateDataPath()
        save(a)
    },
    ////////
    // GENERAL
    [Main.VERSION]: () => app.getVersion(),
    [Main.IS_DEV]: () => !isProd,
    [Main.GET_OS]: () => ({ platform: os.platform(), name: os.hostname(), arch: os.arch() }),
    [Main.GET_TEMP_PATHS]: () => getTempPaths(),
    [Main.DEVICE_ID]: () => machineIdSync(),
    [Main.MAXIMIZED]: () => !!getMainWindow()?.isMaximized(),
    // STORES
    [Main.SYNCED_SETTINGS]: () => getStore("SYNCED_SETTINGS"),
    [Main.STAGE_SHOWS]: () => getStore("STAGE_SHOWS"),
    [Main.PROJECTS]: () => getStore("PROJECTS"),
    [Main.OVERLAYS]: () => getStore("OVERLAYS"),
    [Main.TEMPLATES]: () => getStore("TEMPLATES"),
    [Main.EVENTS]: () => getStore("EVENTS"),
    [Main.MEDIA]: () => getStore("MEDIA"),
    [Main.THEMES]: () => getStore("THEMES"),
    [Main.DRIVE_API_KEY]: () => getStore("DRIVE_API_KEY"),
    [Main.HISTORY]: () => getStore("HISTORY"),
    [Main.USAGE]: () => getStore("USAGE"),
    [Main.CACHE]: () => getStore("CACHE"),
}
