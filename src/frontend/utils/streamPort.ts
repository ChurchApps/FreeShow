// NDI/OMT frames reach this window on a MessagePort from the receiving process, not over IPC, to avoid extra copies.

export type StreamFrameData = { id: string; frame: any; time: number }
type StreamHandler = (data: StreamFrameData) => void

const handlers: { [channel: string]: Set<StreamHandler> } = {}

if (typeof window !== "undefined") {
    window.addEventListener("message", (e: MessageEvent) => {
        if (e.data?.type !== "STREAM_PORT" || !e.ports?.length) return

        const port = e.ports[0]
        port.onmessage = (message: MessageEvent) => {
            const { ipcChannel, args } = message.data || {}
            if (args?.channel === "RECEIVE_STREAM") handlers[ipcChannel]?.forEach((handler) => handler(args.data))

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
