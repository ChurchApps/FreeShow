const { spawn } = require("child_process")
const path = require("path")

// This script runs server builds in watch mode
console.log("Starting server watch mode...")

const servers = ["remote", "stage", "controller", "output_stream"]
const viteConfig = "config/building/vite.config.servers.mjs"
const processes = []

servers.forEach((server) => {
    console.log(`Starting watch for ${server}...`)

    const watchProcess = spawn("npx", ["vite", "build", "--config", viteConfig, "--watch"], {
        stdio: "inherit",
        shell: true,
        cwd: path.join(__dirname, "..", ".."),
        env: {
            ...process.env,
            NODE_ENV: "development",
            VITE_SERVER_ID: server
        }
    })

    watchProcess.on("error", (err) => {
        console.error(`Failed to watch ${server}:`, err)
    })

    processes.push(watchProcess)
})

// Handle cleanup
process.on("SIGINT", () => {
    console.log("\nShutting down server watches...")
    processes.forEach((p) => p.kill())
    process.exit(0)
})

process.on("SIGTERM", () => {
    processes.forEach((p) => p.kill())
    process.exit(0)
})
