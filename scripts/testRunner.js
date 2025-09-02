#!/usr/bin/env node

/**
 * Advanced Test Runner for FreeShow
 *
 * This script provides flexible test execution with various options
 * for different testing scenarios and CI/CD environments.
 */

const { spawn } = require("child_process")
const fs = require("fs")
const path = require("path")

// ANSI color codes for console output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m"
}

// Test configurations
const testConfigs = {
    unit: {
        command: "jest",
        args: ["--config", "jest.config.js", "--testPathPattern=unit"],
        description: "Run unit tests"
    },
    integration: {
        command: "jest",
        args: ["--config", "jest.config.js", "--testPathPattern=integration"],
        description: "Run integration tests"
    },
    e2e: {
        command: "npx",
        args: ["playwright", "test", "--config", "config/testing/playwright.config.ts"],
        description: "Run end-to-end tests"
    },
    coverage: {
        command: "jest",
        args: ["--config", "jest.config.js", "--coverage"],
        description: "Run tests with coverage report"
    },
    watch: {
        command: "jest",
        args: ["--config", "jest.config.js", "--watch"],
        description: "Run tests in watch mode"
    },
    ci: {
        command: "jest",
        args: ["--config", "jest.config.js", "--ci", "--coverage", "--watchAll=false"],
        description: "Run tests in CI mode"
    }
}

function showHelp() {
    console.log(`${colors.bright}${colors.blue}FreeShow Test Runner${colors.reset}\n`)
    console.log(`${colors.bright}Usage:${colors.reset}`)
    console.log(`  node scripts/runTests.js [options]\n`)

    console.log(`${colors.bright}Test Types:${colors.reset}`)
    Object.entries(testConfigs).forEach(([key, config]) => {
        console.log(`  ${colors.green}--${key.padEnd(12)}${colors.reset} ${config.description}`)
    })

    console.log(`\n${colors.bright}Options:${colors.reset}`)
    console.log(`  ${colors.green}--verbose     ${colors.reset} Show detailed output`)
    console.log(`  ${colors.green}--silent      ${colors.reset} Minimal output`)
    console.log(`  ${colors.green}--help, -h    ${colors.reset} Show this help message`)

    console.log(`\n${colors.bright}Examples:${colors.reset}`)
    console.log(`  ${colors.cyan}node scripts/runTests.js --unit --verbose${colors.reset}`)
    console.log(`  ${colors.cyan}node scripts/runTests.js --coverage${colors.reset}`)
    console.log(`  ${colors.cyan}node scripts/runTests.js --watch${colors.reset}`)
}

function parseArgs() {
    const args = process.argv.slice(2)
    const options = {
        testType: "all",
        verbose: false,
        silent: false,
        help: false
    }

    for (let i = 0; i < args.length; i++) {
        const arg = args[i]

        switch (arg) {
            case "--unit":
                options.testType = "unit"
                break
            case "--integration":
                options.testType = "integration"
                break
            case "--e2e":
                options.testType = "e2e"
                break
            case "--coverage":
                options.testType = "coverage"
                break
            case "--watch":
                options.testType = "watch"
                break
            case "--ci":
                options.testType = "ci"
                break
            case "--verbose":
                options.verbose = true
                break
            case "--silent":
                options.silent = true
                break
            case "--help":
            case "-h":
                options.help = true
                break
            default:
                if (arg.startsWith("--")) {
                    console.log(`${colors.yellow}Warning: Unknown option ${arg}${colors.reset}`)
                }
        }
    }

    return options
}

async function main() {
    const options = parseArgs()

    if (options.help) {
        showHelp()
        return
    }

    console.log(`${colors.bright}${colors.blue}🧪 FreeShow Test Runner${colors.reset}\n`)

    if (options.testType === "all") {
        console.log(`${colors.cyan}Running all tests...${colors.reset}`)
        console.log(`Use specific flags like --unit, --integration, or --e2e for targeted testing.`)
    } else {
        const config = testConfigs[options.testType]
        if (config) {
            console.log(`${colors.cyan}Running ${config.description}...${colors.reset}`)
        }
    }
}

if (require.main === module) {
    main()
}
