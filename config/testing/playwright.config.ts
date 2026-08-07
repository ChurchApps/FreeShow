import { defineConfig } from "@playwright/test"

export default defineConfig({
    testDir: ".",
    testMatch: "**/*.test.ts",

    // Electron startup is slow, especially on CI.
    timeout: 120_000,
    expect: { timeout: 10_000 },

    // Run a single Electron instance to avoid port/store conflicts.
    fullyParallel: false,
    workers: 1,

    // Retry only on CI to reduce transient failures.
    retries: process.env.CI ? 2 : 0,

    // HTML report on CI, line reporter locally.
    reporter: [[process.env.CI ? "html" : "line", { outputFolder: "test-output/playwright-report" }]],

    use: {
        // Collect diagnostics for CI failures.
        trace: "on-first-retry",
        screenshot: "only-on-failure"
    }
})
