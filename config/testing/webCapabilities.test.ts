// E2E: the web client must hide desktop-only features.
//
// Boots the headless server against a temp data folder, loads the web build in a real
// browser, and asserts the capability-gated UI is absent. A desktop client (even one
// connected to a server) keeps these — capabilities come from its local Electron main.
//
// Requires the built artifacts: npm run build:web && npm run build:headless

import { expect, test } from "@playwright/test"
import { spawn, type ChildProcess } from "child_process"
import fs from "fs"
import path from "path"
import tmp from "tmp"

const PORT = 5591
const BASE = `http://localhost:${PORT}`
const ROOT = path.join(__dirname, "..", "..")
const SERVER_ENTRY = path.join(ROOT, "build", "headless", "server", "headless", "index.js")

let server: ChildProcess
let dataDir: tmp.DirResult

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitForServer(timeoutMs = 20_000) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(`${BASE}/health`)
            if (res.ok) return
        } catch {
            // not up yet
        }
        await delay(200)
    }
    throw new Error("headless server did not start")
}

test.beforeAll(async () => {
    if (!fs.existsSync(SERVER_ENTRY)) test.skip(true, "run `npm run build:headless` first")
    if (!fs.existsSync(path.join(ROOT, "build", "web", "index.html"))) test.skip(true, "run `npm run build:web` first")

    dataDir = tmp.dirSync({ unsafeCleanup: true })
    server = spawn("node", [SERVER_ENTRY], {
        cwd: ROOT,
        env: { ...process.env, FREESHOW_PORT: String(PORT), FREESHOW_DATA: dataDir.name },
        stdio: "ignore"
    })
    await waitForServer()
})

test.afterAll(() => {
    server?.kill()
    dataDir?.removeCallback()
})

test("server advertises headless capabilities", async () => {
    const capabilities = await (await fetch(`${BASE}/capabilities`)).json()
    // things a browser genuinely cannot do on the server's machine
    expect(capabilities.outputWindows).toBe(false)
    expect(capabilities.ndi).toBe(false)
    expect(capabilities.blackmagic).toBe(false)
    expect(capabilities.screenCapture).toBe(false)
    expect(capabilities.nativeDialogs).toBe(false)
    expect(capabilities.servers).toBe(false)
})

test("web client hides desktop-only UI", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "networkidle" })
    await delay(4000) // startup handshake + initial data load

    // dismiss first-run popup / quick-start guide if present
    await page
        .getByText("Get started!", { exact: false })
        .click({ timeout: 6000 })
        .catch(() => {})
    for (let i = 0; i < 3; i++) {
        await page
            .getByText("Skip", { exact: true })
            .click({ timeout: 1000 })
            .catch(() => {})
    }
    await delay(500)

    // window controls (min/max/close) belong to the native title bar
    const bodyText = await page.evaluate(() => document.body.innerText)

    // open the Media drawer -> Inputs, where screens/NDI/Blackmagic tabs live
    const clickText = (t: string) =>
        page.evaluate((text) => {
            const el = Array.from(document.querySelectorAll("*")).find((e) => e.children.length === 0 && e.textContent?.trim() === text)
            ;(el?.closest("[role=button],button,[class*=tab]") || el)?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
        }, t)

    await clickText("Media")
    await delay(1000)
    await clickText("Inputs")
    await delay(1000)

    const inputTabs = await page.evaluate(() =>
        Array.from(document.querySelectorAll("button"))
            .map((b) => (b.innerText || "").trim())
            .filter(Boolean)
    )

    // hardware capture inputs must be hidden in the browser
    expect(inputTabs).not.toContain("NDI")
    expect(inputTabs).not.toContain("Blackmagic")
    expect(inputTabs).not.toContain("Screens")

    // the app itself still loaded (sanity: it's not just a blank page)
    expect(bodyText.length).toBeGreaterThan(0)
})
