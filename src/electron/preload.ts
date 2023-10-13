// ----- FreeShow -----
// Expose protected methods that allow the renderer process to use the ipcRenderer without exposing the entire object

import type { ValidChannels } from "../types/Channels"
import { contextBridge, ipcRenderer } from "electron"

// const maxInterval: number = 500
// const useTimeout: ValidChannels[] = ["STAGE", "REMOTE", "CONTROLLER", "OUTPUT_STREAM"]
// let lastChannel: string = ""

const debug: boolean = true
const filteredChannels: any[] = ["AUDIO_MAIN", "VIZUALISER_DATA", "STREAM", "PREVIEW", "REQUEST_STREAM"]

contextBridge.exposeInMainWorld("api", {
    send: (channel: ValidChannels, data: any) => {
        if (debug && !filteredChannels.includes(data?.channel)) console.log("TO ELECTRON [" + channel + "]: ", data)
        // if (useTimeout.includes(channel) && data.channel === lastChannel && data.id) return

        ipcRenderer.send(channel, data)

        // lastChannel = data.channel
        // setTimeout(() => (lastChannel = ""), maxInterval)
    },
    receive: (channel: ValidChannels, func: any) => {
        ipcRenderer.on(channel, (_e, ...args) => {
            if (debug && !filteredChannels.includes(args[0]?.channel)) console.log("TO CLIENT [" + channel + "]: ", ...args)

            func(...args)
        })
    },
})
