import { expect, test } from "@playwright/test"
import { _electron as electron } from "playwright"
import tmp from "tmp"

// End to end check: selection outlines turn gray while the app window is not focused.

const timeoutMs = 2_000
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const GRAY_RGB = "rgb(139, 139, 150)"

test("unfocused window styling", async () => {
    const tmpSettingFolder = tmp.dirSync({ unsafeCleanup: true })
    const tmpDataFolder = tmp.dirSync({ unsafeCleanup: true })

    const electronApp = await electron.launch({
        args: [".", "--no-sandbox"],
        env: { ...process.env, NODE_ENV: "production", FS_MOCK_STORE_PATH: tmpSettingFolder.name }
    })
    await electronApp.evaluate(async ({ dialog, session }, folder) => {
        dialog.showOpenDialogSync = (): string[] | undefined => [folder]
        // no update check during the test (blocked in Electron, so no browser fixture is needed)
        session.defaultSession.webRequest.onBeforeRequest({ urls: ["https://api.github.com/*"] }, (_details, callback) => callback({ cancel: true }))
    }, tmpDataFolder.name)

    await electronApp.waitForEvent("window")
    await delay(5_000)

    let window = electronApp.windows().find((w) => w.url().includes("index.html"))
    for (let i = 0; i < 20 && !window; i++) {
        await delay(500)
        window = electronApp.windows().find((w) => w.url().includes("index.html"))
    }
    if (!window) window = await electronApp.firstWindow()

    const pageErrors: string[] = []
    window.on("pageerror", (error) => pageErrors.push(String(error)))

    try {
        await window
            .locator(".popup button.start, .top")
            .first()
            .waitFor({ timeout: 10 * timeoutMs })

        // first run setup, skipped when the data folder was already initialized
        const setupStart = window.locator(".popup button.start")
        let didSetup = false
        if ((await setupStart.count()) > 0) {
            const setupPopup = window.locator(".popup")
            await setupPopup
                .locator(".dropdown-trigger")
                .first()
                .click({ timeout: 5 * timeoutMs })
            await setupPopup.locator("li[role=option]").filter({ hasText: "English" }).first().click({ timeout: timeoutMs })
            await setupPopup.locator(".button-trigger").first().click({ timeout: timeoutMs })
            await setupStart.click({ timeout: timeoutMs })
            didSetup = true
        }

        const skipGuide = window.locator("#guideButtons").getByText("Skip")
        if (didSetup) await skipGuide.waitFor({ timeout: 5 * timeoutMs })
        if ((await skipGuide.count()) > 0) await skipGuide.click({ timeout: timeoutMs })

        // FreeShow draws the outline of a slide in output inline, with the output color (which
        // follows the theme accent). That inline outline is the one the user sees and the hardest
        // case for the gray to reach, so it is recreated here to be checked without needing a show.
        await window.evaluate(() => {
            const probe = document.createElement("div")
            probe.id = "outline-probe"
            probe.setAttribute("style", "outline: 2px solid #338bff; position: fixed; top: 0; width: 10px; height: 10px;")
            document.body.appendChild(probe)
        })

        const readOutlines = () =>
            window!.evaluate(() => {
                const outlineOf = (selector: string) => {
                    const elem = document.querySelector(selector)
                    return elem ? getComputedStyle(elem).outlineColor : ""
                }
                return {
                    attribute: document.documentElement.getAttribute("data-window-focused"),
                    inlineOutline: outlineOf("#outline-probe"),
                    // any real element the app is marking as active/selected right now
                    appOutline: outlineOf(".tabs .active, .drawer .active, .main.active")
                }
            })

        // Real .focus()/.blur() calls turned out unusable here: in this environment Windows
        // sometimes hands focus straight back a moment later with a stray "blur" event that
        // Electron never pairs up with a matching "focus" again (BrowserWindow.isFocused() then
        // disagrees with the last event it actually emitted), making the OS-level focus state
        // itself non-deterministic - a limitation of running without real user interaction, not
        // of the app. So this drives the app's own "focus"/"blur" events on the BrowserWindow
        // directly instead of asking Windows to change real focus. That still exercises the exact
        // production path end to end (the same listener in electron/index.ts, the same
        // executeJavaScript() call, the same DOM attribute), just without the OS in the loop.
        //
        // electronApp.browserWindow() resolves the exact BrowserWindow behind this Playwright
        // page - the first-run setup wizard briefly opens a second window that also loads
        // index.html, so matching by URL alone can grab the wrong one.
        const mainBrowserWindow = await electronApp.browserWindow(window)
        const setWindowFocus = (focus: boolean) => mainBrowserWindow.evaluate((win, shouldFocus) => win.emit(shouldFocus ? "focus" : "blur"), focus)

        await setWindowFocus(true)
        await delay(300)
        const focused = await readOutlines()
        expect(focused.attribute).toBe("true")
        // colored, not gray, while the window has focus
        expect(focused.inlineOutline).toBe("rgb(51, 139, 255)")

        await setWindowFocus(false)
        await delay(300)
        const blurred = await readOutlines()
        expect(blurred.attribute).toBe("false")
        // even an inline outline turns gray
        expect(blurred.inlineOutline).toBe(GRAY_RGB)
        if (blurred.appOutline) expect(blurred.appOutline).toBe(GRAY_RGB)

        // focusing again brings the color back
        await setWindowFocus(true)
        await delay(300)
        const refocused = await readOutlines()
        expect(refocused.attribute).toBe("true")
        expect(refocused.inlineOutline).toBe("rgb(51, 139, 255)")

        // the app is still responsive and nothing threw
        await expect(window.locator(".top").first()).toBeVisible({ timeout: timeoutMs })
        expect(pageErrors).toEqual([])
    } catch (ex) {
        await window.screenshot({ path: "test-output/screenshots/focusOutline-failed.png" })
        throw ex
    } finally {
        const electronProcess = electronApp.process()
        await Promise.race([electronApp.close(), delay(5_000)]).catch(() => undefined)
        try {
            if (electronProcess?.pid && !electronProcess.killed) electronProcess.kill("SIGKILL")
        } catch {
            // already exited
        }
        await delay(1_000)
        tmpDataFolder.removeCallback()
        tmpSettingFolder.removeCallback()
    }
})
