// https://stackoverflow.com/a/59888788

const { contextBridge, ipcRenderer } = require("electron");

let validChannels = ['main', 'openFile', 'getScreens', 'lan', 'stage'];

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  "api", {
    send: (channel, data) => {
      // whitelist channels
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      // Deliberately strip event as it includes `sender`
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    }
  }
);