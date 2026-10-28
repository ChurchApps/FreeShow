// Preload client of capture/FrameServer.ts: reads ring slots into transferred buffers; STREAM_ACK returns the buffer and frees the slot.

import type { IpcRenderer } from "electron"

type StreamLink = { ws: WebSocket; ring: { name: string; slotBytes: number } | null; spare: ArrayBuffer[] }

export function installStreamLinks(ipcRenderer: IpcRenderer) {
    let shmModule: any = null
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        shmModule = require("osr-capture")
        if (typeof shmModule?.shmReadAsync !== "function") shmModule = null
    } catch (err) {
        console.error("[stream] shared memory unavailable in this window:", err)
        shmModule = null
    }

    const diag = { reads: 0, readMs: 0, ageMs: 0 }
    if (process.env.FS_CAP_STATS) {
        setInterval(() => {
            if (!diag.reads) return
            console.info(`[RX-WINDOW] frames=${diag.reads} copy=${(diag.readMs / diag.reads).toFixed(1)}ms/frame age=${(diag.ageMs / diag.reads).toFixed(0)}ms`)
            diag.reads = diag.readMs = diag.ageMs = 0
        }, 1000)
    }

    const links = new Map<string, StreamLink>()

    function dropRing(link: StreamLink) {
        if (!link.ring) return
        try {
            shmModule?.shmUnmap(link.ring.name)
        } catch {}
        link.ring = null
    }

    function connect(targetId: string, port: number, token: string) {
        const previous = links.get(targetId)
        if (previous) {
            links.delete(targetId)
            try {
                previous.ws.close()
            } catch {}
            dropRing(previous)
        }
        const ws = new WebSocket(`ws://127.0.0.1:${port}`)
        ws.binaryType = "arraybuffer"
        const link: StreamLink = { ws, ring: null, spare: [] }
        links.set(targetId, link)
        ws.onopen = () => ws.send(JSON.stringify({ token, targetId, shm: true }))
        ws.onmessage = (message: MessageEvent) => {
            if (typeof message.data !== "string") return
            let header: any = null
            try {
                header = JSON.parse(message.data)
            } catch {
                return
            }
            if (!header || header.slot === undefined) return
            if (header.shm && header.shm.name !== link.ring?.name) {
                dropRing(link)
                try {
                    shmModule.shmMap(header.shm.name, header.shm.slotBytes * header.shm.slots, false)
                    link.ring = { name: header.shm.name, slotBytes: header.shm.slotBytes }
                } catch (err) {
                    console.error("[stream] cannot map frame ring:", err)
                }
            }
            const ring = link.ring
            if (!ring) {
                if (ws.readyState === WebSocket.OPEN) ws.send("1:" + header.slot)
                return
            }
            // reuse a buffer the page returned
            const reuse = link.spare.findIndex((b) => b.byteLength === header.bytes)
            const data = reuse >= 0 ? link.spare.splice(reuse, 1)[0] : new ArrayBuffer(header.bytes)
            const tRead = performance.now()
            shmModule.shmReadAsync(ring.name, header.slot * ring.slotBytes, new Uint8Array(data)).then(
                () => {
                    diag.reads++
                    diag.readMs += performance.now() - tRead
                    diag.ageMs += Date.now() - header.time
                    window.postMessage({ type: "STREAM_FRAME", target: targetId, ipcChannel: header.ipcChannel, id: header.id, time: header.time, xres: header.xres, yres: header.yres, format: header.format, slot: header.slot, data }, "*", [data])
                },
                (err: any) => {
                    console.error("[stream] cannot read frame:", err)
                    if (ws.readyState === WebSocket.OPEN) ws.send("1:" + header.slot)
                }
            )
        }
        ws.onclose = () => {
            if (links.get(targetId) === link) links.delete(targetId)
            dropRing(link)
        }
        ws.onerror = () => {}
    }

    window.addEventListener("message", (e: MessageEvent) => {
        if (e.data?.type !== "STREAM_ACK") return
        const link = links.get(String(e.data.target || ""))
        if (!link) return
        if (e.data.data instanceof ArrayBuffer && e.data.data.byteLength && link.spare.length < 4) link.spare.push(e.data.data)
        if (link.ws.readyState === WebSocket.OPEN) link.ws.send("1:" + e.data.slot)
    })

    ipcRenderer.on("STREAM_WS", (_event, data) => {
        if (shmModule) connect(String(data?.targetId || ""), Number(data?.port), String(data?.token))
        else window.postMessage({ type: "STREAM_WS", targetId: data?.targetId, port: data?.port, token: data?.token }, "*")
    })
}
