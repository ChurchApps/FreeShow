// Output functionality and performance test, run manually: npm run build && npm run test:outputs
// Drives FreeShow over the REST API and checks what actually leaves its OMT outputs.

import { expect, test } from "@playwright/test"
import { execFileSync, spawn, type ChildProcess } from "child_process"
import fs from "fs"
import net from "net"
import os from "os"
import path from "path"
import readline from "readline"
import { _electron as electron, type ElectronApplication } from "playwright"
import tmp from "tmp"

const ROOT = path.resolve(__dirname, "../../..")
const OUT_DIR = path.join(ROOT, "test-output", "outputs")
const HISTORY_FILE = path.join(OUT_DIR, "history.json")

type Rgb = number[]
type Snapshot = { width: number; height: number; mean: Rgb; cells: Rgb[]; bright: number; hash: number }
type OutputSeed = { id: string; name: string; width: number; height: number; fps: number; style?: string }

const near = (a: Rgb, b: Rgb, tolerance = 40) => a.every((v, i) => Math.abs(v - b[i]) <= tolerance)
const BLACK = [0, 0, 0]
const RED = [255, 0, 0]
const GREEN = [0, 200, 0]

// ----- probe -----

class Probe {
    private process: ChildProcess
    private pending = new Map<number, (reply: any) => void>()
    private nextId = 1

    constructor() {
        this.process = spawn(require("electron") as unknown as string, [path.join(__dirname, "omtProbe.cjs")], { cwd: ROOT, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, stdio: ["pipe", "pipe", "inherit"] })
        readline.createInterface({ input: this.process.stdout! }).on("line", (line) => {
            const reply = JSON.parse(line)
            this.pending.get(reply.id)?.(reply)
            this.pending.delete(reply.id)
        })
    }

    request<T = any>(cmd: string, data: object = {}): Promise<T> {
        const id = this.nextId++
        return new Promise((resolve, reject) => {
            this.pending.set(id, (reply) => (reply.error ? reject(new Error(reply.error)) : resolve(reply.result)))
            this.process.stdin!.write(JSON.stringify({ id, cmd, ...data }) + "\n")
        })
    }

    snapshot = (address: string) => this.request<Snapshot | null>("snapshot", { address })
    rate = (address: string, ms: number) => this.request<{ frames: number; unique: number }>("rate", { address, ms })

    async stop() {
        await Promise.race([this.request("stop"), new Promise((r) => setTimeout(r, 5000))]).catch(() => {})
        this.process.kill()
    }
}

// ----- app -----

class App {
    outputs: { [id: string]: string } = {}
    private constructor(
        public app: ElectronApplication,
        private port: number,
        private dirs: tmp.DirResult[]
    ) {}

    static async launch(seeds: OutputSeed[], styles: object = {}) {
        const store = tmp.dirSync({ unsafeCleanup: true })
        const data = tmp.dirSync({ unsafeCleanup: true })
        const chromium = tmp.dirSync({ unsafeCleanup: true })
        const port = await freePort()

        const outputs = Object.fromEntries(
            seeds.map((o) => [
                o.id,
                {
                    enabled: true,
                    active: true,
                    name: o.name,
                    color: "#F0008C",
                    bounds: { x: 0, y: 0, width: o.width, height: o.height },
                    forcedResolution: { width: o.width, height: o.height },
                    screen: null,
                    invisible: true,
                    omt: true,
                    omtData: { name: `FreeShow Test ${o.name}`, framerate: String(o.fps) },
                    style: o.style || "",
                    show: {}
                }
            ])
        )
        fs.writeFileSync(path.join(store.name, "config.json"), JSON.stringify({ loaded: true, dataPath: data.name }))
        fs.writeFileSync(path.join(store.name, "settings.json"), JSON.stringify({ initialized: true, alertUpdates: false, language: "en", outputs, ports: { remote: 5510, stage: 5511, companion: port - 1 }, serverData: { companion: { enabled: true } } }))
        fs.writeFileSync(path.join(store.name, "settings_synced.json"), JSON.stringify({ styles }))

        const app = await electron.launch({
            args: [".", "--no-sandbox", `--user-data-dir=${chromium.name}`],
            cwd: ROOT,
            env: { ...process.env, NODE_ENV: "production", FS_MOCK_STORE_PATH: store.name }
        })
        const instance = new App(app, port, [store, data, chromium])
        await waitFor("the REST API to answer", 60_000, async () => (await instance.rest("get_output").catch(() => undefined)) !== undefined)
        return instance
    }

    async rest(action: string, data: object = {}) {
        const response = await fetch(`http://127.0.0.1:${this.port}/`, { method: "POST", headers: { "Content-Type": "application/json", Connection: "close" }, body: JSON.stringify({ action, ...data }) })
        if (response.status === 204) return null
        return (await response.json()).data
    }

    // exits without the quit flow, which can wait on prompts
    async close() {
        const child = this.app.process()
        const exited = new Promise((r) => (child.exitCode === null ? child.once("exit", r) : r(null)))
        this.app.evaluate(({ app }) => app.exit(0)).catch(() => {})
        await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))])
        if (child.exitCode === null && child.pid) {
            if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"])
            else child.kill("SIGKILL")
        }
        // Chromium can hold its cache files for a moment after exit
        for (const dir of this.dirs) fs.rmSync(dir.name, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    }
}

function freePort(): Promise<number> {
    return new Promise((resolve) => {
        const server = net.createServer().listen(0, () => {
            const { port } = server.address() as net.AddressInfo
            server.close(() => resolve(port))
        })
    })
}

// polls until the check passes; the limit only decides when to give up
async function waitFor(what: string, limitMs: number, check: () => Promise<boolean>, detail?: () => Promise<unknown>) {
    const start = Date.now()
    while (Date.now() - start < limitMs) {
        if (await check()) return Date.now() - start
        await new Promise((r) => setTimeout(r, 100))
    }
    throw new Error(`Timed out waiting for ${what}${detail ? `: ${JSON.stringify(await detail())}` : ""}`)
}

async function connectOutputs(app: App, probe: Probe, seeds: OutputSeed[]) {
    for (const seed of seeds) {
        await waitFor(`OMT output "${seed.name}"`, 30_000, async () => {
            const address = (await probe.request<string[]>("find")).find((a) => a.endsWith(`(FreeShow Test ${seed.name})`))
            if (address) app.outputs[seed.id] = address
            return !!address
        })
        await probe.request("watch", { address: app.outputs[seed.id] })
        await waitFor(`frames from "${seed.name}"`, 15_000, async () => !!(await probe.snapshot(app.outputs[seed.id])))
    }
}

// the hue turns every frame, so each frame differs everywhere
function testVideo(width: number, height: number, fps: number) {
    const file = path.join(OUT_DIR, "media", `hue_${width}x${height}_${fps}.mp4`)
    if (fs.existsSync(file)) return file
    fs.mkdirSync(path.dirname(file), { recursive: true })
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `testsrc2=s=${width}x${height}:r=${fps},hue=H=2*PI*t`, "-t", "20", "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p", file])
    return file
}

function hasFfmpeg() {
    try {
        execFileSync("ffmpeg", ["-version"], { stdio: "ignore" })
        return true
    } catch {
        return false
    }
}

// compares with this machine's previous run; there are no fixed targets, as rates depend on the hardware
function report(name: string, results: { [label: string]: number }) {
    const history = fs.existsSync(HISTORY_FILE) ? JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8")) : {}
    const key = `${os.hostname()}:${name}`
    const previous = history[key]?.results || {}

    console.log(`\n${name}${history[key] ? ` (previous run ${history[key].date})` : ""}`)
    for (const [label, value] of Object.entries(results)) {
        const before = previous[label]
        console.log(`  ${label}: ${value.toFixed(1)}${before !== undefined ? ` (was ${before.toFixed(1)})` : ""}`)
    }

    history[key] = { date: new Date().toISOString(), results }
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 4))
}

let app: App | null = null
let probe: Probe | null = null

test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus && app && probe) {
        for (const [id, address] of Object.entries(app.outputs)) await probe.request("png", { address, file: path.join(OUT_DIR, "failed", `${testInfo.title}-${id}.png`) })
    }
    await probe?.stop()
    await app?.close()
    probe = app = null
})

test.beforeEach(() => {
    probe = new Probe()
})

test("outputs show the right content", async () => {
    test.setTimeout(240_000)
    const seeds: OutputSeed[] = [
        { id: "a", name: "A", width: 1920, height: 1080, fps: 60 },
        { id: "b", name: "B", width: 1920, height: 1080, fps: 60, style: "red" }
    ]
    const video = hasFfmpeg() ? testVideo(1920, 1080, 60) : ""
    app = await App.launch(seeds, { red: { name: "Red", background: "#ff0000" } })
    await connectOutputs(app, probe!, seeds)
    const [a, b] = [app.outputs.a, app.outputs.b]
    const snap = async (address: string) => (await probe!.snapshot(address))!
    let showId = ""

    await test.step("outputs send at their resolution and style", async () => {
        for (const address of [a, b]) expect(await snap(address)).toMatchObject({ width: 1920, height: 1080 })
        await waitFor("the clear outputs", 10_000, async () => near((await snap(a)).mean, BLACK) && near((await snap(b)).mean, RED))
    })

    await test.step("a slide's text reaches every output", async () => {
        await app!.rest("create_show", { name: "Output test", text: "First line of text\nSecond line\n\nAnother slide\nWith more text" })
        await waitFor("the new show", 10_000, async () => {
            const shows = (await app!.rest("get_shows")) || {}
            showId = Object.keys(shows).find((id) => shows[id].name === "Output test") || ""
            return !!showId
        })
        await app!.rest("start_show", { id: showId })
        await waitFor("text on both outputs", 10_000, async () => (await snap(a)).bright > 0.002 && (await snap(b)).bright > 0.002)
        expect(near((await snap(b)).cells[0], RED)).toBe(true)

        const before = [(await snap(a)).hash, (await snap(b)).hash]
        await app!.rest("next_slide")
        await waitFor("the next slide on both outputs", 10_000, async () => (await snap(a)).hash !== before[0] && (await snap(b)).hash !== before[1])

        await app!.rest("clear_all")
        await waitFor("the outputs to clear", 10_000, async () => (await snap(a)).bright < 0.0005 && near((await snap(a)).mean, BLACK) && near((await snap(b)).mean, RED))
    })

    await test.step("outputs with the same content match, and split as soon as it differs", async () => {
        await app!.rest("change_output_style", { outputId: "b", styleId: "" })
        await app!.rest("start_show", { id: showId })
        await waitFor(
            "identical outputs",
            10_000,
            async () => {
                const [sa, sb] = [await snap(a), await snap(b)]
                return sa.bright > 0.002 && sa.cells.every((cell, i) => near(cell, sb.cells[i], 12))
            },
            async () => [await snap(a), await snap(b)].map((x) => ({ bright: x.bright, cells: x.cells }))
        )

        // a style change refreshes every output, so the text fades in again on both
        await app!.rest("change_output_style", { outputId: "b", styleId: "red" })
        await waitFor("output B alone to turn red, with the text on both", 10_000, async () => {
            const [sa, sb] = [await snap(a), await snap(b)]
            return near(sb.cells[0], RED) && near(sa.cells[0], BLACK) && sa.bright > 0.002 && sb.bright > 0.002
        })
        await app!.rest("clear_all")
    })

    await test.step("a live input reaches only its own output", async () => {
        const source = await probe!.request<string>("send", { name: "FreeShow Test Input", color: GREEN, width: 1280, height: 720, fps: 30 })
        await app!.rest("show_live_source", { id: source, type: "omt", outputId: "a" })
        await waitFor("the input on output A", 15_000, async () => {
            expect(near((await snap(b)).mean, GREEN)).toBe(false)
            return near((await snap(a)).mean, GREEN)
        })
        const settle = Date.now() + 2000
        while (Date.now() < settle) expect(near((await snap(b)).mean, RED)).toBe(true)
        await app!.rest("clear_all")
        await waitFor("output A to clear", 10_000, async () => near((await snap(a)).mean, BLACK))
    })

    await test.step("a video plays on every output", async () => {
        test.skip(!video, "ffmpeg is needed to make the test video")
        await app!.rest("play_media", { path: video })
        await waitFor("the video on both outputs", 15_000, async () => (await probe!.rate(a, 500)).unique > 0 && (await probe!.rate(b, 500)).unique > 0)
        const [ra, rb] = await Promise.all([probe!.rate(a, 5000), probe!.rate(b, 5000)])
        report("1080p60 video, two outputs (new frames a second, source 60)", { "output A": ra.unique, "output B": rb.unique })
        await app!.rest("clear_all")
    })
})

test("two 4K60 outputs play a 4K60 video", async () => {
    test.skip(!hasFfmpeg(), "ffmpeg is needed to make the test video")
    test.setTimeout(300_000)
    const video = testVideo(3840, 2160, 60)
    const seeds: OutputSeed[] = [
        { id: "a", name: "4K A", width: 3840, height: 2160, fps: 60 },
        { id: "b", name: "4K B", width: 3840, height: 2160, fps: 60 }
    ]
    app = await App.launch(seeds)
    await connectOutputs(app, probe!, seeds)

    await app.rest("play_media", { path: video })
    await waitFor(
        "the video on both outputs",
        20_000,
        async () => (await probe!.rate(app!.outputs.a, 500)).unique > 0 && (await probe!.rate(app!.outputs.b, 500)).unique > 0,
        async () => [await probe!.rate(app!.outputs.a, 1000), await probe!.rate(app!.outputs.b, 1000)]
    )
    await new Promise((r) => setTimeout(r, 3000))
    const [ra, rb] = await Promise.all([probe!.rate(app.outputs.a, 10_000), probe!.rate(app.outputs.b, 10_000)])
    report("4K60 video, two 4K60 outputs (new frames a second, source 60)", { "output A": ra.unique, "output B": rb.unique, "output A sent": ra.frames, "output B sent": rb.frames })
    expect(ra.unique).toBeGreaterThan(0)
    expect(rb.unique).toBeGreaterThan(0)
})
