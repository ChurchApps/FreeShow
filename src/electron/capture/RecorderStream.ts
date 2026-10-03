import { getMainWindow } from ".."
import { NdiSender } from "../ndi/NdiSender"
import { SenderCapture } from "./SenderCapture"

// The main window's output recorder gets its frames like the previews do: the capture worker serves them
// over the shared-memory transport (capture/FrameServer.ts, streamLink.ts) and main relays only the socket.
export class RecorderStream {
    private static wsInfo: { port: number; token: string } | null = null
    private static wanted = new Set<string>()
    private static hooked = false

    static ensure() {
        if (this.hooked) return
        this.hooked = true
        SenderCapture.recorderMessageHandler = (msg) => {
            if (msg.type === "recorderWs") {
                this.wsInfo = { port: msg.port, token: msg.token }
                for (const id of [...this.wanted]) this.wire(id)
            } else if (msg.type === "recorderNeedTarget") {
                this.wire(msg.targetId)
            }
        }
    }

    private static watched: Electron.BrowserWindow | null = null

    private static wire(targetId: string) {
        const window = getMainWindow()
        if (!this.wsInfo || !window || window.isDestroyed()) {
            this.wanted.add(targetId)
            return
        }
        this.wanted.delete(targetId)
        if (this.watched !== window) {
            this.watched = window
            // a reloaded window takes its sockets with it; the worker asks again on the next frame
            window.webContents.on("did-start-navigation", (details) => {
                if (details.isMainFrame && !details.isSameDocument) NdiSender.postToWorker({ type: "recorderReset" })
            })
        }
        window.webContents.send("STREAM_WS", { targetId, port: this.wsInfo.port, token: this.wsInfo.token })
    }
}
