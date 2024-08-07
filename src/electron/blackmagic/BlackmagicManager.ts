import macadam from "macadam"
import { bmdDisplayModes, bmdPixelFormats } from "./bmdFormats"
import { DeviceConfig, DeviceData } from "./TypeData"

// https://github.com/Streampunk/macadam
export class BlackmagicManager {
    static getFirstDeviceName(): string | undefined {
        return macadam.getFirstDevice()
    }

    static getDevices(): DeviceData[] {
        // if (!isProd) {
        //     // test data
        //     return [
        //         {
        //             modelName: "Intensity Extreme",
        //             displayName: "Intensity Extreme",
        //             vendorName: "Blackmagic",
        //             deviceHandle: "54:00000000:00360600",
        //             hasSerialPort: false,
        //             topologicalID: 3540480,
        //             inputDisplayModes: [
        //                 {
        //                     name: "1080p29.97",
        //                     width: 1920,
        //                     height: 1080,
        //                     frameRate: [1001, 30000],
        //                     videoModes: ["8-bit YUV", "10-bit YUV"],
        //                 },
        //                 {
        //                     name: "1080p30",
        //                     width: 192,
        //                     height: 108,
        //                     frameRate: [1001, 20000],
        //                     videoModes: ["10-bit YUV"],
        //                 },
        //             ],
        //         } as any,
        //     ]
        // }

        let deviceInfo: any = macadam.getDeviceInfo()
        if (typeof deviceInfo === "object") deviceInfo = Object.values(deviceInfo)
        return deviceInfo
    }

    static getDeviceById(deviceHandle: string) {
        return this.getDevices().find((a) => a.deviceHandle === deviceHandle)
    }

    static getIndexById(deviceHandle: string) {
        return this.getDevices().findIndex((a) => a.deviceHandle === deviceHandle)
    }

    static getDeviceConfig(deviceHandle: string) {
        let deviceIndex = this.getIndexById(deviceHandle)
        if (deviceIndex < 0) return undefined

        let config: DeviceConfig = macadam.getDeviceConfig(deviceIndex) as any
        return config
    }

    static setDeviceConfig(deviceHandle: string, newData: DeviceConfig) {
        let deviceIndex = this.getIndexById(deviceHandle)
        if (deviceIndex < 0) return false

        macadam.setDeviceConfig({ ...newData, deviceIndex })
        return true
    }

    static getDisplayMode(displayModeName: string) {
        return bmdDisplayModes.get(displayModeName)
    }

    static getPixelFormat(pixelFormat: string) {
        return bmdPixelFormats.get(pixelFormat)
    }
}
