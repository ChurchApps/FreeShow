// Camera management helper for keeping cameras active
import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { sendMain } from "../IPC/main"
import { special } from "../stores"

export interface CameraData {
    name: string
    id: string
    group: string
}

interface StreamEntry {
    stream: MediaStream
    refCount: number
    isStartup?: boolean
}

const HALF_MINUTE = 30000

// https://stackoverflow.com/questions/33761770/what-constraints-should-i-pass-to-getusermedia-in-order-to-get-two-video-media
// https://blog.addpipe.com/getusermedia-video-constraints/
const DEFAULT_CAMERA_CONSTRAINTS: MediaTrackConstraints = {
    // deviceId: { exact: "" },
    // groupId: "",
    width: { ideal: 1920 }, // 1280
    height: { ideal: 1080 } // 720
    // aspectRatio: 1.777777778,
    // frameRate: { ideal: 30, max: 60 },
    // facingMode: { exact: "user" }
}

class CameraManager {
    private streams: Map<string, StreamEntry> = new Map()
    private inFlight: Map<string, Promise<MediaStream | string>> = new Map()
    private queue: Promise<any> = Promise.resolve()
    private keepaliveTimer: NodeJS.Timeout | null = null
    private deviceCache = { list: [] as CameraData[], timestamp: 0 }

    // --- Device Enumeration ---

    async getCamerasList(): Promise<CameraData[]> {
        if (this.deviceCache.timestamp && this.deviceCache.timestamp > Date.now() - HALF_MINUTE) {
            return this.deviceCache.list
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices()
            const cameraList = devices
                .filter((device) => device.kind === "videoinput")
                .map((device) => ({
                    name: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
                    id: device.deviceId,
                    group: device.groupId
                }))

            this.deviceCache = { list: cameraList, timestamp: Date.now() }
            return cameraList
        } catch (error) {
            console.error("Failed to enumerate camera devices:", error)
            this.deviceCache = { list: [], timestamp: Date.now() }
            return []
        }
    }

    private async getCameraFromId(cameraId: string): Promise<CameraData | undefined> {
        const allCameras = await this.getCamerasList()
        return allCameras.find((a) => a.id === cameraId)
    }

    // --- Stream Acquisition & Pooling ---

    private acquireMediaStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
        return new Promise((resolve, reject) => {
            this.queue = this.queue
                .catch(() => {})
                .then(async () => {
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia(constraints)
                        resolve(stream)
                    } catch (err) {
                        reject(err)
                    }
                })
        })
    }

    async getCameraStream(cameraId: string, groupId?: string): Promise<MediaStream | string> {
        // Return existing active pooled stream if valid
        const existing = this.streams.get(cameraId)
        if (existing?.stream?.active && existing.stream.getTracks().some((t) => t.readyState === "live")) {
            existing.refCount++
            this.clearBadCamera(cameraId)
            return existing.stream
        } else if (existing) {
            this.streams.delete(cameraId)
        }

        // Deduplicate in-flight requests for the same device
        if (this.inFlight.has(cameraId)) {
            const result = await this.inFlight.get(cameraId)!
            if (typeof result !== "string" && this.streams.has(cameraId)) {
                this.streams.get(cameraId)!.refCount++
            }
            return result
        }

        const cameraProperties = {
            video: {
                ...DEFAULT_CAMERA_CONSTRAINTS,
                deviceId: { exact: cameraId },
                groupId: groupId || (await this.getCameraFromId(cameraId))?.group
            }
        }

        const pendingPromise = (async () => {
            try {
                const stream = await this.acquireMediaStream(cameraProperties)
                this.clearBadCamera(cameraId)

                stream.getTracks().forEach((track) => {
                    track.addEventListener("ended", () => {
                        this.streams.delete(cameraId)
                    })
                })

                this.streams.set(cameraId, { stream, refCount: 1 })
                return stream
            } catch (err: any) {
                let msg: string = err?.message || String(err)

                if (err?.name === "NotReadableError") {
                    msg += "<br />Maybe it's in use by another program."
                    sendMain(Main.ACCESS_CAMERA_PERMISSION)
                }

                const error = err?.name + ":<br />" + msg
                if (/timeout/i.test(error)) this.markBadCamera(cameraId)
                return error
            } finally {
                this.inFlight.delete(cameraId)
            }
        })()

        this.inFlight.set(cameraId, pendingPromise)
        return await pendingPromise
    }

    // --- Component Lifecycle & Attachment API ---

    play(videoElement: HTMLVideoElement | null | undefined): void {
        if (!videoElement) return
        videoElement.play()?.catch(() => {})
    }

    pause(videoElement: HTMLVideoElement | null | undefined): void {
        if (!videoElement) return
        try {
            videoElement.pause()
        } catch {}
    }

    setupPreview(videoElement: HTMLVideoElement | null | undefined, isHovered?: () => boolean, isDestroyed?: () => boolean): void {
        if (!videoElement) return

        let paused = false
        const pauseVideo = (delay = 200) => {
            setTimeout(() => {
                if (paused || isDestroyed?.() || !videoElement) return
                paused = true
                if (!isHovered?.()) this.pause(videoElement)
            }, delay)
        }

        if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
            ;(videoElement as any).requestVideoFrameCallback(() => pauseVideo(200))
        } else {
            videoElement.addEventListener("loadeddata", () => pauseVideo(200), { once: true })
        }

        setTimeout(() => pauseVideo(0), 1200)
    }

    async attachCamera(
        videoElement: HTMLVideoElement | null | undefined,
        cameraId: string,
        options?: {
            groupId?: string
            preview?: boolean
            isHovered?: () => boolean
            isDestroyed?: () => boolean
            onLoaded?: () => void
        }
    ): Promise<MediaStream | string> {
        if (!videoElement) return "Video element not available"

        const cameraStream = await this.getCameraStream(cameraId, options?.groupId)
        if (options?.isDestroyed?.()) {
            if (typeof cameraStream !== "string") this.stopTracks(cameraStream, cameraId)
            return "Component destroyed"
        }

        if (typeof cameraStream === "string") {
            return cameraStream
        }

        videoElement.srcObject = cameraStream
        this.play(videoElement)

        if (options?.onLoaded) {
            if (videoElement.readyState >= 1) {
                options.onLoaded()
            } else {
                videoElement.addEventListener("loadedmetadata", () => options.onLoaded?.(), { once: true })
            }
        }

        if (options?.preview) {
            this.setupPreview(videoElement, options?.isHovered, options?.isDestroyed)
        }

        return cameraStream
    }

    detachCamera(videoElement: HTMLVideoElement | null | undefined, cameraId?: string): void {
        if (!videoElement) return
        this.stopTracks(videoElement.srcObject as MediaStream, cameraId)
        videoElement.srcObject = null
    }

    // --- Cleanup & Teardown ---

    stopTracks(cameraStream: MediaStream | null | undefined, cameraId?: string): void {
        if (!cameraStream) return

        if (cameraId && this.streams.has(cameraId)) {
            const entry = this.streams.get(cameraId)!
            entry.refCount--
            if (entry.refCount <= 0 && !entry.isStartup) {
                this.streams.delete(cameraId)
                cameraStream.getTracks()?.forEach((track) => track.stop())
            }
            return
        }

        cameraStream.getTracks()?.forEach((track) => track.stop())
    }

    cleanupAllCameras(): void {
        for (const entry of this.streams.values()) {
            entry.stream.getTracks()?.forEach((track) => track.stop())
        }
        this.streams.clear()
        this.stopKeepaliveMonitor()
    }

    // --- Startup Cameras & Background Warming ---

    setStartupCameras(cameraIds: string[]): void {
        special.update((a) => {
            a.startupCameras = cameraIds
            return a
        })

        this.initializeCameraWarming()
    }

    getStartupCameras(): string[] {
        return get(special).startupCameras || []
    }

    private updateBadCameras(update: (cameraIds: string[]) => string[]): void {
        special.update((a) => {
            const badCameras = Array.isArray(a.cameraBad) ? a.cameraBad : []
            a.cameraBad = update(badCameras)
            return a
        })
    }

    markBadCamera(cameraId: string): void {
        if (!cameraId) return
        this.updateBadCameras((badCameras) => (badCameras.includes(cameraId) ? badCameras : [...badCameras, cameraId]))
    }

    clearBadCamera(cameraId: string): void {
        if (!cameraId) return
        this.updateBadCameras((badCameras) => badCameras.filter((id) => id !== cameraId))
    }

    async initializeCameraWarming(): Promise<void> {
        const allCameras = await this.getCamerasList()
        const selectedCameraIds = this.getStartupCameras()

        // Clean up removed startup cameras
        for (const [id, entry] of this.streams.entries()) {
            if (entry.isStartup && !selectedCameraIds.includes(id)) {
                entry.isStartup = false
                if (entry.refCount <= 0) {
                    this.streams.delete(id)
                    entry.stream.getTracks()?.forEach((t) => t.stop())
                }
            }
        }

        if (!selectedCameraIds.length) {
            this.stopKeepaliveMonitor()
            return
        }

        // Warm startup cameras
        for (const camera of allCameras.filter((c) => selectedCameraIds.includes(c.id))) {
            if (!this.streams.has(camera.id)) {
                const res = await this.getCameraStream(camera.id, camera.group)
                if (typeof res !== "string" && this.streams.has(camera.id)) {
                    this.streams.get(camera.id)!.isStartup = true
                }
            } else {
                this.streams.get(camera.id)!.isStartup = true
            }
        }

        this.startKeepaliveMonitor()
    }

    // --- Keepalive & Background Monitoring ---

    private startKeepaliveMonitor(): void {
        if (this.keepaliveTimer) return
        this.keepaliveTimer = setInterval(() => this.checkAndRestartDeadCameras(), HALF_MINUTE)
    }

    private stopKeepaliveMonitor(): void {
        if (!this.keepaliveTimer) return
        clearInterval(this.keepaliveTimer)
        this.keepaliveTimer = null
    }

    private async checkAndRestartDeadCameras(): Promise<void> {
        const startupIds = this.getStartupCameras()
        for (const id of startupIds) {
            const entry = this.streams.get(id)
            if (!entry || !entry.stream?.active || entry.stream.getTracks().some((t) => t.readyState === "ended")) {
                this.streams.delete(id)
                const camera = await this.getCameraFromId(id)
                if (camera) {
                    const res = await this.getCameraStream(camera.id, camera.group)
                    if (typeof res !== "string" && this.streams.has(id)) {
                        this.streams.get(id)!.isStartup = true
                    }
                }
            }
        }
    }
}

export const cameraManager = new CameraManager()

window.addEventListener("beforeunload", () => {
    cameraManager.cleanupAllCameras()
})
