// Main-process side of the NDI/OMT receive path.
//
// The receiving itself runs in a utilityProcess (./streamReceiverProcess) and delivers frames to the
// renderers over MessagePorts, so no frame is ever cloned, converted or written by the main process.
// All this does is start that process, forward control messages, and hand it a port whenever it has
// a frame for a window it isn't wired to yet.

import { MessageChannelMain, utilityProcess, type BrowserWindow } from "electron"
import { join } from "path"
import { getMainWindow } from ".."
import { OutputHelper } from "../output/OutputHelper"

const APP_TARGET = "app"
const DIAG = !!process.env.FS_CAP_STATS

export class StreamReceiverHost {
    private static child: any = null
    private static pending: { [requestId: string]: (value: any) => void } = {}
    private static requestCount = 0
    private static wiredWindows = new Map<string, BrowserWindow>()

    private static start() {
        if (this.child) return this.child

        const modulePath = join(__dirname, "streamReceiverProcess.js")
        if (DIAG) console.info("[stream-port] forking receive process:", modulePath)
        this.child = utilityProcess.fork(modulePath, [], { serviceName: "FreeShow stream receiver" })
        if (DIAG) this.child.on("spawn", () => console.info("[stream-port] receive process spawned"))

        this.child.on("message", (message: any) => this.onMessage(message))
        this.child.on("exit", (code: number) => {
            if (DIAG) console.info("[stream-port] receive process exited:", code)
            this.child = null
            this.wiredWindows.clear()
            Object.values(this.pending).forEach((resolve) => resolve(null))
            this.pending = {}
        })

        return this.child
    }

    private static onMessage(message: any) {
        if (!message) return

        if (message.type === "log") {
            console.log("[stream receiver]", message.text)
            return
        }

        if (message.type === "needPort") {
            this.wirePort(message.targetId)
            return
        }

        if (message.type === "result") {
            const resolve = this.pending[message.requestId]
            if (!resolve) return
            delete this.pending[message.requestId]
            if (message.error) console.log("[stream receiver]", message.error)
            resolve(message.value)
        }
    }

    private static getWindow(targetId: string): BrowserWindow | null {
        if (targetId === APP_TARGET) return getMainWindow()

        const output = OutputHelper.getOutput(targetId)
        // a shared-render follower's window belongs to the renderer, which already has its own port
        if (!output?.window || output.window.isDestroyed() || (output as any).follower) return null
        return output.window
    }

    // One channel per window: the child keeps its end, the window gets the other, and from then on
    // frames travel between those two processes without the main process in the middle.
    private static wirePort(targetId: string) {
        const window = this.getWindow(targetId)
        if (DIAG) console.info("[stream-port] wire", targetId, "window:", !!window)

        // The child only asks once per window, so a request that goes unanswered would stop that
        // window's video for good — the window may simply not exist yet when the first frame lands.
        // Clearing the request lets the next frame ask again.
        if (!window || window.isDestroyed() || !this.child) {
            this.child?.postMessage({ type: "dropPort", targetId })
            return
        }

        const { port1, port2 } = new MessageChannelMain()
        this.child.postMessage({ type: "port", targetId }, [port1])
        window.webContents.postMessage("STREAM_PORT", { targetId }, [port2])

        this.wiredWindows.set(targetId, window)

        // a reloaded or closed window takes its end of the port with it, and the sender gets no error
        // for posting into a dead port — it would just stop showing video. Tell the child so it asks
        // for a new one with the next frame.
        const drop = () => {
            if (this.wiredWindows.get(targetId) !== window) return
            this.wiredWindows.delete(targetId)
            this.child?.postMessage({ type: "dropPort", targetId })
        }
        window.webContents.once("destroyed", drop)
        // a crashed renderer stops acking without navigating, and posting into its dead port raises
        // nothing — without this the child would wait on an ack that can never come
        window.webContents.once("render-process-gone", drop)
        // only a real main-frame document load replaces the page: in-page navigation keeps the port
        window.webContents.on("did-start-navigation", (details) => {
            if (details.isMainFrame && !details.isSameDocument) drop()
        })
    }

    static send(type: string, data?: any) {
        if (DIAG) console.info("[stream-port] ->child", type)
        this.start().postMessage({ type, data })
    }

    static request(type: string, data?: any): Promise<any> {
        const child = this.start()
        const requestId = "r" + ++this.requestCount

        return new Promise((resolve) => {
            this.pending[requestId] = resolve
            child.postMessage({ type, data, requestId })
        })
    }

    static stop() {
        if (!this.child) return
        this.child.kill()
        this.child = null
    }
}
