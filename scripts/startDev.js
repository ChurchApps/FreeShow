#!/usr/bin/env node

// TEMP DEBUG: Development startup script with proper shutdown handling
const { spawn } = require('child_process')
const path = require('path')

console.log('[SHUTDOWN-DEBUG] startDev.js: Starting development processes')

const processes = []
let isShuttingDown = false

function startProcess(name, command, args, options = {}) {
    console.log(`[SHUTDOWN-DEBUG] startDev.js: Starting ${name}: ${command} ${args.join(' ')}`)
    
    const proc = spawn(command, args, {
        stdio: 'inherit',
        shell: true,
        ...options
    })
    
    proc.on('exit', (code, signal) => {
        console.log(`[SHUTDOWN-DEBUG] startDev.js: ${name} exited with code ${code}, signal ${signal}`)
        
        // If electron exits (not due to our shutdown), kill other processes
        if (name === 'electron' && !isShuttingDown) {
            console.log('[SHUTDOWN-DEBUG] startDev.js: Electron exited, shutting down other processes')
            shutdown()
        }
    })
    
    proc.on('error', (err) => {
        console.error(`[SHUTDOWN-DEBUG] startDev.js: ${name} error:`, err)
    })
    
    processes.push({ name, proc })
    return proc
}

function shutdown() {
    if (isShuttingDown) return
    isShuttingDown = true
    
    console.log('[SHUTDOWN-DEBUG] startDev.js: Shutting down all processes')
    
    processes.forEach(({ name, proc }) => {
        if (!proc.killed) {
            console.log(`[SHUTDOWN-DEBUG] startDev.js: Killing ${name} (PID: ${proc.pid})`)
            
            // Try graceful shutdown first
            proc.kill('SIGTERM')
            
            // Force kill after timeout
            setTimeout(() => {
                if (!proc.killed) {
                    console.log(`[SHUTDOWN-DEBUG] startDev.js: Force killing ${name}`)
                    proc.kill('SIGKILL')
                }
            }, 2000)
        }
    })
    
    // Exit this script after a delay
    setTimeout(() => {
        console.log('[SHUTDOWN-DEBUG] startDev.js: Exiting startup script')
        process.exit(0)
    }, 3000)
}

// Handle shutdown signals
process.on('SIGINT', () => {
    console.log('[SHUTDOWN-DEBUG] startDev.js: Received SIGINT')
    shutdown()
})

process.on('SIGTERM', () => {
    console.log('[SHUTDOWN-DEBUG] startDev.js: Received SIGTERM')
    shutdown()
})

process.on('exit', () => {
    console.log('[SHUTDOWN-DEBUG] startDev.js: Process exiting')
})

// Start the development processes
const rootDir = path.resolve(__dirname, '..')

// Build servers once at startup (not in watch mode to avoid conflicts)
console.log('[SHUTDOWN-DEBUG] startDev.js: Building server files once at startup')
const buildServers = spawn('node', ['scripts/createServerFiles.js'], {
    stdio: 'inherit',
    shell: true,
    cwd: rootDir,
    env: { ...process.env, NODE_ENV: 'development' }
})

buildServers.on('exit', (code) => {
    if (code !== 0) {
        console.log('[SHUTDOWN-DEBUG] startDev.js: Server build failed, shutting down')
        shutdown()
        return
    }
    console.log('[SHUTDOWN-DEBUG] startDev.js: Server files built successfully')
})

// Start TypeScript compiler in watch mode
startProcess(
    'tsc-watch', 
    'npx',
    ['tsc', '-w', '--p', 'config/typescript/tsconfig.electron.json'],
    { cwd: rootDir }
)

// Give the build processes time to start
setTimeout(() => {
    // Build electron once, then run the post-build script, then start electron
    console.log('[SHUTDOWN-DEBUG] startDev.js: Starting electron build and run sequence')
    
    const buildElectron = spawn('npx', ['tsc', '--p', 'config/typescript/tsconfig.electron.json'], {
        stdio: 'inherit',
        shell: true,
        cwd: rootDir
    })
    
    buildElectron.on('exit', (code) => {
        if (code === 0) {
            console.log('[SHUTDOWN-DEBUG] startDev.js: Electron build complete, running post-build script')
            
            const postBuild = spawn('node', ['scripts/electronDevPostBuild.js'], {
                stdio: 'inherit',
                shell: true,
                cwd: rootDir
            })
            
            postBuild.on('exit', (code) => {
                if (code === 0) {
                    console.log('[SHUTDOWN-DEBUG] startDev.js: Post-build complete, starting electron')
                    
                    startProcess(
                        'electron',
                        'npx',
                        ['electron', '.'],
                        { cwd: rootDir }
                    )
                }
            })
        }
    })
}, 2000) // Give vite time to build initially

console.log('[SHUTDOWN-DEBUG] startDev.js: Setup complete, processes starting')