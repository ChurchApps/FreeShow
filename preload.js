// https://stackoverflow.com/a/59888788
const { contextBridge, ipcRenderer } = require("electron")
const ValidChannels = ["MAIN", "OPEN_FILE", "GET_SCREENS", "LAN", "STAGE"]

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
  send: (channel, data) => {
    // whitelist channels
    console.log("received" + channel, ValidChannels.includes(channel))
    if (ValidChannels.includes(channel)) {
      console.log("received" + channel)
      ipcRenderer.send(channel, data)
    }
  },
  receive: (channel, func) => {
    // Deliberately strip event as it includes `sender`
    console.log(ValidChannels.includes(channel))
    if (ValidChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => {
        console.log("EFE", ...args)
        func(...args)
      })
    }
  },
})
