import type { ValidChannels } from "../types/Channels"
// https://stackoverflow.com/a/59888788
import { contextBridge, ipcRenderer } from "electron"
// const ValidChannels = ["MAIN", "OPEN_FILE", "GET_SCREENS", "LAN", "STAGE"]

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
  send: (channel: ValidChannels, data: any) => {
    // whitelist channels
    // console.log("received" + channel, ValidChannels.includes(channel))
    // if (ValidChannels.includes(channel)) {
    console.log("TO ELECTRON [" + channel + "]: ", data)
    ipcRenderer.send(channel, data)
    // }
  },
  receive: (channel: ValidChannels, func: any) => {
    // Deliberately strip event as it includes `sender`
    // console.log(ValidChannels.includes(channel))
    // if (ValidChannels.includes(channel)) {
    ipcRenderer.on(channel, (_e, ...args) => {
      console.log("TO CLIENT [" + channel + "]: ", ...args)
      func(...args)
    })
    // }
  },
})
