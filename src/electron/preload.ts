import type { ValidChannels } from "../types/Channels"
import { contextBridge, ipcRenderer } from "electron"

// Expose protected methods that allow the renderer process to use the ipcRenderer without exposing the entire object
const maxInterval: number = 1000
const channels: ValidChannels[] = ["STAGE", "REMOTE", "CONTROLLER"]
const filters: any[] = ["AUDIO_MAIN", "VIZUALISER_DATA"]
// let timeout: any = null
let ready: boolean = true
let debug: boolean = true
contextBridge.exposeInMainWorld("api", {
    send: (channel: ValidChannels, data: any) => {
        if (!filters.includes(channel)) console.log("TO ELECTRON [" + channel + "]: ", data)
        if (!channels.includes(channel) || data.id || ready || debug) {
            ipcRenderer.send(channel, data)
            ready = false
            setTimeout(() => {
                ready = true
            }, maxInterval)
        }
    },
    receive: (channel: ValidChannels, func: any) => {
        ipcRenderer.on(channel, (_e, ...args) => {
            if (!filters.includes(args[0]?.channel)) console.log("TO CLIENT [" + channel + "]: ", ...args)
            func(...args)
        })
    },
})
