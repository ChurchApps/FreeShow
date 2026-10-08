import fs from "fs"
import os from "os"
import path from "path"
import { _electron as electron, type ElectronApplication, type Page } from "playwright"
import { expect, test } from "@playwright/test"

test("RTMP mode and custom bitrates persist, and CBR hides the VBR peak", async () => {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "freeshow-rtmp-ui-"))
    const dataPath = path.join(profile, "data")
    fs.mkdirSync(dataPath)
    fs.writeFileSync(path.join(profile, "config.json"), JSON.stringify({ dataPath, autoErrorReporting: false }))
    fs.writeFileSync(
        path.join(profile, "settings.json"),
        JSON.stringify({ initialized: true, language: "en", alertUpdates: false, disabledServers: { remote: true, stage: true, controller: true, output_stream: true }, outputs: { default: { enabled: false, active: true, name: "RTMP test", color: "#F0008C", bounds: { x: 0, y: 0, width: 1280, height: 720 }, screen: null, invisible: true, rtmp: true, rtmpData: { bitrate: 4000, encoder: "x264", destinations: [{ id: "test", url: "", key: "", enabled: true }] } } } })
    )
    fs.writeFileSync(path.join(profile, "settings_synced.json"), JSON.stringify({ special: { autoUpdates: false }, language: "en" }))
    let app: ElectronApplication | undefined
    const launch = async () => {
        app = await electron.launch({ executablePath: process.env.FS_TEST_EXECUTABLE, args: process.env.FS_TEST_EXECUTABLE ? [] : [".", "--no-sandbox"], env: { ...process.env, NODE_ENV: "production", FS_MOCK_STORE_PATH: profile } })
        await app.evaluate(({ app }, profile) => app.setPath("userData", profile), profile)
        let page: Page | undefined
        await expect
            .poll(
                () => {
                    page = app!.windows().find((w) => w.url().includes("index.html"))
                    return !!page
                },
                { timeout: 30000 }
            )
            .toBe(true)
        page!.setDefaultTimeout(10000)
        await page!.locator(".top").first().waitFor()
        await page!.locator('.top [data-title^="Settings"]').first().click()
        await page!.getByRole("button", { name: "Outputs", exact: true }).click()
        await page!.locator("#rtmp-bitrate").waitFor()
        return page!
    }
    const close = async () => {
        if (!app) return
        const child = app.process()
        await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
        if (child?.exitCode === null) await Promise.race([new Promise((r) => child.once("exit", r)), new Promise((r) => setTimeout(r, 5000))])
        if (child && child.exitCode === null) child.kill()
        app = undefined
    }
    try {
        let page = await launch()
        const mode = page.locator('.dropdown-trigger[data-title^="Bitrate mode"]')
        await expect(mode).toContainText("Legacy (unchanged)")
        await mode.click()
        await page.getByRole("option", { name: "VBR (variable bitrate)", exact: true }).click()
        await expect(page.getByText("Target bitrate (kbps)", { exact: true })).toBeVisible()
        await page.locator("#rtmp-bitrate").fill("3500")
        await page.locator("#rtmp-bitrate").press("Tab")
        await page.locator("#rtmp-max-bitrate").fill("6500")
        await page.locator("#rtmp-max-bitrate").press("Tab")
        await page.locator("#rtmp-bitrate").fill("0")
        await page.locator("#rtmp-bitrate").press("Tab")
        await expect(page.locator("#rtmp-bitrate")).toHaveValue("3500")
        await page.locator("#rtmp-max-bitrate").fill("3000")
        await page.locator("#rtmp-max-bitrate").press("Tab")
        await expect(page.locator("#rtmp-max-bitrate")).toHaveValue("6500")
        await page.keyboard.press(process.platform === "darwin" ? "Meta+s" : "Control+s")
        await expect.poll(() => JSON.parse(fs.readFileSync(path.join(profile, "settings.json"), "utf8")).outputs.default.rtmpData, { timeout: 10000 }).toMatchObject({ rateControl: "vbr", bitrate: 3500, maxBitrate: 6500 })
        const artifactDir = process.env.FS_TEST_ARTIFACT_DIR || "test-output/screenshots"
        fs.mkdirSync(artifactDir, { recursive: true })
        await page.screenshot({ path: path.join(artifactDir, "rtmp-vbr.png") })
        await close()
        page = await launch()
        await expect(page.locator("#rtmp-bitrate")).toHaveValue("3500")
        await expect(page.locator("#rtmp-max-bitrate")).toHaveValue("6500")
        await page.locator('.dropdown-trigger[data-title^="Bitrate mode"]').click()
        await page.getByRole("option", { name: "CBR (constant bitrate)", exact: true }).click()
        await expect(page.locator("#rtmp-max-bitrate")).toHaveCount(0)
        await expect(page.locator("#rtmp-bitrate")).toHaveValue("3500")
        await page.screenshot({ path: path.join(artifactDir, "rtmp-cbr.png") })
        await page.getByRole("button", { name: "New output", exact: true }).click()
        await page.getByRole("button", { name: "RTMP YouTube, Twitch, Facebook Live" }).click()
        await page.getByRole("button", { name: "Confirm", exact: true }).click()
        await expect(page.locator('.dropdown-trigger[data-title^="Bitrate mode"]')).toContainText("CBR (constant bitrate)")
        await expect(page.locator("#rtmp-bitrate")).toHaveValue("4000")
    } catch (error) {
        const page = app?.windows().find((w) => w.url().includes("index.html"))
        console.log("RTMP UI profile settings:", fs.readFileSync(path.join(profile, "settings.json"), "utf8"))
        await page?.screenshot({ path: "test-output/screenshots/rtmp-ui-failure.png" }).catch(() => {})
        throw error
    } finally {
        await close()
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
    }
})
