import crypto from "crypto"
import net from "net"

// Standard Xiph.org Ogg CRC32 checksum generator (MSB-first, Polynomial 0x04c11db7, Initial 0, Final XOR 0)
function oggCrc32(buf: Buffer): number {
    let crc = 0
    for (let i = 0; i < buf.length; i++) {
        crc = (crc ^ (buf[i] << 24)) >>> 0
        for (let j = 0; j < 8; j++) {
            crc = crc & 0x80000000 ? (crc << 1) ^ 0x04c11db7 : crc << 1
        }
    }
    return crc >>> 0
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
    private static packetQueue: Buffer[] = []
    private static currentSongTitle = ""

    // Standard Opus 20ms silent frame (48kHz stereo silence)
    private static silentOpusPacket = Buffer.from([0xf8, 0xff, 0xfe])

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
            this.packetQueue.push(opusPacket)
            if (this.packetQueue.length > 50) this.packetQueue.shift()
        }
    }

    private static connect() {
        if (this.isConnecting || this.isConnected) return
        this.isConnecting = true

        const config = this.activeConfig
        this.serial = crypto.randomBytes(4).readUInt32LE(0)
        this.pageSequence = 0
        this.granulePosition = BigInt(0)

        const mountPath = config.mount.startsWith("/") ? config.mount : `/${config.mount}`
        console.log(`[IcecastSender] Opening TCP socket to http://${config.host}:${config.port}${mountPath}...`)

        const auth = Buffer.from(`source:${config.password}`).toString("base64")
        const client = new net.Socket()
        this.socket = client

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

        // Icecast requires steady Ogg pages every 20ms (50 packets per sec)
        this.paceTimer = setInterval(() => {
            if (!this.isConnected || !this.socket || this.socket.destroyed) return

            const packet = this.packetQueue.length > 0 ? this.packetQueue.shift()! : this.silentOpusPacket
            this.granulePosition += BigInt(960)
            this.writeOggPage(packet, 0, this.granulePosition)
        }, 20)
    }

    private static startStreamHeaders() {
        if (!this.socket || !this.isConnected) return
        console.log(`[IcecastSender] Sending initial Ogg Opus headers (BOS)...`)
        // OpusHead: ver 1, channels 2, preskip 312, 48000Hz, gain 0, map 0
        const head = Buffer.from("4f707573486561640102380180bb0000000000", "hex")

        const { artist, title } = parseArtistAndTitle(this.currentSongTitle)
        const tags = createOpusTagsPacket(artist, title)

        this.writeOggPage(head, 2, BigInt(0)) // BOS flag
        this.writeOggPage(tags, 0, BigInt(0))
    }

    private static writeOggPage(packet: Buffer, headerType: number, granulePos: bigint) {
        if (!this.socket || !packet || packet.length === 0) return

        // Calculate segment sizes (max 255 bytes per segment, max 255 segments per page)
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
        const ogg = Buffer.alloc(totalSize)

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

        packet.copy(ogg, headerSize)

        // Calculate CRC32 over the complete page with zeroed CRC field
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
                // Icecast 2.5 updates stream metadata dynamically when an Ogg Chained Stream (new serial + BOS header) arrives
                this.serial = crypto.randomBytes(4).readUInt32LE(0)
                this.pageSequence = 0
                this.granulePosition = BigInt(0)
                this.startStreamHeaders()
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

/**
 * Parses "Artist - Title" string into separate artist and title fields.
 */
function parseArtistAndTitle(songTitle: string): { artist: string; title: string } {
    let artist = ""
    let title = songTitle || ""
    if (songTitle.includes(" - ")) {
        const parts = songTitle.split(" - ")
        artist = parts[0].trim()
        title = parts.slice(1).join(" - ").trim()
    }
    return { artist, title }
}

/**
 * Constructs an Ogg OpusTags packet:
 * - "OpusTags" (8 bytes)
 * - Vendor string length (4 bytes) + Vendor string ("FreeShow")
 * - User comment count (4 bytes)
 * - Comment 1: "TITLE=..."
 * - Comment 2: "ARTIST=..."
 */
function createOpusTagsPacket(artist: string, title: string): Buffer {
    const vendor = Buffer.from("FreeShow")
    const comments: Buffer[] = []

    if (title) comments.push(Buffer.from(`TITLE=${title}`))
    if (artist) comments.push(Buffer.from(`ARTIST=${artist}`))

    let size = 8 + 4 + vendor.length + 4
    for (const c of comments) {
        size += 4 + c.length
    }

    const buf = Buffer.alloc(size)
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
