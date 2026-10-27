// NDI/OMT frames reach this window on a MessagePort from the receiving process, not over IPC, to avoid extra copies.

export type StreamFrameData = { id: string; frame: any; time: number }
type StreamHandler = (data: StreamFrameData) => void

const handlers: { [channel: string]: Set<StreamHandler> } = {}

// output windows: the preload posts frames as transferred ArrayBuffers; app window: a socket opened here,
// each frame a text header then one binary message
let socket: WebSocket | null = null
let pendingHeader: { ipcChannel: string; id: string; time: number; xres: number; yres: number; format: string } | null = null

function dispatch(ipcChannel: string, data: StreamFrameData) {
    handlers[ipcChannel]?.forEach((handler) => handler(data))
}

function connectStream(targetId: string, port: number, token: string) {
    if (socket) {
        try {
            socket.close()
        } catch {}
        socket = null
    }
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    ws.binaryType = "arraybuffer"
    socket = ws
    ws.onopen = () => ws.send(JSON.stringify({ token, targetId }))
    ws.onmessage = (message: MessageEvent) => {
        if (typeof message.data === "string") {
            try {
                pendingHeader = JSON.parse(message.data)
            } catch {
                pendingHeader = null
            }
            return
        }
        const header = pendingHeader
        pendingHeader = null
        if (!header || !(message.data instanceof ArrayBuffer)) return
        const frame = { xres: header.xres, yres: header.yres, format: header.format, data: new Uint8Array(message.data) }
        dispatch(header.ipcChannel, { id: header.id, frame, time: header.time })
        // ack after dispatch: the sender sizes its in-flight frames from the round trip
        if (ws.readyState === WebSocket.OPEN) ws.send("1")
    }
    ws.onclose = () => {
        if (socket === ws) socket = null
    }
    ws.onerror = () => {}
}

if (typeof window !== "undefined") {
    window.addEventListener("message", (e: MessageEvent) => {
        const message = e.data
        if (message?.type === "STREAM_FRAME" && message.data instanceof ArrayBuffer) {
            const buffer: ArrayBuffer = message.data
            dispatch(message.ipcChannel, { id: message.id, frame: { xres: message.xres, yres: message.yres, format: message.format, data: new Uint8Array(buffer) }, time: message.time })
            // after Svelte's flush (queued during dispatch), so the upload has read the buffer
            queueMicrotask(() => window.postMessage({ type: "STREAM_ACK", target: message.target, slot: message.slot, data: buffer }, "*", [buffer]))
            return
        }
        if (message?.type === "STREAM_WS" && message.port && message.token) {
            connectStream(String(message.targetId || ""), Number(message.port), String(message.token))
            return
        }
        if (message?.type !== "STREAM_PORT" || !e.ports?.length) return

        const port = e.ports[0]
        port.onmessage = (portMessage: MessageEvent) => {
            const { ipcChannel, args } = portMessage.data || {}
            if (args?.channel === "RECEIVE_STREAM") dispatch(ipcChannel, args.data)

            // Ack even when nothing is listening yet to prevent stalling
            port.postMessage(1)
        }
        port.start()
    })
}

export function onStreamFrame(channel: string, handler: StreamHandler) {
    if (!handlers[channel]) handlers[channel] = new Set()
    handlers[channel].add(handler)

    return () => {
        handlers[channel]?.delete(handler)
    }
}
