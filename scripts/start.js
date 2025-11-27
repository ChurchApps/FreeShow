const { spawn, execSync } = require("child_process")
const path = require("path")

// Set environment variables
process.env.NODE_ENV = "development"

console.log("Starting FreeShow development environment...")

// Kill any process on port 3000
try {
    execSync("npx kill-port 3000", { stdio: "pipe" })
    console.log("Cleared port 3000")
} catch (e) {
    // Port might not be in use, that's okay
}

// Run prestart script
const preBuild = spawn("node", ["scripts/preBuild.js"], {
    stdio: "inherit",
    shell: false,
    env: process.env
})

preBuild.on("close", code => {
    if (code !== 0) {
        console.error("Pre-build script failed")
        process.exit(code)
    }

    console.log("Pre-build complete, building server files...")

    // Build server files first
    const buildServers = spawn("node", ["scripts/vite/createServerFiles.js"], {
        stdio: "inherit",
        shell: false,
        env: { ...process.env, NODE_ENV: "development" }
    })

    buildServers.on("close", serverCode => {
        if (serverCode !== 0) {
            console.error("Server build failed")
            process.exit(serverCode)
        }

        console.log("Server files built, starting development servers...")

        // Start Vite
        const vite = spawn("npx", ["vite"], {
            stdio: "inherit",
            shell: true,
            env: process.env
        })

        // Start server watch mode
        const serverWatch = spawn("node", ["scripts/vite/watchServers.js"], {
            stdio: "inherit",
            shell: false,
            env: process.env
        })

        // Start Electron build and watch
        setTimeout(() => {
            console.log("Starting Electron...")
            const electron = spawn("npm", ["run", "start:electron"], {
                stdio: "inherit",
                shell: true,
                env: process.env
            })

            electron.on("error", err => {
                console.error("Failed to start Electron:", err)
            })
        }, 5000) // Give Vite more time to start

        vite.on("error", err => {
            console.error("Failed to start Vite:", err)
        })

        serverWatch.on("error", err => {
            console.error("Failed to start server watch:", err)
        })

        // Handle process termination
        process.on("SIGINT", () => {
            console.log("\nShutting down development servers...")
            vite.kill()
            serverWatch.kill()
            process.exit(0)
        })
    })
})
