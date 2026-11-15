import { _electron as electron, type ElectronApplication, type Locator, type Page } from "playwright"
import { expect } from "@playwright/test"
import tmp from "tmp"

// Shared setup for the Electron e2e tests (production build: run `npm run build` first).
// Not a test file itself (Playwright only runs *.test.ts).

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
export const MOD = process.platform === "darwin" ? "Meta" : "Control"

export interface TestApp {
    app: ElectronApplication
    win: Page
    close: () => Promise<void>
}

/** Start FreeShow with empty temporary settings and data folders, finish the first-run setup and skip the guide. */
export async function launchApp(): Promise<TestApp> {
    const tmpStore = tmp.dirSync({ unsafeCleanup: true })
    const tmpData = tmp.dirSync({ unsafeCleanup: true })

    const app = await electron.launch({ args: [".", "--no-sandbox"], env: { ...process.env, NODE_ENV: "production", FS_MOCK_STORE_PATH: tmpStore.name } })
    await app.evaluate(async ({ dialog }, dataFolder) => {
        dialog.showOpenDialog = async (): Promise<any> => ({ canceled: false, filePaths: [dataFolder] })
    }, tmpData.name)

    // the app opens a small loading window first, then the main window (index.html)
    await app.waitForEvent("window")
    let main = app.windows().find((w) => w.url().includes("index.html"))
    for (let i = 0; i < 40 && !main; i++) {
        await delay(500)
        main = app.windows().find((w) => w.url().includes("index.html"))
    }
    const win = main || (await app.firstWindow())

    await win.locator(".popup button.start, .top").first().waitFor({ timeout: 30_000 })
    const setupStart = win.locator(".popup button.start")
    if (await setupStart.count()) {
        const setup = win.locator(".popup")
        await setup.locator(".dropdown-trigger").first().click()
        await setup.locator("li[role=option]").filter({ hasText: "English" }).first().click()
        await setup.locator(".button-trigger").first().click()
        await setupStart.click()
    }

    // skip the onboarding guide (its overlay intercepts clicks)
    const skipGuide = win.locator("#guideButtons").getByText("Skip")
    for (let i = 0; i < 30; i++) {
        if (await skipGuide.count()) await skipGuide.click().catch(() => {})
        if (i > 6 && !(await win.locator(".guide").count())) break
        await delay(500)
    }
    await dismissPopups(win)

    const close = async () => {
        const proc = app.process()
        await Promise.race([app.close(), delay(5_000)]).catch(() => {})
        try {
            if (proc?.pid && !proc.killed) proc.kill("SIGKILL")
        } catch {
            // already exited
        }
        tmpData.removeCallback()
        tmpStore.removeCallback()
    }

    return { app, win, close }
}

/** Close informational popups (e.g. "Graphics acceleration is unavailable" on CI), which can open at any time. */
export async function dismissPopups(win: Page) {
    for (let i = 0; i < 3; i++) {
        const popup = win.locator(".popup")
        const visible =
            (await popup.count()) &&
            (await popup
                .first()
                .isVisible()
                .catch(() => false))
        if (!visible) return
        if (await popup.locator("#name").count()) return // the create show popup is wanted
        await popup
            .locator("button")
            .last()
            .click({ timeout: 2_000 })
            .catch(() => win.keyboard.press("Escape"))
        await delay(300)
    }
}

/** Click, dismissing a popup and retrying when one opened in the way. */
export async function clickSafe(win: Page, target: Locator, options: Parameters<Locator["click"]>[0] = {}) {
    for (let attempt = 0; ; attempt++) {
        await dismissPopups(win)
        try {
            await target.click({ timeout: 5_000, ...options })
            return
        } catch (err) {
            if (attempt >= 3) throw err
        }
    }
}

/** Press keys with nothing focused (app shortcuts are ignored while a button or input has focus). */
export async function pressGlobal(win: Page, keys: string) {
    await dismissPopups(win) // an open popup would take the keys
    await win.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await win.keyboard.press(keys)
    await delay(400)
}

export async function createProject(win: Page) {
    await clickSafe(win, win.getByText("New project").first())
}

/** Create a show with four slides (Verse, Chorus, Verse, Bridge) in the open project. */
export async function createShow(win: Page, name: string) {
    await clickSafe(win, win.getByText("New show").first())
    await win.locator("#name").fill(name)
    await win.locator("#name").press("Enter")
    await win.getByPlaceholder("[Verse]").fill(`[Verse]\n${name} a\n\n[Chorus]\n${name} b\n\n[Verse]\n${name} c\n\n[Bridge]\n${name} d`)
    await win.getByTestId("create.show.popup.new.show").click()
    await expect(win.locator(".popup #name")).toHaveCount(0)
}
