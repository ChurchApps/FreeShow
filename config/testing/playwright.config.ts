import { defineConfig } from "@playwright/test"

export default defineConfig({
    // the single E2E walks the whole app with several built-in delays; give it headroom
    timeout: 90_000,
    // 'github' for GitHub Actions CI to generate annotations, plus a concise 'dot'
    // default 'line' when running locally
    reporter: [[process.env.CI ? "html" : "line", { outputFolder: "test-output/playwright-report" }]],
})
