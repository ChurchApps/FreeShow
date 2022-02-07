import type { ValidChannels } from "../types/Channels"
import { contextBridge, ipcRenderer } from "electron"

// Expose protected methods that allow the renderer process to use the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
  send: (channel: ValidChannels, data: any) => {
    console.log("TO ELECTRON [" + channel + "]: ", data)
    ipcRenderer.send(channel, data)
  },
  receive: (channel: ValidChannels, func: any) => {
    ipcRenderer.on(channel, (_e, ...args) => {
      console.log("TO CLIENT [" + channel + "]: ", ...args)
      func(...args)
    })
  },
})
