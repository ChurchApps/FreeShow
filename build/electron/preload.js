"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// https://stackoverflow.com/a/59888788
const electron_1 = require("electron");
// const ValidChannels = ["MAIN", "OPEN_FILE", "GET_SCREENS", "LAN", "STAGE"]
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld("api", {
    send: (channel, data) => {
        // whitelist channels
        // console.log("received" + channel, ValidChannels.includes(channel))
        // if (ValidChannels.includes(channel)) {
        console.log("received" + channel);
        electron_1.ipcRenderer.send(channel, data);
        // }
    },
    receive: (channel, func) => {
        // Deliberately strip event as it includes `sender`
        // console.log(ValidChannels.includes(channel))
        // if (ValidChannels.includes(channel)) {
        electron_1.ipcRenderer.on(channel, (_e, ...args) => {
            console.log("EFE", ...args);
            func(...args);
        });
        // }
    },
});
//# sourceMappingURL=preload.js.map