import { BlackmagicSender } from "./BlackmagicSender"
import { getBmdDisplayModes, getBmdPixelFormats } from "./bmdFormats"
import { getMacadam } from "./macadamLoader"
import type { DeviceConfig, DeviceData } from "./TypeData"

function safeMacadamCall<T>(fallback: T, fn: (m: NonNullable<ReturnType<typeof getMacadam>>) => T): T {
    const m = getMacadam()
    if (!m) return fallback

    try {
        return fn(m)
    } catch (err) {
        console.warn(`Blackmagic error: ${err instanceof Error ? err.message : String(err)}`)
        return fallback
    }
}

/**
 * Manages Blackmagic Design device discovery, configuration, and state
 */
export class BlackmagicManager {
    static getFirstDeviceName(): string | undefined {
        return safeMacadamCall(undefined, (m) => m.getFirstDevice())
    }

    static getDevices(): DeviceData[] {
        return safeMacadamCall([], (m) => {
            let deviceInfo: any = m.getDeviceInfo()
            if (typeof deviceInfo === "object") deviceInfo = Object.values(deviceInfo)
            return deviceInfo
        })
    }

    static getDeviceById(deviceHandle: string) {
        return this.getDevices().find((a) => a.deviceHandle === deviceHandle)
    }

    static getIndexById(deviceHandle: string) {
        return this.getDevices().findIndex((a) => a.deviceHandle === deviceHandle)
    }

    static getDeviceConfig(deviceHandle: string) {
        const deviceIndex = this.getIndexById(deviceHandle)
        if (deviceIndex < 0) return undefined

        return safeMacadamCall(undefined, (m) => {
            const config: DeviceConfig = m.getDeviceConfig(deviceIndex)
            return config
        })
    }

    static setDeviceConfig(deviceHandle: string, newData: DeviceConfig) {
        const deviceIndex = this.getIndexById(deviceHandle)
        if (deviceIndex < 0) return false

        return safeMacadamCall(false, (m) => {
            m.setDeviceConfig({ ...newData, deviceIndex })
            return true
        })
    }

    static getDisplayMode(displayModeName: string) {
        // First try direct lookup
        let mode = getBmdDisplayModes().get(displayModeName)
        if (mode !== undefined) return mode

        // Try normalizing the display mode name
        // Convert "2K DCI 60p" -> "2kDCI60"
        // Convert "4K 2160p 59.94" -> "4K2160p59.94"
        const normalized = displayModeName
            .replace(/\s+/g, "") // Remove all spaces
            .replace(/p$/i, "") // Remove trailing 'p'
            .replace(/i$/i, "") // Remove trailing 'i'

        mode = getBmdDisplayModes().get(normalized)
        if (mode !== undefined) return mode

        // Try with different case variations
        const lowerNormalized = normalized.toLowerCase()
        for (const [key, value] of getBmdDisplayModes()) {
            if (key.toLowerCase() === lowerNormalized) {
                return value
            }
        }

        return undefined
    }

    static getPixelFormat(pixelFormat: string) {
        // Compatibility mapping for 12-bit RGB
        if ((pixelFormat === "12-bit RGB" || pixelFormat === "12BitRGB") && getBmdPixelFormats().has("12-bit RGBLE")) {
            return getBmdPixelFormats().get("12-bit RGBLE")
        }
        return getBmdPixelFormats().get(pixelFormat)
    }

    /**
     * Check if the pixel format supports alpha keying
     * Only 8-bit ARGB and BGRA are supported
     */
    static isAlphaSupported(pixelFormat: string): boolean {
        if (!pixelFormat.includes("8")) return false
        return pixelFormat.includes("BGRA") || pixelFormat.includes("ARGB")
    }

    /**
     * Resets a Blackmagic device that has been marked as unstable
     *
     * @param deviceId The ID of the device to reset
     * @returns Object with success status and message
     */
    static resetDevice(deviceId: string): { success: boolean; message: string } {
        try {
            // First check if device exists
            const device = this.getDeviceById(deviceId)
            if (!device) {
                return {
                    success: false,
                    message: `Device ${deviceId} not found in available devices`
                }
            }

            // Check if the device was marked as unstable in BlackmagicSender
            const wasUnstable = BlackmagicSender.isDeviceStable(deviceId) === false

            // Reset the device in BlackmagicSender
            const resetResult = BlackmagicSender.resetProblematicDevice(deviceId)

            // If it wasn't previously marked as unstable, inform the user
            if (!wasUnstable && !resetResult) {
                return {
                    success: true,
                    message: `Device ${deviceId} (${device.displayName}) was not marked as unstable`
                }
            }

            // If it was reset, try to reinitialize it
            if (resetResult) {
                return {
                    success: true,
                    message: `Device ${deviceId} (${device.displayName}) has been reset and can be used again`
                }
            }

            return {
                success: false,
                message: `Failed to reset device ${deviceId}`
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err)
            return {
                success: false,
                message: `Error resetting device: ${errorMessage}`
            }
        }
    }
}
