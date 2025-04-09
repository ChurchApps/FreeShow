import { BrowserWindow } from "electron"
import { BlackmagicSender } from "./BlackmagicSender"

// Performance monitoring class for Blackmagic devices
export class BlackmagicMonitor {
    private static instance: BlackmagicMonitor
    private metrics: {
        [deviceId: string]: {
            framesTotal: number
            framesDropped: number
            bufferStatus: number[]  // last 10 readings
            frameRateHistory: number[]  // last 10 readings
            lastCheckTime: number
            driftHistory: number[]  // last 10 readings
        }
    } = {}
    
    private monitorInterval: NodeJS.Timeout | null = null
    private metricsWindow: BrowserWindow | null = null
    
    // Singleton pattern for monitor
    public static getInstance(): BlackmagicMonitor {
        if (!BlackmagicMonitor.instance) {
            BlackmagicMonitor.instance = new BlackmagicMonitor()
        }
        return BlackmagicMonitor.instance
    }
    
    // Start monitoring all active Blackmagic devices
    public startMonitoring() {
        if (this.monitorInterval) {
            return // Already monitoring
        }
        
        console.log("Starting Blackmagic performance monitoring")
        
        // Monitor every 5 seconds
        this.monitorInterval = setInterval(() => {
            this.collectMetrics()
        }, 5000)
    }
    
    // Stop monitoring
    public stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval)
            this.monitorInterval = null
            console.log("Blackmagic performance monitoring stopped")
        }
        
        if (this.metricsWindow) {
            this.metricsWindow.close()
            this.metricsWindow = null
        }
    }
    
    // Show metrics in a dedicated window
    public showMetricsWindow(parentWindow: BrowserWindow) {
        if (this.metricsWindow) {
            this.metricsWindow.focus()
            return
        }
        
        this.metricsWindow = new BrowserWindow({
            width: 600,
            height: 400,
            parent: parentWindow,
            title: "Blackmagic Performance Monitor",
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        })
        
        // Update window content with latest metrics
        this.updateMetricsWindow()
        
        // Update window periodically
        const updateInterval = setInterval(() => {
            if (this.metricsWindow) {
                this.updateMetricsWindow()
            } else {
                clearInterval(updateInterval)
            }
        }, 1000)
        
        // Clean up on close
        this.metricsWindow.on('closed', () => {
            this.metricsWindow = null
        })
    }
    
    // Reset metrics for a specific device or all devices
    public resetMetrics(deviceId?: string) {
        if (deviceId && this.metrics[deviceId]) {
            this.metrics[deviceId] = this.createInitialMetrics()
            console.log(`Metrics reset for device ${deviceId}`)
        } else if (!deviceId) {
            this.metrics = {}
            console.log("All metrics reset")
        }
    }
    
    // Create initial metrics structure
    private createInitialMetrics() {
        return {
            framesTotal: 0,
            framesDropped: 0,
            bufferStatus: [],
            frameRateHistory: [],
            lastCheckTime: Date.now(),
            driftHistory: []
        }
    }
    
    // Collect metrics from all active Blackmagic devices
    private collectMetrics() {
        const playbackData = BlackmagicSender["playbackData"]
        
        for (const [deviceId, data] of Object.entries(playbackData)) {
            // Initialize metrics if needed
            if (!this.metrics[deviceId]) {
                this.metrics[deviceId] = this.createInitialMetrics()
            }
            
            const metrics = this.metrics[deviceId]
            const now = Date.now()
            const timeDelta = (now - metrics.lastCheckTime) / 1000 // seconds
            
            try {
                // Get buffer status
                const bufferedFrames = data.playback.bufferedFrames()
                metrics.bufferStatus.push(bufferedFrames)
                if (metrics.bufferStatus.length > 10) metrics.bufferStatus.shift() // Keep last 10
                
                // Get hardware time and scheduled time for drift calculation
                const hwTime = data.playback.hardwareTime()
                const scheduledTime = data.playback.scheduledTime()
                
                if (hwTime && scheduledTime) {
                    const drift = Math.abs(hwTime.hardwareTime - scheduledTime.streamTime)
                    metrics.driftHistory.push(drift)
                    if (metrics.driftHistory.length > 10) metrics.driftHistory.shift() // Keep last 10
                }
                
                // Calculate frame rate based on total scheduled frames
                if (metrics.framesTotal > 0) {
                    const framesDelta = data.scheduledFrames - metrics.framesTotal
                    const frameRate = framesDelta / timeDelta
                    
                    metrics.frameRateHistory.push(frameRate)
                    if (metrics.frameRateHistory.length > 10) metrics.frameRateHistory.shift() // Keep last 10
                }
                
                // Update totals
                metrics.framesTotal = data.scheduledFrames
                metrics.framesDropped = data.totalFramesDropped || 0
                metrics.lastCheckTime = now
                
                // Log summary if there are issues
                const avgBuffer = metrics.bufferStatus.reduce((a, b) => a + b, 0) / metrics.bufferStatus.length
                const avgDrift = metrics.driftHistory.reduce((a, b) => a + b, 0) / metrics.driftHistory.length
                
                if (avgBuffer < 5 || avgDrift > 2000) {
                    console.log(`Device ${deviceId} status - Buffer: ${avgBuffer.toFixed(1)} frames, Drift: ${avgDrift.toFixed(0)} units`)
                }
                
            } catch (err) {
                console.error(`Error collecting metrics for device ${deviceId}: ${err.message}`)
            }
        }
        
        // Update metrics window if open
        if (this.metricsWindow) {
            this.updateMetricsWindow()
        }
    }
    
    // Update metrics window content
    private updateMetricsWindow() {
        if (!this.metricsWindow) return
        
        // Generate HTML content with metrics
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: sans-serif; margin: 20px; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
                .warning { color: orange; }
                .error { color: red; }
            </style>
        </head>
        <body>
            <h2>Blackmagic Performance Monitor</h2>
        `
        
        // No active devices
        if (Object.keys(this.metrics).length === 0) {
            html += '<p>No active Blackmagic devices.</p>'
        } else {
            html += `
            <table>
                <tr>
                    <th>Device ID</th>
                    <th>Frames Total</th>
                    <th>Frames Dropped</th>
                    <th>Buffer Status</th>
                    <th>Frame Rate</th>
                    <th>Drift</th>
                    <th>Status</th>
                </tr>
            `
            
            for (const [deviceId, metrics] of Object.entries(this.metrics)) {
                const avgBuffer = metrics.bufferStatus.length ? 
                    metrics.bufferStatus.reduce((a, b) => a + b, 0) / metrics.bufferStatus.length : 0
                    
                const avgFrameRate = metrics.frameRateHistory.length ? 
                    metrics.frameRateHistory.reduce((a, b) => a + b, 0) / metrics.frameRateHistory.length : 0
                    
                const avgDrift = metrics.driftHistory.length ? 
                    metrics.driftHistory.reduce((a, b) => a + b, 0) / metrics.driftHistory.length : 0
                
                // Determine status based on metrics
                let status = 'OK'
                let statusClass = ''
                
                if (avgBuffer < 5 || avgDrift > 2000) {
                    status = 'Warning'
                    statusClass = 'warning'
                }
                
                if (avgBuffer < 2 || avgDrift > 5000) {
                    status = 'Critical'
                    statusClass = 'error'
                }
                
                html += `
                <tr>
                    <td>${deviceId}</td>
                    <td>${metrics.framesTotal}</td>
                    <td>${metrics.framesDropped}</td>
                    <td>${avgBuffer.toFixed(1)} frames</td>
                    <td>${avgFrameRate.toFixed(1)} fps</td>
                    <td>${avgDrift.toFixed(0)} units</td>
                    <td class="${statusClass}">${status}</td>
                </tr>
                `
            }
            
            html += '</table>'
        }
        
        html += `
            <div style="margin-top: 20px">
                <button onclick="window.electronAPI.resetMetrics()">Reset All Metrics</button>
            </div>
            <script>
                // Auto-refresh every 5 seconds
                setTimeout(() => location.reload(), 5000);
            </script>
        </body>
        </html>
        `
        
        this.metricsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    }
}

// Export singleton instance
export default BlackmagicMonitor.getInstance()