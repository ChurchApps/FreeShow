import { accessSync, constants } from "fs"
import type * as NodeHid from "node-hid"
import type { Device, HID } from "node-hid"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"
import { closeRawInputDevice, isRawInputDevice, listenRawInputDevice } from "./hidRawInput"

let nodeHidModule: typeof NodeHid | null | undefined // undefined = not yet tried; null = unavailable

// lazy-load node-hid so a missing native library does not stop the app from starting
function getNodeHid(): typeof NodeHid | null {
    if (nodeHidModule === undefined) {
        try {
            nodeHidModule = require("node-hid") as typeof NodeHid
        } catch (err) {
            console.warn("Failed to load HID module:", err instanceof Error ? err.message : String(err))
            nodeHidModule = null
        }
    }

    return nodeHidModule
}

export type HidDevice = Device & {
    // the OS has to give FreeShow access before the device can be read
    permission?: "input_monitoring" | "udev"
    // Windows keyboard devices are read through Raw Input instead of node-hid
    rawInput?: boolean
}

// non exclusive: read a copy of the input instead of taking the device away from the OS (macOS seizes it by default)
function openDevice(path: string): HID {
    const nodeHid = getNodeHid()
    if (!nodeHid) throw new Error("HID module not available")
    return new nodeHid.HID(path, { nonExclusive: true })
}

type HidGroup = {
    device: HID
    closed: boolean
}

let supportedDevicesCache: HidDevice[] = []
const devices: Record<string, HidGroup> = {}

function safeClose(device: HID) {
    try {
        device.close()
    } catch {}
}

function emitHidData(path: string, data: Buffer | number[]) {
    if (!data?.length) return

    sendToMain(ToMain.HID_DATA, { path, data: Array.from(data) })
}

function isRelevantDevice(device: Device): boolean {
    // some clickers only report a product or a manufacturer name
    if (!device.path || (!device.product && !device.manufacturer)) return false

    const productLower = (device.product || "").toLowerCase()
    const pathLower = device.path.toLowerCase()

    // Filter out internal virtual and VHF drivers
    if (pathLower.includes("hid_device_system_vhf") || productLower.includes("vhf driver")) return false

    // Filter out firmware update devices
    if (productLower.includes("cfu device") || productLower.includes("firmware update")) return false

    // Filter out internal system bus controllers
    if (productLower === "hidi2c device" || productLower === "hid i2c device") return false

    // Filter out vendor-defined configuration / diagnostic endpoints (usagePage >= 0xFF00)
    if (device.usagePage && device.usagePage >= 0xff00) return false

    // Windows locks keyboard endpoints (most clickers), these are read through Raw Input instead
    if (isRawInputDevice(device)) return true

    // Filter out OS-exclusive keyboard/mouse endpoints that Windows locks
    if (pathLower.endsWith("\\kbd") || pathLower.includes("&mi_00#")) return false

    return true
}

function getCompositeDeviceKey(device: Device): string {
    let p = (device.path || "").toLowerCase()
    const classIdx = p.lastIndexOf("#{")
    if (classIdx > -1) p = p.slice(0, classIdx)
    const colIdx = p.lastIndexOf("&col")
    if (colIdx > -1) p = p.slice(0, colIdx)
    return `${device.vendorId}:${device.productId}:${p}`
}

function isAlreadyOpen(path: string): boolean {
    return !!devices[path]
}

function isReadable(d: Device): boolean | "permission" {
    if (!d.path) return false
    if (isAlreadyOpen(d.path)) return true

    try {
        const testDev = openDevice(d.path)
        try {
            // Probe if Input Reports (ReadFile) are supported on this endpoint
            testDev.readTimeout(1)
        } catch (err: any) {
            safeClose(testDev)
            return false
        }
        safeClose(testDev)
        return true
    } catch (err) {
        return isPermissionError(d.path, err) ? "permission" : false
    }
}

function isPermissionError(path: string, err: any): boolean {
    // macOS: keyboard type devices (most clickers) need the "Input Monitoring" permission
    if (process.platform === "darwin") {
        const message = String(err?.message || err)
        return message.includes("not permitted") || message.includes("0xE00002E2")
    }

    // Linux: /dev/hidraw* is only readable by root unless a udev rule gives access
    if (process.platform === "linux") {
        try {
            accessSync(path, constants.R_OK)
        } catch (accessErr: any) {
            return accessErr?.code === "EACCES"
        }
    }

    return false
}

export async function getHidDevices(forceRefresh = false): Promise<HidDevice[]> {
    if (!forceRefresh && supportedDevicesCache.length > 0) {
        return supportedDevicesCache
    }

    const nodeHid = getNodeHid()
    if (!nodeHid) return []

    try {
        let devices = (await nodeHid.devicesAsync()).filter((d) => d.vendorId || d.productId)

        // keep unique paths only (preserve multiple valid interfaces)
        // macOS lists the same path once for each usage, so this is done before opening the devices
        const existingPaths = new Set<string>()
        devices = devices.filter((d) => {
            if (!d.path || existingPaths.has(d.path)) return false
            existingPaths.add(d.path)
            return true
        })

        // only keep user-relevant, readable devices
        const filteredDevices: HidDevice[] = []
        for (const device of devices) {
            if (!isRelevantDevice(device)) continue

            if (isRawInputDevice(device)) {
                filteredDevices.push({ ...device, rawInput: true })
                continue
            }

            // verify device can be opened
            const readable = isReadable(device)
            if (!readable) continue

            // listed, so the user can see what access is missing
            if (readable === "permission") {
                filteredDevices.push({ ...device, permission: process.platform === "darwin" ? "input_monitoring" : "udev" })
                continue
            }

            filteredDevices.push(device)
        }

        // Deduplicate composite device endpoints sharing the same physical device interface
        const groupedDevices: Record<string, HidDevice[]> = {}
        for (const dev of filteredDevices) {
            const key = getCompositeDeviceKey(dev)
            if (!groupedDevices[key]) groupedDevices[key] = []
            groupedDevices[key].push(dev)
        }

        const deduplicatedDevices: HidDevice[] = []
        for (const group of Object.values(groupedDevices)) {
            // Prefer rawInput (keyboard endpoint) if available
            const preferred = group.find((d) => d.rawInput) || group[0]
            deduplicatedDevices.push(preferred)
        }

        supportedDevicesCache = deduplicatedDevices
        return deduplicatedDevices
    } catch (err) {
        console.error("HID DEVICES ERROR:", err)
        return supportedDevicesCache
    }
}

export async function hidAwaitInput(data: { path: string }) {
    const deviceId = data.path
    if (!deviceId) return
    if (devices[deviceId]) return

    const cachedDevice = supportedDevicesCache.find((a) => a.path === deviceId)
    if (isRawInputDevice(cachedDevice || { path: deviceId })) {
        listenRawInputDevice(deviceId, emitHidData)
        return
    }

    let device: HID
    try {
        device = openDevice(deviceId)
    } catch (err) {
        console.warn("HID COULD NOT OPEN:", deviceId, err)
        return
    }

    const group: HidGroup = { device, closed: false }
    devices[deviceId] = group
    console.info("HID LISTENING:", deviceId)

    device.on("data", (data: Buffer | number[]) => {
        if (group.closed) return
        if (Array.from(data).every((value) => !value)) return
        emitHidData(deviceId, data)
    })

    device.on("error", (err) => {
        console.error("HID ERROR:", deviceId, err)
        group.closed = true
        safeClose(device)
        delete devices[deviceId]
    })
}

export function hidClose(data: { path: string }) {
    const deviceId = data.path
    closeRawInputDevice(deviceId)

    const group = devices[deviceId]
    if (!group) return

    group.closed = true
    safeClose(group.device)
    delete devices[deviceId]
    console.info("HID CLOSED LISTENER:", deviceId)
}
