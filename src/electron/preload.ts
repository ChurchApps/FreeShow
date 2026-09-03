// ----- FreeShow -----
// Expose protected methods that allow the renderer process to use the ipcRenderer without exposing the entire object

import type { IpcRendererEvent } from "electron"
import { contextBridge, ipcRenderer, webUtils } from "electron"
import type { ValidChannels } from "../types/Channels"

// const maxInterval: number = 500
// const useTimeout: ValidChannels[] = ["STAGE", "REMOTE", "CONTROLLER", "OUTPUT_STREAM"]
// let lastChannel: string = ""

// wait to log messages until after intial load is done
let appLoaded = false
const LOG_MESSAGES: boolean = process.env.NODE_ENV !== "production"
const filteredChannelsData: string[] = ["PLAYING_VIDEO_STATE", "VISUALIZER_DATA", "STREAM", "BUFFER", "GET_THUMBNAIL", "ACTIVE_TIMERS", "RECEIVE_STREAM", "CHECK_RAM_USAGE", "TIMECODE_VALUE", "TIMECODE_AUDIO_DATA", "SPOTIFY_GET_STATE", "AI_AUDIO_DATA", "AI_TRANSCRIPT"]
const filteredChannels: ValidChannels[] = ["AUDIO"]

const storedReceivers: { [key: string]: (e: IpcRendererEvent, args: any) => void } = {}

contextBridge.exposeInMainWorld("api", {
    send: (channel: ValidChannels, data: any, id?: string) => {
        if (LOG_MESSAGES && appLoaded && !filteredChannels.includes(channel) && !filteredChannelsData.includes(data?.channel)) console.info("TO ELECTRON [" + channel + "]: ", data)
        // if (useTimeout.includes(channel) && data.channel === lastChannel && data.id) return

        ipcRenderer.send(channel, data, id)

        // lastChannel = data.channel
        // setTimeout(() => (lastChannel = ""), maxInterval)
    },
    receive: (channel: ValidChannels, func: any, id?: string) => {
        const receiver = (_e: IpcRendererEvent, args: any, listenedId?: string) => {
            if (!appLoaded && channel === "MAIN" && args?.channel === "SHOWS") setTimeout(() => (appLoaded = true), 5000)
            if (LOG_MESSAGES && appLoaded && !filteredChannels.includes(channel) && !filteredChannelsData.includes(args?.channel)) console.info("TO CLIENT [" + channel + "]: ", args)

            func(args, listenedId)
        }

        if (id && storedReceivers[id]) {
            ipcRenderer.removeListener(channel, storedReceivers[id])
        }

        ipcRenderer.on(channel, receiver)
        if (id) storedReceivers[id] = receiver
    },
    removeListener: (channel: ValidChannels, id: string) => {
        if (!storedReceivers[id]) return

        ipcRenderer.removeListener(channel, storedReceivers[id])
        delete storedReceivers[id]
    },
    getListeners: () => {
        return ipcRenderer.eventNames().map((channel) => [channel.toString(), ipcRenderer.listenerCount(channel)])
    },
    // https://www.electronjs.org/blog/electron-32-0#breaking-changes
    showFilePath(file: File) {
        return webUtils.getPathForFile(file)
    }
})

ipcRenderer.on("AUDIO_PORT", (event, data) => {
    if (event.ports && event.ports.length > 0) {
        window.postMessage({ type: "AUDIO_PORT_RESPONSE", targetId: data?.targetId }, "*", [event.ports[0]])
    }
})
