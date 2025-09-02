#!/usr/bin/env node

const { exec } = require("child_process")
const path = require("path")

// Set up test environment
process.env.NODE_ENV = "test"

// ANSI color codes
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m"
}

const runCommand = (command, description) => {
    return new Promise((resolve, reject) => {
        console.log(`\n🚀 ${description}...`)
        console.log(`Running: ${command}\n`)

        const child = exec(command, {
            cwd: path.resolve(__dirname, ".."),
            env: { ...process.env }
        })

        child.stdout.on("data", data => {
            process.stdout.write(data)
        })

        child.stderr.on("data", data => {
            process.stderr.write(data)
        })

        child.on("close", code => {
            if (code === 0) {
                console.log(`\n✅ ${description} completed successfully!`)
                resolve()
            } else {
                console.log(`\n❌ ${description} failed with exit code ${code}`)
                reject(new Error(`Command failed with exit code ${code}`))
            }
        })

        child.on("error", error => {
            console.log(`\n❌ Error executing ${description}: ${error.message}`)
            reject(error)
        })
    })
}

// Available test commands
const commands = {
    unit: () => runCommand("npm run test:unit", "Unit tests"),
    integration: () => runCommand("npm run test:integration", "Integration tests"),
    e2e: () => runCommand("npm run test:e2e", "End-to-end tests"),
    coverage: () => runCommand("npm run test:coverage", "Coverage report"),
    watch: () => runCommand("npm run test:watch", "Tests in watch mode"),
    all: async () => {
        await runCommand("npm run test:unit", "Unit tests")
        await runCommand("npm run test:integration", "Integration tests")
        await runCommand("npm run test:e2e", "End-to-end tests")
    }
}

// Parse command line arguments
const args = process.argv.slice(2)
const command = args[0]

if (!command || command === "--help" || command === "-h") {
    console.log(`
${colors.bright}${colors.blue}🧪 FreeShow Test Runner${colors.reset}

${colors.bright}Usage:${colors.reset} node scripts/runTests.js [command]

${colors.bright}Available commands:${colors.reset}
  ${colors.green}unit${colors.reset}         Run unit tests
  ${colors.green}integration${colors.reset}  Run integration tests  
  ${colors.green}e2e${colors.reset}          Run end-to-end tests
  ${colors.green}coverage${colors.reset}     Generate coverage report
  ${colors.green}watch${colors.reset}        Run tests in watch mode
  ${colors.green}all${colors.reset}          Run all tests sequentially
  
${colors.bright}Examples:${colors.reset}
  ${colors.cyan}node scripts/runTests.js unit${colors.reset}
  ${colors.cyan}node scripts/runTests.js coverage${colors.reset}
  ${colors.cyan}node scripts/runTests.js all${colors.reset}
`)
    process.exit(0)
}

// Execute the command
if (commands[command]) {
    commands[command]().catch(error => {
        console.error("❌ Test execution failed:", error.message)
        process.exit(1)
    })
} else {
    console.error(`❌ Unknown command: ${command}`)
    console.error('Run "node scripts/runTests.js --help" for available commands')
    process.exit(1)
}
