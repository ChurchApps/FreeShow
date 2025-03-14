// ----- FreeShow -----
// Expose protected methods that allow the renderer process to use the ipcRenderer without exposing the entire object

import { IpcRendererEvent, contextBridge, ipcRenderer, webUtils } from "electron"
import type { ValidChannels } from "../types/Channels"

// const maxInterval: number = 500
// const useTimeout: ValidChannels[] = ["STAGE", "REMOTE", "CONTROLLER", "OUTPUT_STREAM"]
// let lastChannel: string = ""

// wait to log messages until after intial load is done
let appLoaded: boolean = false
const LOG_MESSAGES: boolean = process.env.NODE_ENV !== "production"
const filteredChannelsData: string[] = ["AUDIO_MAIN", "VIZUALISER_DATA", "STREAM", "BUFFER", "REQUEST_STREAM", "MAIN_TIME", "GET_THUMBNAIL", "ACTIVE_TIMERS", "RECEIVE_STREAM"]
const filteredChannels: ValidChannels[] = ["AUDIO"]

let storedReceivers: any = {}

contextBridge.exposeInMainWorld("api", {
    send: (channel: ValidChannels, data: any) => {
        if (LOG_MESSAGES && appLoaded && !filteredChannels.includes(channel) && !filteredChannelsData.includes(data?.channel)) console.log("TO ELECTRON [" + channel + "]: ", data)
        // if (useTimeout.includes(channel) && data.channel === lastChannel && data.id) return

        ipcRenderer.send(channel, data)

        // lastChannel = data.channel
        // setTimeout(() => (lastChannel = ""), maxInterval)
    },
    receive: (channel: ValidChannels, func: any, id: string = "") => {
        const receiver = (_e: IpcRendererEvent, args: any) => {
            if (!appLoaded && channel === "STORE" && args[0]?.channel === "SHOWS") setTimeout(() => (appLoaded = true), 3000)
            if (LOG_MESSAGES && appLoaded && !filteredChannels.includes(channel) && !filteredChannelsData.includes(args[0]?.channel)) console.log("TO CLIENT [" + channel + "]: ", ...args)

            func(args, id)
        }

        ipcRenderer.on(channel, receiver)
        if (id) storedReceivers[id] = receiver
    },
    removeListener: (channel: ValidChannels, id: string) => {
        if (!storedReceivers[id]) return

        ipcRenderer.removeListener(channel, storedReceivers[id])
        delete storedReceivers[id]
    },
    // https://www.electronjs.org/blog/electron-32-0#breaking-changes
    showFilePath(file: File) {
        return webUtils.getPathForFile(file)
    },
})
