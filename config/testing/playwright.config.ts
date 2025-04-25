import { defineConfig } from "@playwright/test"

export default defineConfig({
    // 'github' for GitHub Actions CI to generate annotations, plus a concise 'dot'
    // default 'line' when running locally
    reporter: [[process.env.CI ? "html" : "line", { outputFolder: "test-output/playwright-report" }]],
})
