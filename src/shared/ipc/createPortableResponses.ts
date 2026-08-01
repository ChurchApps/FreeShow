// ----- FreeShow -----
// Portable IPC handlers: the subset of the main-process `mainResponses` table
// (src/electron/IPC/responsesMain.ts) that has no Electron dependency once it
// goes through the Platform's PersistenceAdapter. Both the headless server and
// (eventually) the Electron main process can compose this.
//
// Handlers here return values the same way the desktop handlers do — the caller
// (socket server / ipc) replies over the MAIN transport.

import { Main } from "../../types/IPC/channels"
import type { Platform } from "../platform/Platform"

type Handler = (data?: any) => any
export type PortableResponses = Partial<Record<Main, Handler>>

export function createPortableResponses(platform: Platform): PortableResponses {
    const { data } = platform

    return {
        // DEV
        [Main.LOG]: (d) => console.info(d),
        [Main.IS_DEV]: () => false,
        [Main.GET_CACHE_PATH]: () => data.getDataFolderPath("onlineMedia"),

        // APP / DEVICE
        [Main.VERSION]: () => platform.getVersion(),
        [Main.GET_OS]: () => platform.getOS(),
        [Main.DEVICE_ID]: () => platform.getDeviceId(),
        [Main.GET_DEVICE_NAME]: () => platform.getDeviceName(),
        [Main.IP]: () => platform.getLocalIPs(),
        [Main.CHECK_RAM_USAGE]: () => ({ performanceMode: false }),

        // STORES (getters)
        [Main.SETTINGS]: () => data.getStore("SETTINGS"),
        [Main.SYNCED_SETTINGS]: () => data.getStore("SYNCED_SETTINGS"),
        [Main.STAGE]: () => data.getStore("STAGE"),
        [Main.PROJECTS]: () => data.getStore("PROJECTS"),
        [Main.OVERLAYS]: () => data.getStore("OVERLAYS"),
        [Main.TEMPLATES]: () => data.getStore("TEMPLATES"),
        [Main.EVENTS]: () => data.getStore("EVENTS"),
        [Main.MEDIA]: () => data.getStore("MEDIA"),
        [Main.THEMES]: () => data.getStore("THEMES"),
        [Main.DRIVE_API_KEY]: () => data.getStore("DRIVE_API_KEY"),
        [Main.HISTORY]: () => data.getStore("HISTORY"),
        [Main.USAGE]: () => data.getStore("USAGE"),
        [Main.CACHE]: () => data.getStore("CACHE"),
        [Main.GET_STORE_VALUE]: (d) => data.getStoreValue(d),
        [Main.SET_STORE_VALUE]: (d) => data.setStoreValue(d),

        // SAVE
        [Main.SAVE]: (d) => data.save(d),

        // SHOWS
        [Main.SHOW]: (d) => data.loadShow(d),
        [Main.SHOWS]: () => data.loadShows(),
        [Main.FULL_SHOWS_LIST]: () => data.loadShows(),

        // SCRIPTURE
        [Main.BIBLE]: (d) => data.loadScripture(d),
        [Main.READ_BIBLES_FOLDER]: () => data.readBiblesFolder(),

        // PATHS
        [Main.DATA_PATH]: () => data.getDataFolderRoot(),
        [Main.GET_PATHS]: () => ({}),

        // FILES
        [Main.READ_FILE]: (d) => ({ content: data.readFile(d.path) }),
        [Main.READ_FOLDER]: (d) => data.readFolderContent(d),
        [Main.CREATE_FOLDER]: (d) => data.createFolder(d),

        // WINDOW (no-ops on headless; UI is gated by capabilities.windowControls)
        [Main.MAXIMIZED]: () => false,
        [Main.MAXIMIZE]: () => undefined,
        [Main.MINIMIZE]: () => undefined,
        [Main.FULLSCREEN]: () => undefined,
        [Main.CLOSE]: () => undefined
    }
}
