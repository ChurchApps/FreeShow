// ----- FreeShow -----
// Platform abstraction: the injectable surface that differs between the Electron
// main process and the headless Node server. Portable IPC handlers depend only
// on this interface, so the same handler logic can run in either environment.
//
// Electron-only capabilities (output windows, screen capture, NDI, MIDI, native
// dialogs, ...) are intentionally NOT part of the portable contract — they are
// provided directly by the Electron handler table and stubbed on headless, gated
// by `capabilities` so the UI never invokes an unavailable feature.

import type { CapabilitySet } from "./capabilities"

/** Result of a batched save: which library stores changed (for live broadcast) + completion info. */
export interface SaveResult {
    changed: Record<string, any>
    complete: { closeWhenFinished: boolean; customTriggers: any }
}

/** Persistence surface the portable handlers need (stores + shows + files). */
export interface PersistenceAdapter {
    // key/value stores (SETTINGS, SYNCED_SETTINGS, PROJECTS, OVERLAYS, TEMPLATES, SHOWS index, ...)
    getStore(id: string): any
    setStore(id: string, value: any): void
    getStoreValue(data: { file: string; key: string }): any
    setStoreValue(data: { file: string; key: string; value: any }): void

    // shows (.show files) + the trimmed index
    loadShow(msg: { id: string; name: string }): any
    loadShows(): any

    // batched persistence (the Main.SAVE handler payload); may return which library
    // stores changed so the server can broadcast them to other clients
    save(data: any): SaveResult | void | Promise<SaveResult | void>

    // scriptures/bibles
    loadScripture(msg: { id: string; name: string }): any
    readBiblesFolder(): { path: string; name: string }[]

    // generic file access
    readFile(filePath: string): string
    readFolder(dirPath: string): string[]
    // rich folder listing for the media/audio drawer (path -> FileFolder map)
    readFolderContent(data: { path: string | string[]; depth?: number; captureFolderContent?: boolean; generateThumbnails?: boolean }): Record<string, any>
    // create a subfolder within `path`; returns the new folder's (sandbox-relative) path
    createFolder(data: { path: string; name: string }): string

    // data folder locations
    getDataFolderRoot(): string
    getDataFolderPath(id: string): string
}

export interface Platform {
    id: "electron" | "headless"
    capabilities: CapabilitySet
    data: PersistenceAdapter

    // lightweight app/device info (portable)
    getVersion(): string
    getOS(): { platform: string; name: string; arch: string }
    getDeviceId(): string
    getDeviceName(): string
    getLocalIPs(): any
}
