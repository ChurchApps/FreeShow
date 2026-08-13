import crypto from "crypto"
import net from "net"

// Precompute CRC32 table for Xiph.org Ogg polynomial (0x04c11db7)
// This makes CRC calculation 8x faster than the bit-by-bit loop.
const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
    let r = i << 24
    for (let j = 0; j < 8; j++) {
        r = (r & 0x80000000) !== 0 ? (r << 1) ^ 0x04c11db7 : r << 1
    }
    crcTable[i] = r >>> 0
}

function oggCrc32(buf: Buffer): number {
    let crc = 0
    for (let i = 0; i < buf.length; i++) {
        crc = ((crc << 8) ^ crcTable[((crc >>> 24) ^ buf[i]) & 0xff]) >>> 0
    }
    return crc
}

export class IcecastSender {
    private static socket: net.Socket | null = null
    private static serial = 0
    private static pageSequence = 0
    private static granulePosition = BigInt(0)
    private static activeConfig = { enabled: false, host: "", port: 8000, mount: "", password: "" }
    private static isConnected = false
    private static isConnecting = false
    private static paceTimer: NodeJS.Timeout | null = null

    // Separated real audio time tracking to fix the silence pacing bug
    private static lastRealAudioTime = 0
    private static currentSongTitle = ""

    // Standard Opus 20ms silent frame (48kHz stereo silence)
    private static silentOpusPacket = Buffer.from([0xf8, 0xff, 0xfe])

    private static realPacketsCount = 0
    private static silentPacketsCount = 0
    private static lastStatsLog = Date.now()

    public static sendAudio(opusPacket: Buffer, icecast?: any) {
        if (!icecast) return

        const host = icecast.host || "localhost"
        const port = Number(icecast.port) || 8000
        const mount = icecast.mount || "/stream.opus"
        const password = icecast.password || ""
        const enabled = !!icecast.enabled

        const isNewConfig = this.activeConfig.host !== "" && (this.activeConfig.enabled !== enabled || this.activeConfig.host !== host || Number(this.activeConfig.port) !== Number(port) || this.activeConfig.mount !== mount || this.activeConfig.password !== password)

        if (isNewConfig) {
            console.log(`[IcecastSender] Config updated: enabled=${enabled}, host=${host}:${port}, mount=${mount}`)
            this.disconnect()
        }

        this.activeConfig = { enabled, host, port, mount, password }

        if (enabled && !this.isConnected && !this.isConnecting) {
            this.connect()
        }

        if (!enabled || !this.socket || !this.isConnected) return

        if (opusPacket && opusPacket.length > 0) {
            this.lastRealAudioTime = Date.now()
            this.granulePosition += BigInt(960)
            this.realPacketsCount++
            this.writeOggPage(opusPacket, 0, this.granulePosition)
            this.checkDebugStats()
        }
    }

    private static checkDebugStats() {
        return // DEBUG
        const now = Date.now()
        const elapsed = (now - this.lastStatsLog) / 1000
        if (elapsed >= 5) {
            const realRate = (this.realPacketsCount / elapsed).toFixed(1)
            const silentRate = (this.silentPacketsCount / elapsed).toFixed(1)
            const durationSec = (Number(this.granulePosition) / 48000).toFixed(2)
            console.log(`[IcecastSender Stats] Real pkts: ${this.realPacketsCount} (${realRate}/s), Silent pkts: ${this.silentPacketsCount} (${silentRate}/s), Stream Duration: ${durationSec}s, Serial: 0x${this.serial.toString(16)}`)
            this.realPacketsCount = 0
            this.silentPacketsCount = 0
            this.lastStatsLog = now
        }
    }

    private static connect() {
        if (this.isConnecting || this.isConnected) return
        this.isConnecting = true

        const config = this.activeConfig
        this.serial = crypto.randomBytes(4).readUInt32LE(0)
        this.pageSequence = 0
        this.granulePosition = BigInt(0)
        this.realPacketsCount = 0
        this.silentPacketsCount = 0
        this.lastStatsLog = Date.now()

        const mountPath = config.mount.startsWith("/") ? config.mount : `/${config.mount}`
        console.log(`[IcecastSender] Opening TCP socket to http://${config.host}:${config.port}${mountPath}...`)

        const auth = Buffer.from(`source:${config.password}`).toString("base64")
        const client = new net.Socket()
        this.socket = client

        // Enable TCP Keep-Alive to prune dead sockets quickly
        client.setKeepAlive(true, 10000)

        client.connect(config.port, config.host, () => {
            this.isConnecting = false

            let headerText = `PUT ${mountPath} HTTP/1.1\r\n` + `Host: ${config.host}:${config.port}\r\n` + `Authorization: Basic ${auth}\r\n` + `Content-Type: audio/ogg; codecs=opus\r\n` + `Ice-Name: FreeShow Audio Stream\r\n` + `Ice-Description: Live Audio Stream from FreeShow\r\n` + `Ice-Genre: Live\r\n` + `Ice-Public: 0\r\n` + `Expect: 100-continue\r\n` + `User-Agent: FreeShow/1.0\r\n`

            if (this.currentSongTitle) {
                headerText += `Ice-Title: ${this.currentSongTitle}\r\n`
            }
            headerText += `\r\n`

            client.write(headerText, () => {
                console.log(`[IcecastSender] Icecast headers sent. Stream active.`)
                this.isConnected = true
                this.startStreamHeaders()
                this.startIdleKeepAlive()
            })
        })

        client.on("data", (data) => {
            const resp = data.toString("utf8")
            if (resp.includes("409 Conflict") || resp.includes("Mountpoint in use")) {
                console.warn(`[IcecastSender] Mountpoint in use, will retry connection in 3 seconds...`)
                this.disconnect()
                setTimeout(() => {
                    if (this.activeConfig.enabled && !this.isConnected && !this.isConnecting) {
                        this.connect()
                    }
                }, 3000)
                return
            }
            if (resp.includes("401 Unauthorized") || resp.includes("403 Forbidden") || resp.includes("404 Not Found")) {
                console.error(`[IcecastSender] Connection rejected by server. Check credentials/mount.`)
                this.disconnect()
            }
        })

        client.on("error", (err) => {
            console.error("[IcecastSender] Socket error:", err.message || err)
            this.disconnect()
        })

        client.on("close", () => {
            console.log("[IcecastSender] Socket closed by server.")
            this.disconnect()
        })
    }

    private static startIdleKeepAlive() {
        if (this.paceTimer) clearInterval(this.paceTimer)
        this.lastRealAudioTime = Date.now()

        // Keep-alive timer fires every 20ms.
        // If real audio starves for > 500ms, this maintains perfect 20ms Opus stream pacing.
        this.paceTimer = setInterval(() => {
            if (!this.isConnected || !this.socket || this.socket.destroyed) return

            if (Date.now() - this.lastRealAudioTime < 500) return

            this.granulePosition += BigInt(960)
            this.silentPacketsCount++
            this.writeOggPage(this.silentOpusPacket, 0, this.granulePosition)
            this.checkDebugStats()
        }, 20)
    }

    private static startStreamHeaders() {
        if (!this.socket || !this.isConnected) return
        console.log(`[IcecastSender] Sending initial Ogg Opus headers (BOS, serial: 0x${this.serial.toString(16)})...`)
        // OpusHead: ver 1, channels 2, preskip 312, 48000Hz, gain 0, map 0
        const head = Buffer.from("4f707573486561640102380180bb0000000000", "hex")

        const { artist, title } = parseArtistAndTitle(this.currentSongTitle)
        const tags = createOpusTagsPacket(artist, title)

        this.writeOggPage(head, 2, BigInt(0)) // BOS flag
        this.writeOggPage(tags, 0, BigInt(0))
    }

    private static writeOggPage(packet: Buffer, headerType: number, granulePos: bigint) {
        if (!this.socket || !packet) return

        const numSegments = Math.min(255, Math.ceil(packet.length / 255))
        const segmentLengths: number[] = []
        let remaining = packet.length

        for (let i = 0; i < numSegments; i++) {
            const len = Math.min(255, remaining)
            segmentLengths.push(len)
            remaining -= len
        }

        const headerSize = 27 + numSegments
        const totalSize = headerSize + packet.length

        // allocUnsafe skips zero-filling memory, significantly faster.
        // Safe here because we explicitly overwrite every byte below.
        const ogg = Buffer.allocUnsafe(totalSize)

        ogg.write("OggS", 0)
        ogg.writeUInt8(0, 4) // Stream structure version
        ogg.writeUInt8(headerType, 5) // Header type flags
        ogg.writeBigUInt64LE(granulePos, 6)
        ogg.writeUInt32LE(this.serial, 14)
        ogg.writeInt32LE(this.pageSequence++, 18)
        ogg.writeUInt32LE(0, 22) // Zero out CRC bytes before checksum calculation
        ogg.writeUInt8(numSegments, 26) // Number of segments

        for (let i = 0; i < numSegments; i++) {
            ogg.writeUInt8(segmentLengths[i], 27 + i)
        }

        if (packet.length > 0) {
            packet.copy(ogg, headerSize)
        }

        const crc = oggCrc32(ogg)
        ogg.writeUInt32LE(crc, 22)

        try {
            if (this.socket && !this.socket.destroyed) {
                this.socket.write(ogg, (err) => {
                    if (err) {
                        console.error("[IcecastSender] Write error:", err.message)
                        this.disconnect()
                    }
                })
            }
        } catch (err) {
            console.error("[IcecastSender] Exception while writing packet:", err)
            this.disconnect()
        }
    }

    public static updateMetadata(songTitle: string) {
        if (this.currentSongTitle === songTitle) return
        this.currentSongTitle = songTitle || ""

        if (this.socket && this.isConnected) {
            try {
                if (this.granulePosition > BigInt(48000 * 2)) {
                    console.log(`[IcecastSender] Track metadata updated to "${this.currentSongTitle}". Chaining new Ogg stream.`)
                    this.writeOggPage(Buffer.alloc(0), 4, this.granulePosition)

                    this.serial = crypto.randomBytes(4).readUInt32LE(0)
                    this.pageSequence = 0
                    this.granulePosition = BigInt(0)
                    this.startStreamHeaders()
                } else {
                    console.log(`[IcecastSender] Initial track metadata updated to "${this.currentSongTitle}" in-stream.`)
                    const { artist, title } = parseArtistAndTitle(this.currentSongTitle)
                    const tags = createOpusTagsPacket(artist, title)
                    this.writeOggPage(tags, 0, this.granulePosition)
                }
            } catch (err) {
                console.error("[IcecastSender] Error writing in-stream OpusTags metadata:", err)
            }
        }
    }

    public static disconnect() {
        if (this.paceTimer) {
            clearInterval(this.paceTimer)
            this.paceTimer = null
        }
        if (this.socket && this.isConnected) {
            try {
                this.writeOggPage(Buffer.alloc(0), 4, this.granulePosition)
            } catch {}
        }
        this.isConnected = false
        this.isConnecting = false
        if (this.socket) {
            console.log("[IcecastSender] Disconnecting socket from Icecast...")
            try {
                this.socket.destroy()
            } catch {}
            this.socket = null
        }
    }
}

function parseArtistAndTitle(songTitle: string): { artist: string; title: string } {
    let artist = ""
    let title = songTitle || ""
    if (title.includes(" - ")) {
        const parts = title.split(" - ")
        artist = parts[0].trim()
        title = parts.slice(1).join(" - ").trim()
    }
    return { artist, title }
}

function createOpusTagsPacket(artist: string, title: string): Buffer {
    const vendor = Buffer.from("FreeShow")
    const comments: Buffer[] = []

    if (title) comments.push(Buffer.from(`TITLE=${title}`))
    if (artist) comments.push(Buffer.from(`ARTIST=${artist}`))

    let size = 8 + 4 + vendor.length + 4
    for (const c of comments) {
        size += 4 + c.length
    }

    const buf = Buffer.allocUnsafe(size)
    let offset = 0

    buf.write("OpusTags", offset)
    offset += 8

    buf.writeUInt32LE(vendor.length, offset)
    offset += 4
    vendor.copy(buf, offset)
    offset += vendor.length

    buf.writeUInt32LE(comments.length, offset)
    offset += 4

    for (const c of comments) {
        buf.writeUInt32LE(c.length, offset)
        offset += 4
        c.copy(buf, offset)
        offset += c.length
    }

    return buf
}
