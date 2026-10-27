import type { BrowserWindow } from "electron"
import { SenderCapture } from "../../capture/SenderCapture"
import { OUTPUT } from "../../../types/Channels"
import { NdiSender } from "../../ndi/NdiSender"
import { OutputHelper } from "../OutputHelper"

// Draws frames rendered elsewhere into an output's window, delivered by the capture worker over shared memory.
export class OutputPresenter {
    private static wsInfo: { port: number; token: string } | null = null
    private static presenting = new Set<string>()
    private static wanted = new Set<string>()
    private static hooked = false

    static isPresenting(id: string) {
        return this.presenting.has(id)
    }

    private static hook() {
        if (this.hooked) return
        this.hooked = true
        SenderCapture.presentMessageHandler = (msg) => {
            if (msg.type === "presentWs") {
                this.wsInfo = { port: msg.port, token: msg.token }
                for (const id of [...this.wanted]) this.wire(id)
            } else if (msg.type === "presentNeedTarget") {
                this.wire(msg.targetId)
            }
        }
    }

    // the window stops rendering content and draws the capture instead
    static start(id: string, window: BrowserWindow) {
        this.hook()
        if (this.presenting.has(id)) return
        this.presenting.add(id)
        if (!window.isDestroyed()) window.webContents.send(OUTPUT, { channel: "PRESENT", data: { id, active: true } })
        this.wire(id)
    }

    static stop(id: string) {
        if (!this.presenting.delete(id)) return
        this.wanted.delete(id)
        const window = OutputHelper.getOutput(id)?.window
        if (window && !window.isDestroyed()) window.webContents.send(OUTPUT, { channel: "PRESENT", data: { id, active: false } })
        NdiSender.postToWorker({ type: "presentReset" })
    }

    // the worker asks once per target, so remember outputs wired before the socket or window exists
    private static wire(id: string) {
        if (!this.presenting.has(id) || !this.wsInfo) {
            this.wanted.add(id)
            return
        }
        const window = OutputHelper.getOutput(id)?.window
        if (!window || window.isDestroyed()) {
            this.wanted.add(id)
            return
        }
        this.wanted.delete(id)
        window.webContents.send("STREAM_WS", { targetId: id, port: this.wsInfo.port, token: this.wsInfo.token })
    }
}
