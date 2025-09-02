import { defineConfig } from "@playwright/test"

export default defineConfig({
    // Test directory
    testDir: "../../tests/e2e",
    
    // Reporter configuration
    reporter: [
        [process.env.CI ? "html" : "line", { outputFolder: "test-output/playwright-report" }],
        ["json", { outputFile: "test-output/test-results.json" }]
    ],
    
    // Global test timeout
    timeout: 60000,
    
    // Expect timeout for assertions
    expect: {
        timeout: 10000
    },
    
    // Test configuration
    use: {
        // Take screenshot on failure
        screenshot: "only-on-failure",
        
        // Record video on failure
        video: "retain-on-failure",
        
        // Trace on failure
        trace: "retain-on-failure",
    },
    
    // Project configuration for different test types
    projects: [
        {
            name: "electron-main",
            testMatch: "**/*.test.ts",
            use: {
                // Electron-specific configuration
            }
        }
    ],
    
    // Output directory
    outputDir: "test-output/playwright-results",
    
    // Global setup and teardown
    globalSetup: undefined,
    globalTeardown: undefined,
    
    // Retry configuration
    retries: process.env.CI ? 2 : 1,
    
    // Parallel execution
    workers: process.env.CI ? 1 : 2,
})
