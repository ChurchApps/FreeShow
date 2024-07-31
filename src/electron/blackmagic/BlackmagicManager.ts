import macadam from "macadam"
import { DeviceConfig, DeviceData } from "./TypeData"

// https://github.com/Streampunk/macadam
export class BlackmagicManager {
    static getFirstDeviceName(): string | undefined {
        return macadam.getFirstDevice()
    }

    static getDevices(): DeviceData[] {
        return macadam.getDeviceInfo() as any // ??
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
}
