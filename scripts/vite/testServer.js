const { spawn } = require("child_process")
const path = require("path")
const fs = require("fs")

// Test building one server at a time
const serverToTest = process.argv[2] || "remote"
console.log(`Testing Vite build for ${serverToTest} server...`)

const viteConfig = "config/building/vite.config.servers.mjs"

// Clean build directory first
const buildDir = path.join(__dirname, "..", "..", "build", "electron", serverToTest)
if (fs.existsSync(buildDir)) {
    console.log("Cleaning existing build directory...")
    fs.rmSync(buildDir, { recursive: true, force: true })
}

// Build server
const buildProcess = spawn("npx", ["vite", "build", "--config", viteConfig], {
    stdio: "inherit",
    shell: true,
    cwd: path.join(__dirname, "..", ".."),
    env: {
        ...process.env,
        NODE_ENV: "development",
        VITE_SERVER_ID: serverToTest
    }
})

buildProcess.on("close", code => {
    if (code !== 0) {
        console.error("Build failed with code:", code)
        process.exit(code)
    }

    console.log("\nBuild completed! Checking output files...\n")

    // Check if files were created
    const serverDir = path.join(__dirname, "..", "..", "build", "electron", serverToTest)
    const clientFile = path.join(serverDir, "client.js")
    const stylesFile = path.join(serverDir, "styles.css")
    const indexFile = path.join(serverDir, "index.html")

    console.log(`${serverToTest}:`)
    console.log(`  Directory exists: ${fs.existsSync(serverDir)}`)
    console.log(`  client.js exists: ${fs.existsSync(clientFile)}`)
    console.log(`  styles.css exists: ${fs.existsSync(stylesFile)}`)
    console.log(`  index.html exists: ${fs.existsSync(indexFile)}`)

    if (fs.existsSync(clientFile)) {
        const stats = fs.statSync(clientFile)
        console.log(`  client.js size: ${(stats.size / 1024).toFixed(2)} KB`)
    }

    if (fs.existsSync(stylesFile)) {
        const stats = fs.statSync(stylesFile)
        console.log(`  styles.css size: ${(stats.size / 1024).toFixed(2)} KB`)
    }
})

buildProcess.on("error", err => {
    console.error("Failed to start build process:", err)
    process.exit(1)
})
