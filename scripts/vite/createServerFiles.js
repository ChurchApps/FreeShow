const { spawnSync } = require("child_process")
const path = require("path")

// This script ensures server files are built during the production build process
console.log("Building server files with Vite...")

const servers = ["remote", "stage", "controller", "output_stream"]
const viteConfig = "config/building/vite.config.servers.mjs"

// Build each server sequentially
let hasError = false

servers.forEach(server => {
    console.log(`\nBuilding ${server}...`)

    const result = spawnSync("npx", ["vite", "build", "--config", viteConfig], {
        stdio: "inherit",
        shell: true,
        cwd: path.join(__dirname, "..", ".."),
        env: {
            ...process.env,
            NODE_ENV: process.env.NODE_ENV || "production",
            VITE_SERVER_ID: server
        }
    })

    if (result.status !== 0) {
        console.error(`Failed to build ${server}`)
        hasError = true
    } else {
        console.log(`${server} built successfully!`)
    }
})

if (hasError) {
    console.error("\nSome servers failed to build")
    process.exit(1)
} else {
    console.log("\nAll servers built successfully!")
}
