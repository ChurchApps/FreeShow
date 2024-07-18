import { _electron as electron } from "playwright"
import { expect, test } from "@playwright/test"
import tmp from "tmp"

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
    await delay(5000)

    const appPath = await electronApp.evaluate(async ({ app }) => {
        // This runs in the main Electron process, parameter here is always
        // the result of the require('electron') in the main app script.
        return app.getAppPath()
    })
    console.log(appPath)

    // Get the first window that the app opens, wait if necessary.
    const window = await electronApp.firstWindow()

    // Direct Electron console to Node terminal.
    window.on("console", console.log)
    try {
        // Print the title.
        console.log(await window.title())

        // Capture a screenshot.
        // await window.screenshot({ path: "intro.png" })

        // Initial setup
        // Set language to English
        await window.locator(".main .dropdownElem").getByRole("button").click({ timeout: 5000 })
        await window.locator(".main .dropdownElem .dropdown #id_English").click({ timeout: 1000 })
        // This triggers the Electron open dialog, mocked above
        await window.locator(".main .showElem").getByRole("button").click()
        await window.getByText("Get Started!").click({ timeout: 1000 })
        // This depends on whether there is existing shows to be loaded.
        // As the existing show folder is also mocked to be a tmp folder,
        // this is not expected.
        // await window.getByTestId("alert.ack.check").click({ timeout: 1000 })

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

        // Manual save!
        await window.getByText("File").click({ timeout: 1000 })
        await window.getByText("Save").click({ timeout: 1000 })
        await delay(3000)
    } catch (ex) {
        console.log("Taking screenshot")
        await window.screenshot({ path: "test-output/screenshots/failed.png" })
        throw ex
    }

    // Close after finishing
    console.log("Closing app...")
    setTimeout(() => {
        if (window.isClosed()) return
        console.log("Taking screenshot")
        window.screenshot({ path: "test-output/screenshots/not_closing.png" })
    }, 3000)
    await electronApp.close()
    console.log("App closed!")

    tmpDataFolder.removeCallback()
    tmpSettingFolder.removeCallback()
    console.log("DONE!")
})
