// Preload of the hidden WebRTC host window (streaming/WebRtcHost.ts): the frame transport from the
// capture worker (see streamLink.ts) plus the few IPC calls the host page makes (WHIP signaling
// through main, logs, start/stop).

import { contextBridge, ipcRenderer } from "electron"
import { installStreamLinks } from "./streamLink"

installStreamLinks(ipcRenderer)

contextBridge.exposeInMainWorld("webrtcHost", {
    send: (channel: string, data: any) => ipcRenderer.send(channel, data),
    on: (channel: string, handler: (data: any) => void) => {
        ipcRenderer.on(channel, (_event, data) => handler(data))
    }
})
