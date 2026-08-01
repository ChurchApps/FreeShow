import { defineConfig } from "@playwright/test"

export default defineConfig({
    // Only the Electron e2e specs live next to this config; keep discovery scoped to them.
    testDir: ".",
    testMatch: "**/*.test.ts",

    // Electron cold-boot on a CI runner (build the window, start the bundled servers,
    // init output/NDI/etc.) plus the full scripted flow easily exceeds Playwright's
    // 30s default per-test timeout — that was the main "timing out" failure on CI.
    // Give the whole test room, and each web-first assertion a sane individual budget.
    timeout: 120_000,
    expect: { timeout: 15_000 },

    // A single Electron instance at a time — the app binds ports (bundled servers) and
    // writes to a shared store, so parallel workers would collide.
    fullyParallel: false,
    workers: 1,

    // CI machines are slower and occasionally jittery; a couple of retries turns a
    // transient boot hiccup into a pass instead of a red build. No retries locally so
    // real flakiness is visible while developing.
    retries: process.env.CI ? 2 : 0,

    // HTML report (with traces/screenshots) on CI for post-mortem; concise line output locally.
    reporter: [[process.env.CI ? "html" : "line", { outputFolder: "test-output/playwright-report" }]],

    use: {
        // Capture a trace and screenshot on the first retry so CI failures are debuggable.
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },
})
