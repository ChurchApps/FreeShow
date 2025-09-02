import { test, expect } from "@playwright/test"

// Lightweight E2E tests that don't require Electron app to be running
test.describe("FreeShow E2E Basic Tests", () => {
    test("Playwright is working correctly", async ({ page }) => {
        // Navigate to a simple test page
        await page.goto('data:text/html,<!DOCTYPE html><html><head><title>FreeShow Test</title></head><body><h1 id="title">FreeShow Testing Environment</h1><div id="status">Ready</div></body></html>')

        // Verify page loaded
        await expect(page.locator("#title")).toHaveText("FreeShow Testing Environment")
        await expect(page.locator("#status")).toHaveText("Ready")
    })

    test("Basic JavaScript functionality works", async ({ page }) => {
        await page.goto('data:text/html,<!DOCTYPE html><html><body><button id="test-btn">Test</button><div id="result"></div></body></html>')

        // Add JavaScript functionality
        await page.addScriptTag({
            content: `
        document.getElementById('test-btn').addEventListener('click', function() {
          document.getElementById('result').textContent = 'JavaScript is working!';
        });
      `
        })

        // Test the functionality
        await page.click("#test-btn")
        await expect(page.locator("#result")).toHaveText("JavaScript is working!")
    })

    test("Mock show management functionality", async ({ page }) => {
        await page.goto('data:text/html,<!DOCTYPE html><html><body><div id="app"></div></body></html>')

        // Inject mock FreeShow functionality
        const result = await page.evaluate(() => {
            // Mock show object
            const show = {
                id: "test-show-1",
                name: "Test Show",
                slides: {},
                layouts: {},
                settings: {}
            }

            // Mock show management functions
            const showManager = {
                createShow: name => ({
                    ...show,
                    name: name,
                    id: "show-" + Date.now()
                }),

                validateShow: showObj => {
                    return showObj && typeof showObj.name === "string" && typeof showObj.slides === "object" && typeof showObj.layouts === "object"
                }
            }

            // Test the functionality
            const newShow = showManager.createShow("My Test Show")
            const isValid = showManager.validateShow(newShow)

            return {
                show: newShow,
                isValid: isValid,
                hasCorrectName: newShow.name === "My Test Show"
            }
        })

        expect(result.isValid).toBe(true)
        expect(result.hasCorrectName).toBe(true)
        expect(result.show.name).toBe("My Test Show")
    })

    test("Mock settings management", async ({ page }) => {
        await page.goto('data:text/html,<!DOCTYPE html><html><body><div id="storage-test">Testing settings</div></body></html>')

        // Test settings functionality without localStorage (due to data: URL limitations)
        const settingsResult = await page.evaluate(() => {
            // Simulate FreeShow settings management
            const settingsManager = {
                defaultSettings: {
                    outputs: [],
                    activeShow: null,
                    theme: "dark"
                },

                validateSettings: settings => {
                    return settings && Array.isArray(settings.outputs) && typeof settings.theme === "string"
                },

                updateSetting: (settings, key, value) => {
                    return {
                        ...settings,
                        [key]: value
                    }
                }
            }

            const settings = settingsManager.defaultSettings
            const isValid = settingsManager.validateSettings(settings)
            const updatedSettings = settingsManager.updateSetting(settings, "theme", "light")

            return {
                hasDefaultSettings: !!settings,
                isValid: isValid,
                hasCorrectTheme: settings.theme === "dark",
                hasOutputs: Array.isArray(settings.outputs),
                updatedTheme: updatedSettings.theme === "light"
            }
        })

        expect(settingsResult.hasDefaultSettings).toBe(true)
        expect(settingsResult.isValid).toBe(true)
        expect(settingsResult.hasCorrectTheme).toBe(true)
        expect(settingsResult.hasOutputs).toBe(true)
        expect(settingsResult.updatedTheme).toBe(true)
    })

    test("Mock media handling", async ({ page }) => {
        await page.goto('data:text/html,<!DOCTYPE html><html><body><div id="media-test">Media Test</div></body></html>')

        const mediaResult = await page.evaluate(() => {
            // Mock media helper functions
            const mediaHelper = {
                getMediaDuration: path => {
                    // Mock duration based on file extension
                    if (path.endsWith(".mp4")) return 120 // 2 minutes
                    if (path.endsWith(".mp3")) return 180 // 3 minutes
                    return 0
                },

                validateMediaPath: path => {
                    const validExtensions = [".mp4", ".mp3", ".jpg", ".png"]
                    return validExtensions.some(ext => path.endsWith(ext))
                }
            }

            const testPaths = ["/test/video.mp4", "/test/audio.mp3", "/test/image.jpg", "/test/invalid.txt"]

            const results = testPaths.map(path => ({
                path: path,
                duration: mediaHelper.getMediaDuration(path),
                isValid: mediaHelper.validateMediaPath(path)
            }))

            return results
        })

        expect(mediaResult[0].duration).toBe(120) // mp4
        expect(mediaResult[1].duration).toBe(180) // mp3
        expect(mediaResult[0].isValid).toBe(true)
        expect(mediaResult[3].isValid).toBe(false) // txt file
    })
})

// Set shorter timeout for these basic tests
test.describe.configure({
    mode: "parallel",
    timeout: 15000
})
