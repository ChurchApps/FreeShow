interface StreamTarget {
    workletPort?: MessagePort
    mainPort?: MessagePort
    sampleRate: number
    icecastConfig?: any
}

const targets = new Map<string, StreamTarget>()

self.onmessage = (event) => {
    const { type, targetId, sampleRate, icecastConfig } = event.data || {}
    if (!targetId) return

    if (type === "CONNECT_WORKLET_PORT") {
        const [port] = event.ports
        if (port) {
            const target: StreamTarget = targets.get(targetId) || { sampleRate: sampleRate || 48000 }
            target.sampleRate = sampleRate || target.sampleRate
            target.icecastConfig = icecastConfig
            target.workletPort = port

            port.onmessage = (e) => {
                const { buffer } = e.data || {}
                if (!buffer) return

                const t = targets.get(targetId)
                if (t?.mainPort) {
                    t.mainPort.postMessage({
                        channel: "AUDIO",
                        payload: {
                            id: targetId,
                            buffer: new Uint8Array(buffer),
                            sampleRate: t.sampleRate,
                            icecast: t.icecastConfig
                        }
                    })
                }
            }

            if (port.start) port.start()
            targets.set(targetId, target)
        }
    } else if (type === "CONNECT_MAIN_PORT") {
        const [port] = event.ports
        if (port) {
            const target = targets.get(targetId) || { sampleRate: 48000 }
            target.mainPort = port
            if (port.start) port.start()
            targets.set(targetId, target)
        }
    } else if (type === "DISCONNECT") {
        const target = targets.get(targetId)
        if (target) {
            target.workletPort?.close()
            target.mainPort?.close()
            targets.delete(targetId)
        }
    }
}
