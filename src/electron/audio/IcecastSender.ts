import crypto from "crypto"
import http from "http"

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
    private static req: http.ClientRequest | null = null
    private static serial = 0
    private static pageSequence = 0
    private static granulePosition = BigInt(0)
    private static activeConfig = { enabled: false, host: "", port: 8000, mount: "", password: "" }

    public static sendAudio(opusPacket: Buffer, icecast?: any) {
        if (!icecast) return

        const host = icecast.host || "localhost"
        const port = parseInt(icecast.port) || 8000
        const mount = icecast.mount || "/stream.opus"
        const password = icecast.password || ""
        const enabled = !!icecast.enabled

        const isNewConfig = this.activeConfig.enabled !== enabled || this.activeConfig.host !== host || this.activeConfig.port !== port || this.activeConfig.mount !== mount || this.activeConfig.password !== password

        if (isNewConfig) {
            this.disconnect()
            this.activeConfig = { enabled, host, port, mount, password }
            if (enabled && password) this.connect()
        }

        if (!enabled || !this.req) return

        this.granulePosition += BigInt(960)
        this.writeOggPage(opusPacket, 0, this.granulePosition)
    }

    private static connect() {
        const config = this.activeConfig
        this.serial = crypto.randomBytes(4).readUInt32LE(0)
        this.pageSequence = 0
        this.granulePosition = BigInt(0)

        const auth = Buffer.from(`source:${config.password}`).toString("base64")
        this.req = http.request({
            host: config.host,
            port: config.port,
            path: config.mount.startsWith("/") ? config.mount : `/${config.mount}`,
            method: "PUT",
            headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "audio/ogg; codecs=opus",
                "Ice-Name": "FreeShow Audio Stream",
                "Ice-Public": "0",
                "Transfer-Encoding": "chunked"
            }
        })
        this.req.on("error", (err) => {
            console.error("Icecast source error:", err)
            this.disconnect()
        })

        // BOS Header pages
        // OpusHead: ver 1, channels 2, preskip 312, 48000Hz, gain 0, map 0
        const head = Buffer.from("4f707573486561640102380180bb0000000000", "hex")
        // OpusTags: vendor len 8, "FreeShow"
        const tags = Buffer.from("4f70757354616773080000004672656553686f7700000000", "hex")
        this.writeOggPage(head, 2, BigInt(0)) // BOS flag
        this.writeOggPage(tags, 0, BigInt(0))
    }

    private static writeOggPage(packet: Buffer, headerType: number, granulePos: bigint) {
        if (!this.req || packet.length > 255) return

        const ogg = Buffer.alloc(28 + packet.length)
        ogg.write("OggS", 0)
        ogg.writeUInt8(headerType, 5)
        ogg.writeBigUInt64LE(granulePos, 6)
        ogg.writeUInt32LE(this.serial, 14)
        ogg.writeInt32LE(this.pageSequence++, 18)
        ogg.writeUInt8(1, 26) // 1 segment
        ogg.writeUInt8(packet.length, 27)
        packet.copy(ogg, 28)

        ogg.writeUInt32LE(oggCrc32(ogg), 22)

        try {
            this.req.write(ogg)
        } catch {
            this.disconnect()
        }
    }

    public static disconnect() {
        if (this.req) {
            try {
                this.req.end()
            } catch {}
            this.req = null
        }
    }
}
