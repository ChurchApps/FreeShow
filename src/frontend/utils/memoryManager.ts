// Memory management utilities for FreeShow
import { get } from "svelte/store"
import { showsCache, cachedShowsData, textCache, playingAudio } from "../stores"
import { AudioPlayer } from "../audio/audioPlayer"
import { AudioAnalyserMerger } from "../audio/audioAnalyserMerger"
import { cleanupShowsCache } from "../components/helpers/setShow"
import { cleanupDebounceTimers } from "./listeners"

// Extend Performance interface for Chrome's memory API
declare global {
    interface Performance {
        memory?: {
            usedJSHeapSize: number
            totalJSHeapSize: number
            jsHeapSizeLimit: number
        }
    }
    interface Window {
        gc?: () => void
    }
}

class MemoryManager {
    private static instance: MemoryManager
    private cleanupInterval: NodeJS.Timeout | null = null
    private readonly CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
    private readonly PERFORMANCE_CHECK_INTERVAL = 30 * 1000 // 30 seconds
    private performanceCheckInterval: NodeJS.Timeout | null = null

    static getInstance(): MemoryManager {
        if (!MemoryManager.instance) {
            MemoryManager.instance = new MemoryManager()
        }
        return MemoryManager.instance
    }

    start() {
        if (this.cleanupInterval) return // Already started

        // Regular cleanup
        this.cleanupInterval = setInterval(() => {
            this.performCleanup()
        }, this.CLEANUP_INTERVAL)

        // Performance monitoring
        this.performanceCheckInterval = setInterval(() => {
            this.checkPerformance()
        }, this.PERFORMANCE_CHECK_INTERVAL)

        console.log("Memory manager started")
    }

    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
            this.cleanupInterval = null
        }
        
        if (this.performanceCheckInterval) {
            clearInterval(this.performanceCheckInterval)
            this.performanceCheckInterval = null
        }

        console.log("Memory manager stopped")
    }

    private performCleanup() {
        console.log("Performing memory cleanup...")

        // Clean up shows cache if it's too large
        const showsCacheSize = Object.keys(get(showsCache)).length
        if (showsCacheSize > 80) {
            cleanupShowsCache()
        }

        // Clean up audio duration cache
        AudioPlayer.performCacheCleanup()

        // Clean up debounce timers
        cleanupDebounceTimers()

        // Clean up audio analyser if no audio is playing
        const playingAudioCount = Object.keys(get(playingAudio)).length
        if (playingAudioCount === 0) {
            AudioAnalyserMerger.stop()
        }

        // Force garbage collection if available (development only)
        if (typeof window !== 'undefined' && 'gc' in window && typeof window.gc === 'function') {
            try {
                window.gc()
            } catch (e) {
                // Silently ignore if GC is not available
            }
        }

        console.log(`Memory cleanup completed. Shows cache size: ${showsCacheSize}`)
    }

    private checkPerformance() {
        // Monitor memory usage and trigger cleanup if needed
        if (typeof performance !== 'undefined' && performance.memory) {
            const memInfo = performance.memory
            const usedMB = memInfo.usedJSHeapSize / 1024 / 1024
            const totalMB = memInfo.totalJSHeapSize / 1024 / 1024
            
            // If memory usage is high, trigger cleanup
            const memoryUsagePercent = (usedMB / totalMB) * 100
            
            if (memoryUsagePercent > 80) {
                console.warn(`High memory usage detected: ${usedMB.toFixed(2)}MB (${memoryUsagePercent.toFixed(1)}%)`)
                this.performCleanup()
            }
        }
    }

    // Manual cleanup trigger
    forceCleanup() {
        this.performCleanup()
    }

    // Get memory stats
    getMemoryStats() {
        const stats = {
            showsCacheSize: Object.keys(get(showsCache)).length,
            cachedShowsDataSize: Object.keys(get(cachedShowsData)).length,
            textCacheSize: Object.keys(get(textCache)).length,
            playingAudioCount: Object.keys(get(playingAudio)).length
        }

        if (typeof performance !== 'undefined' && performance.memory) {
            const memInfo = performance.memory
            return {
                ...stats,
                memoryUsed: Math.round(memInfo.usedJSHeapSize / 1024 / 1024),
                memoryTotal: Math.round(memInfo.totalJSHeapSize / 1024 / 1024),
                memoryLimit: Math.round(memInfo.jsHeapSizeLimit / 1024 / 1024)
            }
        }

        return stats
    }
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance()

// Auto-start memory manager
if (typeof window !== 'undefined') {
    // Start after app initialization
    setTimeout(() => {
        memoryManager.start()
    }, 10000) // Wait 10 seconds after app start

    // Expose debugging functions to window object (development)
    if (process.env.NODE_ENV === 'development') {
        Object.assign(window, {
            memoryManager,
            getMemoryStats: () => memoryManager.getMemoryStats(),
            forceMemoryCleanup: () => memoryManager.forceCleanup(),
            cleanupDebounceTimers
        })
    }
}
