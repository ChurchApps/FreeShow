// OMT probe for the output test: receives FreeShow's outputs and sends a test source.
// Runs under Electron as Node (ELECTRON_RUN_AS_NODE), so it loads the app's own native addon build.
// Commands arrive as JSON lines on stdin; each reply is one JSON line on stdout with the same id.

const fs = require("fs")
const path = require("path")
const readline = require("readline")
const zlib = require("zlib")

if (process.platform === "win32") {
    const addonDir = path.join(path.dirname(require.resolve("openmediatransport/package.json")), "build", "Release")
    process.env.PATH = `${addonDir}${path.delimiter}${process.env.PATH || ""}`
}
const omt = require("openmediatransport")

const receivers = new Map()
const senders = new Map()

// BT.709 limited range
function yuvToRgb(y, u, v) {
    const c = 1.164 * (y - 16)
    const d = u - 128
    const e = v - 128
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)))
    return [clamp(c + 1.793 * e), clamp(c - 0.213 * d - 0.533 * e), clamp(c + 2.112 * d)]
}

function pixel(frame, x, y) {
    const row = frame.data.subarray(y * frame.stride)
    if (frame.codec === omt.Codec.BGRA) {
        const i = x * 4
        return [row[i + 2], row[i + 1], row[i]]
    }
    // UYVY: one U and V per two pixels
    const i = (x >> 1) * 4
    return yuvToRgb(row[i + 1 + (x & 1) * 2], row[i], row[i + 2])
}

// every 4th row and every 4th pixel, dense enough to see a text change
function hash(frame) {
    let h = 0x811c9dc5
    const bytesPerPixel = frame.codec === omt.Codec.BGRA ? 4 : 2
    for (let y = 0; y < frame.height; y += 4) {
        const row = y * frame.stride
        for (let x = 0; x < frame.width * bytesPerPixel; x += bytesPerPixel * 4) h = Math.imul(h ^ frame.data[row + x + 1], 0x01000193)
    }
    return h >>> 0
}

// mean color per cell of a grid, plus the share of near-white pixels (text)
function analyze(frame, grid = 4) {
    const cells = []
    let bright = 0
    let total = 0
    const perCell = 24
    for (let gy = 0; gy < grid; gy++) {
        for (let gx = 0; gx < grid; gx++) {
            const sum = [0, 0, 0]
            for (let sy = 0; sy < perCell; sy++) {
                for (let sx = 0; sx < perCell; sx++) {
                    const x = Math.floor(((gx + (sx + 0.5) / perCell) / grid) * frame.width)
                    const y = Math.floor(((gy + (sy + 0.5) / perCell) / grid) * frame.height)
                    const rgb = pixel(frame, x, y)
                    sum[0] += rgb[0]
                    sum[1] += rgb[1]
                    sum[2] += rgb[2]
                    if (rgb[0] > 200 && rgb[1] > 200 && rgb[2] > 200) bright++
                    total++
                }
            }
            cells.push(sum.map((n) => Math.round(n / (perCell * perCell))))
        }
    }
    const mean = [0, 1, 2].map((c) => Math.round(cells.reduce((a, cell) => a + cell[c], 0) / cells.length))
    return { width: frame.width, height: frame.height, mean, cells, bright: bright / total, hash: frame.hash }
}

function crc32(buf) {
    let c = ~0
    for (let i = 0; i < buf.length; i++) {
        c ^= buf[i]
        for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1
    }
    return ~c >>> 0
}

function writePng(frame, file) {
    const raw = Buffer.alloc((frame.width * 3 + 1) * frame.height)
    for (let y = 0; y < frame.height; y++) {
        const o = y * (frame.width * 3 + 1)
        for (let x = 0; x < frame.width; x++) {
            const rgb = pixel(frame, x, y)
            raw[o + 1 + x * 3] = rgb[0]
            raw[o + 2 + x * 3] = rgb[1]
            raw[o + 3 + x * 3] = rgb[2]
        }
    }
    const chunk = (type, data) => {
        const len = Buffer.alloc(4)
        len.writeUInt32BE(data.length)
        const body = Buffer.concat([Buffer.from(type), data])
        const crc = Buffer.alloc(4)
        crc.writeUInt32BE(crc32(body))
        return Buffer.concat([len, body, crc])
    }
    const header = Buffer.alloc(13)
    header.writeUInt32BE(frame.width, 0)
    header.writeUInt32BE(frame.height, 4)
    header[8] = 8
    header[9] = 2
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]))
}

// receives into two buffers in turn, so the latest frame stays readable
async function receiveLoop(state) {
    const buffers = [Buffer.alloc(0), Buffer.alloc(0)]
    let next = 0
    while (!state.stopped) {
        const frame = await state.receiver.receive(200, omt.FrameType.Video, buffers[next].length ? buffers[next] : undefined).catch(() => null)
        if (state.stopped) break
        if (!frame?.data || !frame.width) continue
        if (frame.data.buffer !== buffers[next].buffer) buffers[next] = Buffer.alloc(frame.data.length)
        next = 1 - next
        frame.hash = hash(frame)
        state.frames++
        if (frame.hash !== state.latest?.hash) state.unique++
        state.latest = frame
    }
    state.receiver.destroy()
}

function watch(address) {
    if (receivers.has(address)) return
    const state = { receiver: new omt.Receiver(address, omt.FrameType.Video, omt.PreferredVideoFormat.UYVY), frames: 0, unique: 0, latest: null, stopped: false }
    receivers.set(address, state)
    state.done = receiveLoop(state)
}

function startSender({ name, color, width, height, fps }) {
    const sender = new omt.Sender(name)
    const data = Buffer.alloc(width * height * 4)
    for (let i = 0; i < data.length; i += 4) {
        data[i] = color[2]
        data[i + 1] = color[1]
        data[i + 2] = color[0]
        data[i + 3] = 255
    }
    const timer = setInterval(() => {
        sender.send({ type: omt.FrameType.Video, timestamp: -1n, codec: omt.Codec.BGRA, width, height, stride: width * 4, frameRateN: fps, frameRateD: 1, colorSpace: omt.ColorSpace.BT709, data })
    }, 1000 / fps)
    senders.set(name, { sender, timer })
    return sender.address
}

const commands = {
    find: () => omt.getAddresses() || [],
    watch: ({ address }) => watch(address),
    snapshot: ({ address }) => {
        const latest = receivers.get(address)?.latest
        return latest ? analyze(latest) : null
    },
    rate: async ({ address, ms }) => {
        const state = receivers.get(address)
        if (!state) return null
        const [frames, unique] = [state.frames, state.unique]
        await new Promise((r) => setTimeout(r, ms))
        return { frames: ((state.frames - frames) * 1000) / ms, unique: ((state.unique - unique) * 1000) / ms }
    },
    png: ({ address, file }) => {
        const latest = receivers.get(address)?.latest
        if (latest) writePng(latest, file)
        return !!latest
    },
    send: (data) => startSender(data),
    stop: async () => {
        for (const { sender, timer } of senders.values()) {
            clearInterval(timer)
            sender.destroy()
        }
        senders.clear()
        for (const state of receivers.values()) state.stopped = true
        await Promise.all([...receivers.values()].map((state) => state.done))
        receivers.clear()
    }
}

readline.createInterface({ input: process.stdin }).on("line", async (line) => {
    const { id, cmd, ...data } = JSON.parse(line)
    let reply
    try {
        reply = { id, result: (await commands[cmd](data)) ?? null }
    } catch (err) {
        reply = { id, error: err.message }
    }
    process.stdout.write(JSON.stringify(reply) + "\n")
    if (cmd === "stop") process.exit(0)
})
