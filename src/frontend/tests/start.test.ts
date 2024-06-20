import { _electron as electron } from "playwright"
import { expect, test } from "@playwright/test"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test("Launch electron app", async () => {
    const electronApp = await electron.launch({ args: ["."] })

    await electronApp.waitForEvent("window")

    // Seems like we need some delay for FreeShow to start up correctly,
    // before doing anything
    // TODO: would be great if we can identify the loading window and main window
    await delay(5000)

    const appPath = await electronApp.evaluate(async ({ app }) => {
        // This runs in the main Electron process, parameter here is always
        // the result of the require('electron') in the main app script.
        return app.getAppPath()
    })
    console.log(appPath)

    // Get the first window that the app opens, wait if necessary.
    const window = await electronApp.firstWindow()
    try {
        // Print the title.
        console.log(await window.title())

        // Capture a screenshot.
        // await window.screenshot({ path: "intro.png" })

        // Direct Electron console to Node terminal.
        window.on("console", console.log)

        // Initial setup
        await window.getByText("Get Started!").click({ timeout: 1000 })
        // This depends on whether there is existing shows to be loaded
        try {
            await window.getByTestId("alert.ack.check").click({ timeout: 1000 })
        } catch (ex) {}

        // Create a new project, then try creating a new show under the project
        await window.locator("#leftPanel").getByText("New project").click({ timeout: 1000 })
        await window.getByText("New show").first().click({ timeout: 1000 })

        // Expect the pop up to be visible
        await expect(window.getByText("Name")).toBeVisible({ timeout: 1000 })

        // Fill name of show
        await window.locator("#name").fill("New Test Show", { timeout: 1000 })

        // Select category (this will sometimes not have any categories)
        // await window.getByText("—").click()
        // await window.locator("#id_categorysong").click()

        // Put lyrics
        await window.getByText("Quick Lyrics").click({ timeout: 1000 })
        let lyricsBox = window.getByPlaceholder("[Verse]")
        await lyricsBox.focus()
        await lyricsBox.fill(`[Verse]\ntest line 1\ntest line 2\n\n[Chorus]\ntest line 3\ntest line 4`, { timeout: 1000 })

        // Click new show
        await window.getByTestId("create.show.popup.new.show").click({ timeout: 1000 })

        // Try changing group for Chorus
        await window.getByTitle("Chorus").click({ button: "right", timeout: 1000 })
        await window.getByText("Change group").hover({ timeout: 1000 })
        await window.getByText("Outro").click({ timeout: 1000 })

        // Verify the group changing was successful
        await expect(window.getByTitle("Outro")).toBeVisible({ timeout: 1000 })

        // Close after finishing
        await electronApp.close()
    } catch (ex) {
        console.log("Taking screenshot")
        await window.screenshot({ path: "test-output/screenshots/failed.png" })
        throw ex
    }
})
