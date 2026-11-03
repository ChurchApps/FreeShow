import { defineConfig } from "@playwright/test"

export default defineConfig({
    testDir: ".",
    testMatch: "outputs.test.ts",
    workers: 1,
    reporter: [["line"]]
})
