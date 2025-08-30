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
        await window.locator(".main .dropdownElem").getByRole("button").click({ timeout: 5 * timeoutMs })
        await window.locator(".main .dropdownElem .dropdown #id_English").click({ timeout: timeoutMs })
        // This triggers the Electron open dialog, mocked above
        await window.locator(".main .showElem").getByRole("button").click()
        await window.getByText("Get Started!").click({ timeout: timeoutMs })
        // This depends on whether there is existing shows to be loaded.
        // As the existing show folder is also mocked to be a tmp folder,
        // this is not expected.
        // await window.getByTestId("alert.ack.check").click({ timeout: timeoutMs })

        // Give time to save initial state
        // await delay(4_000)

        // skip onboarding flow
        await window.locator("#guideButtons").getByText("Skip").click({ timeout: timeoutMs })

        // Create a new project, then try creating a new show under the project
        await window.locator("#leftPanel").getByText("New project").click({ timeout: timeoutMs })
        await window.getByText("New show").first().click({ timeout: timeoutMs })

        // Expect the pop up to be visible
        await expect(window.getByText("Name")).toBeVisible({ timeout: timeoutMs })

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

        // Try changing group for Chorus
        await window.locator("#group").getByTitle("Chorus").click({ timeout: timeoutMs })
        //await window.getByText("Change group").hover({ timeout: timeoutMs })
        await window.locator("#group").getByText("Verse").click({ timeout: 5 * timeoutMs })

        // Verify the group changing was successful
        await expect(window.locator("#group").getByTitle("Verse")).toBeVisible({ timeout: timeoutMs })

        // Manual save!
        await window.locator(".top").getByText("FreeShow").click({ button: "right", timeout: timeoutMs })
        await window.getByText("Save", { exact: true }).click({ timeout: timeoutMs })
        // await window.keyboard.press("Control+S")
        // await window.keyboard.press("Meta+S")
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
