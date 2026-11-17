import { defineConfig } from "@playwright/test"
export default defineConfig({ testDir: ".", testMatch: "editor-wrapped-lines.test.ts", workers: 1, use: { launchOptions: { executablePath: process.env.WRAPPED_LINES_CHROMIUM_PATH } } })
