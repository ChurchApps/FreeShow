import { test, expect } from "@playwright/test"
import { _electron as electron } from "playwright"
import tmp from "tmp"

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

test.describe("FreeShow Show Management E2E Tests", () => {
    test.beforeEach(async ({ context }) => {
        await context.route("https://api.github.com/repos/ChurchApps/freeshow/releases", route => route.abort())
    })

    test("Show creation workflow", async () => {
        const tmpSettingFolder = tmp.dirSync({ unsafeCleanup: true })
        const tmpDataFolder = tmp.dirSync({ unsafeCleanup: true })

        const electronApp = await electron.launch({
            args: ["."],
            env: {
                ...process.env,
                NODE_ENV: "production",
                FS_MOCK_STORE_PATH: tmpSettingFolder.name
            }
        })

        await electronApp.evaluate(async ({ dialog }, tmpDataFolderName) => {
            dialog.showOpenDialogSync = (): string[] | undefined => {
                return [tmpDataFolderName]
            }
        }, tmpDataFolder.name)

        const window = await electronApp.waitForEvent("window")
        await delay(3000)

        // Verify the basic interface is loaded
        await expect(window.locator("body")).toBeVisible()

        // Test would continue with actual show creation steps
        // This is a placeholder for the full workflow

        await electronApp.close()
        tmpSettingFolder.removeCallback()
        tmpDataFolder.removeCallback()
    })

    test("Slide editing workflow", async () => {
        const tmpSettingFolder = tmp.dirSync({ unsafeCleanup: true })
        const electronApp = await electron.launch({
            args: ["."],
            env: {
                ...process.env,
                NODE_ENV: "production",
                FS_MOCK_STORE_PATH: tmpSettingFolder.name
            }
        })

        const window = await electronApp.waitForEvent("window")
        await delay(3000)

        // Basic verification that app loaded
        await expect(window.locator("body")).toBeVisible()

        // Slide editing tests would go here
        // This would include adding text, formatting, etc.

        await electronApp.close()
        tmpSettingFolder.removeCallback()
    })

    test("Media integration workflow", async () => {
        const tmpSettingFolder = tmp.dirSync({ unsafeCleanup: true })
        const electronApp = await electron.launch({
            args: ["."],
            env: {
                ...process.env,
                NODE_ENV: "production",
                FS_MOCK_STORE_PATH: tmpSettingFolder.name
            }
        })

        const window = await electronApp.waitForEvent("window")
        await delay(3000)

        // Verify app loaded
        await expect(window.locator("body")).toBeVisible()

        // Media integration tests would go here
        // This would include adding images, videos, audio

        await electronApp.close()
        tmpSettingFolder.removeCallback()
    })

    test("Output management workflow", async () => {
        const tmpSettingFolder = tmp.dirSync({ unsafeCleanup: true })
        const electronApp = await electron.launch({
            args: ["."],
            env: {
                ...process.env,
                NODE_ENV: "production",
                FS_MOCK_STORE_PATH: tmpSettingFolder.name
            }
        })

        const window = await electronApp.waitForEvent("window")
        await delay(3000)

        // Verify app loaded
        await expect(window.locator("body")).toBeVisible()

        // Output management tests would go here
        // This would include configuring displays, sending output

        await electronApp.close()
        tmpSettingFolder.removeCallback()
    })

    test("Import/Export functionality", async () => {
        const tmpSettingFolder = tmp.dirSync({ unsafeCleanup: true })
        const electronApp = await electron.launch({
            args: ["."],
            env: {
                ...process.env,
                NODE_ENV: "production",
                FS_MOCK_STORE_PATH: tmpSettingFolder.name
            }
        })

        const window = await electronApp.waitForEvent("window")
        await delay(3000)

        // Verify app loaded
        await expect(window.locator("body")).toBeVisible()

        // Import/Export tests would go here
        // This would include testing various file formats

        await electronApp.close()
        tmpSettingFolder.removeCallback()
    })
})
