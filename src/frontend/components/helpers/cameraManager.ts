// Camera management helper for keeping cameras active
import { get } from "svelte/store"
import { special } from "../../stores"

interface ActiveCamera {
    id: string
    name: string
    groupId: string
    stream: MediaStream | null
    videoElement: HTMLVideoElement | null
    retryCount: number
    lastError: string | null
}

class CameraManager {
    private activeCameras: Map<string, ActiveCamera> = new Map()
    private readonly MAX_RETRIES = 3
    private readonly RETRY_DELAY = 5000 // 5 seconds

    // Initialize camera warming if enabled
    async initializeCameraWarming() {
        const keepWarm = get(special).keepCamerasWarm
        if (!keepWarm) return

        console.info("Camera warming enabled - initializing cameras...")
        const cameras = await this.getAvailableCameras()
        
        for (const camera of cameras) {
            await this.warmUpCamera(camera)
        }

        // Start the keepalive monitor
        this.startKeepaliveMonitor()
    }

    // Get available cameras
    private async getAvailableCameras(): Promise<Array<{id: string, name: string, groupId: string}>> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            return devices
                .filter(device => device.kind === 'videoinput')
                .map(device => ({
                    id: device.deviceId,
                    name: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
                    groupId: device.groupId
                }))
        } catch (error) {
            console.error("Failed to enumerate camera devices:", error)
            return []
        }
    }

    // Warm up a specific camera
    private async warmUpCamera(camera: {id: string, name: string, groupId: string}) {
        if (this.activeCameras.has(camera.id)) {
            console.info(`Camera ${camera.name} is already warmed up`)
            return
        }

        try {
            console.info(`Warming up camera: ${camera.name}`)
            
            const constraints = {
                video: {
                    deviceId: { exact: camera.id },
                    groupId: camera.groupId,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            }

            const stream = await navigator.mediaDevices.getUserMedia(constraints)
            
            // Create a hidden video element to keep the stream active
            const videoElement = document.createElement('video')
            videoElement.style.position = 'absolute'
            videoElement.style.opacity = '0'
            videoElement.style.pointerEvents = 'none'
            videoElement.style.zIndex = '-1'
            videoElement.style.width = '1px'
            videoElement.style.height = '1px'
            videoElement.muted = true
            videoElement.srcObject = stream
            
            // Add to DOM to keep it active but hidden
            document.body.appendChild(videoElement)
            
            // Start playing
            await videoElement.play()

            const activeCamera: ActiveCamera = {
                id: camera.id,
                name: camera.name,
                groupId: camera.groupId,
                stream,
                videoElement,
                retryCount: 0,
                lastError: null
            }

            this.activeCameras.set(camera.id, activeCamera)
            console.info(`Camera ${camera.name} warmed up successfully`)

            // Listen for stream end to retry
            stream.getTracks().forEach(track => {
                track.addEventListener('ended', () => {
                    console.warn(`Camera ${camera.name} stream ended, will retry...`)
                    this.retryCameraWarming(camera)
                })
            })

        } catch (error) {
            console.error(`Failed to warm up camera ${camera.name}:`, error)
            this.scheduleRetry(camera, error.message)
        }
    }

    // Retry camera warming with exponential backoff
    private scheduleRetry(camera: {id: string, name: string, groupId: string}, errorMessage: string) {
        const existingCamera = this.activeCameras.get(camera.id)
        const retryCount = existingCamera ? existingCamera.retryCount + 1 : 1

        if (retryCount > this.MAX_RETRIES) {
            console.error(`Max retries reached for camera ${camera.name}, giving up`)
            return
        }

        const delay = this.RETRY_DELAY * Math.pow(2, retryCount - 1) // Exponential backoff
        console.info(`Scheduling retry ${retryCount}/${this.MAX_RETRIES} for camera ${camera.name} in ${delay/1000}s`)

        setTimeout(() => {
            this.retryCameraWarming(camera, retryCount, errorMessage)
        }, delay)
    }

    // Retry warming a specific camera
    private async retryCameraWarming(camera: {id: string, name: string, groupId: string}, retryCount: number = 0, lastError: string = '') {
        // Clean up existing camera first
        this.cleanupCamera(camera.id)

        // Update retry info
        const activeCamera: ActiveCamera = {
            id: camera.id,
            name: camera.name,
            groupId: camera.groupId,
            stream: null,
            videoElement: null,
            retryCount,
            lastError
        }
        this.activeCameras.set(camera.id, activeCamera)

        // Try to warm up again
        await this.warmUpCamera(camera)
    }

    // Get a warmed camera stream (for faster activation)
    getWarmCamera(cameraId: string): MediaStream | null {
        const camera = this.activeCameras.get(cameraId)
        if (camera && camera.stream) {
            console.info(`Using warmed camera stream for ${camera.name}`)
            return camera.stream.clone() // Return a clone to avoid conflicts
        }
        return null
    }

    // Check if a camera is warmed up
    isCameraWarm(cameraId: string): boolean {
        const camera = this.activeCameras.get(cameraId)
        return !!(camera && camera.stream && camera.stream.active)
    }

    // Cleanup a specific camera
    private cleanupCamera(cameraId: string) {
        const camera = this.activeCameras.get(cameraId)
        if (!camera) return

        try {
            // Stop all tracks
            if (camera.stream) {
                camera.stream.getTracks().forEach(track => track.stop())
            }

            // Remove video element from DOM
            if (camera.videoElement && camera.videoElement.parentNode) {
                camera.videoElement.srcObject = null
                camera.videoElement.parentNode.removeChild(camera.videoElement)
            }
        } catch (error) {
            console.error(`Error cleaning up camera ${camera.name}:`, error)
        }

        this.activeCameras.delete(cameraId)
    }

    // Cleanup all cameras
    cleanupAllCameras() {
        console.info("Cleaning up all warmed cameras...")
        for (const cameraId of this.activeCameras.keys()) {
            this.cleanupCamera(cameraId)
        }
        this.activeCameras.clear()
    }

    // Get status of all cameras
    getCameraStatus() {
        const status: Array<{id: string, name: string, active: boolean, retryCount: number, lastError: string | null}> = []
        
        for (const camera of this.activeCameras.values()) {
            status.push({
                id: camera.id,
                name: camera.name,
                active: !!(camera.stream && camera.stream.active),
                retryCount: camera.retryCount,
                lastError: camera.lastError
            })
        }
        
        return status
    }

    // Enable/disable camera warming
    async toggleCameraWarming(enabled: boolean) {
        if (enabled) {
            await this.initializeCameraWarming()
        } else {
            this.cleanupAllCameras()
        }
    }

    // Refresh camera warming (useful when new cameras are connected)
    async refreshCameraWarming() {
        const keepWarm = get(special).keepCamerasWarm
        if (!keepWarm) return

        console.info("Refreshing camera warming...")
        this.cleanupAllCameras()
        await this.initializeCameraWarming()
    }

    // Keep camera streams alive by periodically checking and restarting them
    startKeepaliveMonitor() {
        setInterval(() => {
            this.checkAndRestartDeadCameras()
        }, 30000) // Check every 30 seconds
    }

    private async checkAndRestartDeadCameras() {
        const keepWarm = get(special).keepCamerasWarm
        if (!keepWarm) return

        for (const camera of this.activeCameras.values()) {
            if (!camera.stream || !camera.stream.active || camera.stream.getTracks().some(track => track.readyState === 'ended')) {
                console.warn(`Camera ${camera.name} stream is not active, restarting...`)
                await this.retryCameraWarming({ id: camera.id, name: camera.name, groupId: camera.groupId })
            }
        }
    }
}

// Create singleton instance
export const cameraManager = new CameraManager()

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    cameraManager.cleanupAllCameras()
})