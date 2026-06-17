import { _electron as electron } from "playwright"
import { expect, test } from "@playwright/test"
import tmp from "tmp"

const timeoutMs = 2_000;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test.beforeEach(async ({ context }) => {
    await context.route("https://api.github.com/repos/ChurchApps/freeshow/releases", (route) => route.abort())
})

test("Launch electron app", async () => {
    const tmpSettingFolder = tmp.dirSync({ unsafeCleanup: true })
    const electronApp = await electron.launch({
        args: ["."],
        env: { ...process.env, NODE_ENV: "production", FS_MOCK_STORE_PATH: tmpSettingFolder.name },
    })

    // Mocking Electron open dialog
    const tmpDataFolder = tmp.dirSync({ unsafeCleanup: true })
    await electronApp.evaluate(async ({ dialog }, tmpDataFolderName) => {
        dialog.showOpenDialogSync = (): string[] | undefined => {
            return [tmpDataFolderName]
        }
    }, tmpDataFolder.name)

    await electronApp.waitForEvent("window")

    // Seems like we need some delay for FreeShow to start up correctly,
    // before doing anything
    // TODO: would be great if we can identify the loading window and main window
    await delay(5_000)

    const appPath = await electronApp.evaluate(async ({ app }) => {
        // This runs in the main Electron process, parameter here is always
        // the result of the require('electron') in the main app script.
        return app.getAppPath()
    })
    console.log(appPath)

    // The app opens a small loading/splash window first, then the main window.
    // firstWindow() can return the splash, so explicitly pick the main window (it loads index.html).
    let window = electronApp.windows().find((w) => w.url().includes("index.html"))
    for (let i = 0; i < 20 && !window; i++) {
        await delay(500)
        window = electronApp.windows().find((w) => w.url().includes("index.html"))
    }
    if (!window) window = await electronApp.firstWindow()

    // Direct Electron console to Node terminal.
    window.on("console", console.log)
    try {
        // Print the title.
        console.log(await window.title())

        // Capture a screenshot.
        // await window.screenshot({ path: "intro.png" })

        // Wait for the app UI to be interactive: either the first-run setup popup or the main top bar.
        await window.locator(".popup button.start, .top").first().waitFor({ timeout: 10 * timeoutMs })

        // First-run setup popup (Initialize.svelte) — only shown when the app isn't initialized yet.
        // It can be absent if a previous run already initialized the user data, so guard it.
        const setupStart = window.locator(".popup button.start")
        let didSetup = false
        if ((await setupStart.count()) > 0) {
            const setupPopup = window.locator(".popup")

            // Set language to English (it is the default, but select it explicitly so the English text selectors below stay stable)
            await setupPopup.locator(".dropdown-trigger").first().click({ timeout: 5 * timeoutMs })
            await setupPopup.locator("li[role=option]").filter({ hasText: "English" }).first().click({ timeout: timeoutMs })

            // Set the data location via the folder picker; this triggers the Electron open dialog, mocked above
            await setupPopup.locator(".button-trigger").first().click({ timeout: timeoutMs })

            // Finish setup ("Get started!")
            await setupStart.click({ timeout: timeoutMs })
            didSetup = true
        }

        // skip the onboarding guide (it opens right after a fresh setup; its overlay otherwise intercepts clicks)
        const skipGuide = window.locator("#guideButtons").getByText("Skip")
        if (didSetup) await skipGuide.waitFor({ timeout: 5 * timeoutMs })
        if ((await skipGuide.count()) > 0) await skipGuide.click({ timeout: timeoutMs })

        // Create a new project, then try creating a new show under the project
        await window.getByText("New project").first().click({ timeout: timeoutMs })
        await window.getByText("New show").first().click({ timeout: timeoutMs })

        // Expect the create-show popup to be visible (the name input is part of it)
        await expect(window.locator("#name")).toBeVisible({ timeout: timeoutMs })

        // Fill name of show
        await window.locator("#name").fill("New Test Show", { timeout: timeoutMs })

        // Select category (this will sometimes not have any categories)
        // await window.getByText("—").click()
        // await window.locator("#id_categorysong").click()

        // Put lyrics
        await window.getByText("Quick Lyrics").click({ timeout: timeoutMs })
        let lyricsBox = window.getByPlaceholder("[Verse]")
        await lyricsBox.focus()
        await lyricsBox.fill(`[Verse]\ntest line 1\ntest line 2\n\n[Chorus]\ntest line 3\ntest line 4`, { timeout: timeoutMs })

        // Click new show
        await window.getByTestId("create.show.popup.new.show").click({ timeout: timeoutMs })

        // Try changing group for Chorus (group names render as text in the #group list)
        await window.locator("#group").getByText("Chorus").first().click({ timeout: timeoutMs })
        //await window.getByText("Change group").hover({ timeout: timeoutMs })
        await window.locator("#group").getByText("Verse").first().click({ timeout: 5 * timeoutMs })

        // Verify the group changing was successful
        await expect(window.locator("#group").getByText("Verse").first()).toBeVisible({ timeout: timeoutMs })

        // Manual save via keyboard shortcut (Ctrl+S) — robust across menu changes; the app also auto-saves
        await window.keyboard.press("Escape")
        await window.keyboard.press("Control+s")
        await delay(5_000)
    } catch (ex) {
        console.log("Taking screenshot")
        await window.screenshot({ path: "test-output/screenshots/failed.png" })
        throw ex
    }

    // Close after finishing
    console.log("Closing app...")
    electronApp.close() // await here not detecting close on Linux
    await delay(2_000)
    console.log("App closed!")

    tmpDataFolder.removeCallback()
    tmpSettingFolder.removeCallback()
    console.log("DONE!")
})
