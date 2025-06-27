#!/usr/bin/env node

/**
 * Build orchestration script for Vite multi-target builds
 * Builds all targets in parallel for optimal performance
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { platform } from 'node:os'

const targets = ['frontend', 'remote', 'stage', 'controller', 'output_stream']

const production = process.env.NODE_ENV === 'production'
const buildMode = production ? 'production' : 'development'

console.log(`🚀 Building all targets in ${buildMode} mode...`)
console.log(`📦 Targets: ${targets.join(', ')}`)

// Ensure build directories exist
const buildDirs = [
    'public/build-vite',
    'build/electron/remote', 
    'build/electron/stage',
    'build/electron/controller',
    'build/electron/output_stream'
]

buildDirs.forEach(dir => {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
        console.log(`📁 Created directory: ${dir}`)
    }
})

// Build all targets in parallel
const buildPromises = targets.map(target => buildTarget(target))

Promise.all(buildPromises)
    .then(results => {
        console.log('✅ All targets built successfully!')
        
        // Show summary
        results.forEach(({ target, duration, size }) => {
            console.log(`   ${target}: ${duration}ms`)
        })
        
        const totalTime = Math.max(...results.map(r => r.duration))
        console.log(`🎉 Total time: ${totalTime}ms`)
    })
    .catch(error => {
        console.error('❌ Build failed:', error.message)
        process.exit(1)
    })

function buildTarget(target) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now()
        
        console.log(`📦 Building ${target}...`)
        
        const env = {
            ...process.env,
            BUILD_TARGET: target,
            NODE_ENV: process.env.NODE_ENV || 'development'
        }
        
        // Use proper command for Windows
        const isWindows = platform() === 'win32'
        const npmCmd = isWindows ? 'npm.cmd' : 'npm'
        
        const viteProcess = spawn(npmCmd, ['run', `build:vite:${target}`], {
            stdio: ['inherit', 'pipe', 'pipe'],
            env,
            shell: isWindows
        })
        
        let output = ''
        let errorOutput = ''
        
        viteProcess.stdout.on('data', (data) => {
            output += data.toString()
        })
        
        viteProcess.stderr.on('data', (data) => {
            errorOutput += data.toString()
        })
        
        viteProcess.on('close', (code) => {
            const duration = Date.now() - startTime
            
            if (code === 0) {
                console.log(`✅ ${target} built successfully (${duration}ms)`)
                
                // Extract bundle size from output if available
                const sizeMatch = output.match(/(\\d+\\.\\d+)\\s?(kB|MB)/i)
                const size = sizeMatch ? sizeMatch[0] : 'unknown'
                
                resolve({ target, duration, size })
            } else {
                console.error(`❌ ${target} build failed:`)
                console.error(errorOutput)
                reject(new Error(`Build failed for target: ${target}`))
            }
        })
        
        viteProcess.on('error', (error) => {
            reject(new Error(`Failed to start build for ${target}: ${error.message}`))
        })
    })
}