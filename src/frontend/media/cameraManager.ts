// Camera management helper for keeping cameras active
import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { sendMain } from "../IPC/main"
import { special } from "../stores"

interface ActiveCamera {
    id: string
    name: string
    groupId: string
    stream: MediaStream | null
    videoElement: HTMLVideoElement | null
    retryCount: number
    lastError: string | null
}

export interface CameraData {
    name: string
    id: string
    group: string
}

const HALF_MINUTE = 30000

// https://stackoverflow.com/questions/33761770/what-constraints-should-i-pass-to-getusermedia-in-order-to-get-two-video-media
// https://blog.addpipe.com/getusermedia-video-constraints/
const DEFAULT_CAMERA_CONSTRAINTS: MediaTrackConstraints = {
    deviceId: { exact: "" },
    groupId: "",
    width: { ideal: 1920 }, // 1280
    height: { ideal: 1080 } // 720
    // aspectRatio: 1.777777778,
    // frameRate: { max: 30 },
    // facingMode: { exact: "user" }
}

class CameraManager {
    private activeCameras: Map<string, ActiveCamera> = new Map()
    private readonly MAX_RETRIES = 3
    private readonly RETRY_DELAY = 5000 // 5 seconds

    // set startup cameras for faster activation
    setStartupCameras(cameraIds: string[]) {
        special.update(a => {
            a.startupCameras = cameraIds
            return a
        })

        this.initializeCameraWarming()
    }

    getStartupCameras(): string[] {
        return get(special).startupCameras || []
    }

    private async getCameraFromId(cameraId: string) {
        const allCameras = await this.getCamerasList()
        return allCameras.find(a => a.id === cameraId)
    }

    async initializeCameraWarming() {
        const allCameras = await this.getCamerasList()
        const selectedCameraIds = this.getStartupCameras()

        // cleanup removed cameras
        for (const cameraId of this.activeCameras.keys()) {
            if (!selectedCameraIds.includes(cameraId)) this.cleanupCamera(cameraId)
        }

        if (!selectedCameraIds.length) return

        const camerasToWarm = allCameras.filter(camera => selectedCameraIds.includes(camera.id))
        for (const camera of camerasToWarm) {
            await this.warmUpCamera(camera)
        }

        this.startKeepaliveMonitor()
    }

    private lastCameraListUpdate = 0
    private storedCameraList: CameraData[] = []
    async getCamerasList(): Promise<CameraData[]> {
        // refresh if not recently updated
        if (this.lastCameraListUpdate && this.lastCameraListUpdate < Date.now() - HALF_MINUTE) {
            this.storedCameraList = []
            this.lastCameraListUpdate = 0
        }

        if (this.lastCameraListUpdate) return this.storedCameraList

        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const cameraList = devices
                .filter(device => device.kind === "videoinput")
                .map(device => ({
                    name: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
                    id: device.deviceId,
                    group: device.groupId
                }))

            this.storedCameraList = cameraList
            this.lastCameraListUpdate = Date.now()
            return cameraList
        } catch (error) {
            console.error("Failed to enumerate camera devices:", error)

            this.storedCameraList = []
            this.lastCameraListUpdate = Date.now()
            return []
        }
    }

    failed: string[] = []
    private async warmUpCamera(camera: CameraData, { retryCount, lastError }: any = {}) {
        if (this.activeCameras.has(camera.id)) return

        const activeCamera: ActiveCamera = { id: camera.id, name: camera.name, groupId: camera.group, stream: null, videoElement: null, retryCount: retryCount || 0, lastError: lastError || null }
        this.activeCameras.set(camera.id, activeCamera)

        try {
            console.info(`Warming up camera: ${camera.name}`)

            const cameraProperties = {
                video: {
                    ...DEFAULT_CAMERA_CONSTRAINTS,
                    deviceId: { exact: camera.id },
                    groupId: camera.group
                }
            }

            // const stream = await this.getCameraStream(camera.id, camera.group)
            const stream = await navigator.mediaDevices.getUserMedia(cameraProperties)

            // Create a hidden video element to keep the stream active
            const videoElement = document.createElement("video")
            videoElement.style.position = "absolute"
            videoElement.style.opacity = "0"
            videoElement.style.pointerEvents = "none"
            videoElement.style.zIndex = "-1"
            videoElement.style.width = "1px"
            videoElement.style.height = "1px"
            videoElement.muted = true
            videoElement.srcObject = stream
            document.body.appendChild(videoElement)

            await videoElement.play()

            if (!this.activeCameras.has(camera.id)) return

            activeCamera.stream = stream
            activeCamera.videoElement = videoElement
            this.activeCameras.set(camera.id, activeCamera)
            console.info(`Camera ${camera.name} started`)

            // Listen for stream end to retry
            stream.getTracks().forEach(track => {
                track.addEventListener("ended", () => {
                    console.warn(`Camera ${camera.name} stream ended, will retry...`)
                    this.retryCameraWarming(camera)
                })
            })

            const didFail = this.failed.indexOf(camera.id)
            if (didFail > -1) this.failed.splice(didFail, 1)
        } catch (error) {
            if (!this.failed.includes(camera.id)) this.failed.push(camera.id)

            console.error(`Failed to warm up camera ${camera.name}:`, error)
            this.scheduleRetry(camera, error.message)
        }
    }

    // Retry camera warming with exponential backoff
    private scheduleRetry(camera: CameraData, errorMessage: string) {
        if (!this.activeCameras.has(camera.id)) return

        const existingCamera = this.activeCameras.get(camera.id)
        const retryCount = existingCamera ? existingCamera.retryCount + 1 : 1

        if (retryCount > this.MAX_RETRIES) {
            console.error(`Max retries reached for camera ${camera.name}`)
            return
        }

        const delay = this.RETRY_DELAY * Math.pow(2, retryCount - 1) // Exponential backoff
        console.info(`Scheduling retry ${retryCount}/${this.MAX_RETRIES} for camera ${camera.name} in ${delay / 1000}s`)

        setTimeout(() => {
            this.retryCameraWarming(camera, retryCount, errorMessage)
        }, delay)
    }

    private async retryCameraWarming(camera: CameraData, retryCount = 0, lastError = "") {
        if (!this.activeCameras.has(camera.id)) return

        this.cleanupCamera(camera.id)
        await this.warmUpCamera(camera, { retryCount, lastError })
    }

    async getCameraStream(cameraId: string, groupId?: string) {
        // get existing "warmed" camera
        const warmStream = this.getWarmCamera(cameraId)
        if (warmStream) return warmStream

        groupId = groupId || (await this.getCameraFromId(cameraId))?.group
        const cameraProperties = {
            video: {
                ...DEFAULT_CAMERA_CONSTRAINTS,
                deviceId: { exact: cameraId },
                groupId
            }
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia(cameraProperties)
            return stream
        } catch (err) {
            let msg: string = err.message
            if (err.name === "NotReadableError") {
                msg += "<br />Maybe it's in use by another program."
                sendMain(Main.ACCESS_CAMERA_PERMISSION)
            }

            const error = err.name + ":<br />" + msg
            return error
        }
    }

    private getWarmCamera(cameraId: string): MediaStream | null {
        const camera = this.activeCameras.get(cameraId)
        if (!camera?.stream) return null

        // Return a clone to avoid conflicts
        return camera.stream.clone()
    }

    cleanupAllCameras() {
        for (const cameraId of this.activeCameras.keys()) {
            this.cleanupCamera(cameraId)
        }
        this.activeCameras.clear()
    }

    private cleanupCamera(cameraId: string) {
        const camera = this.activeCameras.get(cameraId)
        if (!camera) return

        try {
            this.stopTracks(camera.stream)

            // Remove video element from DOM
            if (camera.videoElement && camera.videoElement.parentNode) {
                camera.videoElement.srcObject = null
                camera.videoElement.parentNode.removeChild(camera.videoElement)
            }
        } catch (err) {
            console.error(`Error cleaning up camera ${camera.name}:`, err)
        }

        this.activeCameras.delete(cameraId)
    }

    stopTracks(cameraStream: MediaStream | null | undefined) {
        cameraStream?.getTracks()?.forEach(track => track.stop())
    }

    // Keep camera streams alive by periodically checking and restarting them
    private keepaliveInterval: NodeJS.Timeout | null = null
    private startKeepaliveMonitor() {
        if (this.keepaliveInterval) return
        this.keepaliveInterval = setInterval(() => this.checkAndRestartDeadCameras(), HALF_MINUTE)
    }

    private async checkAndRestartDeadCameras() {
        for (const camera of this.activeCameras.values()) {
            if (this.failed.includes(camera.id)) return

            if (!camera.stream || !camera.stream.active || camera.stream.getTracks().some(track => track.readyState === "ended")) {
                console.warn(`Camera ${camera.name} stream is not active, restarting...`)
                await this.retryCameraWarming({ id: camera.id, name: camera.name, group: camera.groupId })
            }
        }
    }
}

// Create singleton instance
export const cameraManager = new CameraManager()

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
    cameraManager.cleanupAllCameras()
})
