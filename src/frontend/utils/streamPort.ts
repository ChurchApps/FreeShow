// NDI/OMT frames reach this window on a MessagePort from the process that receives them, not over IPC.
//
// The preload hands the port to the page rather than dispatching frames itself. Crossing the
// contextBridge copies every frame a second time, and at 4K that copy pushed a frame's age past the
// 100ms freshness limit the stream components apply — so the output discarded every frame it was sent
// and showed nothing. Reading the port here keeps one copy out of the path entirely.

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

            // Ack even when nothing is listening yet: the sender only keeps a couple of frames in
            // flight, so a missing ack would stall this window's video rather than skip a frame.
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
