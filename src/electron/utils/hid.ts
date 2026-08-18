import { type Device, devicesAsync, HID } from "node-hid"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"

function isUnsupportedPath(path: string): boolean {
    // macOS virtual service entries are not openable with node-hid
    return path.startsWith("DevSrvsID:")
}

type HidEntry = {
    device: HID
    closed: boolean
}

type HidGroup = {
    entries: Record<string, HidEntry>
    closed: boolean
}

let supportedDevicesCache: Device[] = []
const devices: Record<string, HidGroup> = {}

function safeClose(device: HID) {
    try {
        device.close()
    } catch {}
}

const lastDeviceEmitTime: Record<string, number> = {}
const lastSignatureEmitTime: Record<string, number> = {}

function emitHidData(path: string, data: Buffer | number[]) {
    if (!data?.length) return
    const arr = Array.from(data)
    const now = Date.now()

    // Minimum 200ms cooldown between events on the same device to eliminate chatter bursts
    const lastDev = lastDeviceEmitTime[path] || 0
    if (now - lastDev < 200) return

    // Minimum 500ms cooldown for the exact command signature (first 4 bytes)
    const signature = `${path}:${arr.slice(0, Math.min(arr.length, 4)).join(",")}`
    const lastSig = lastSignatureEmitTime[signature] || 0
    if (now - lastSig < 500) return

    lastDeviceEmitTime[path] = now
    lastSignatureEmitTime[signature] = now

    sendToMain(ToMain.HID_DATA, { path, data: arr })
}

function isRelevantDevice(device: Device): boolean {
    if (!device.path || isUnsupportedPath(device.path) || !device.product || !device.manufacturer) return false

    const productLower = device.product.toLowerCase()
    const pathLower = device.path.toLowerCase()

    // Filter out internal virtual and VHF drivers
    if (pathLower.includes("hid_device_system_vhf") || productLower.includes("vhf driver")) return false

    // Filter out firmware update devices
    if (productLower.includes("cfu device") || productLower.includes("firmware update")) return false

    // Filter out internal system bus controllers
    if (productLower === "hidi2c device" || productLower === "hid i2c device") return false

    // Filter out OS-exclusive keyboard/mouse endpoints that Windows locks
    if (pathLower.endsWith("\\kbd") || pathLower.includes("&mi_00#")) return false

    return true
}

function isAlreadyOpen(path: string): boolean {
    if (devices[path]) return true
    for (const group of Object.values(devices)) {
        if (group.entries[path]) return true
    }
    return false
}

function isReadable(d: Device): boolean {
    if (!d.path) return false
    if (isAlreadyOpen(d.path)) return true

    try {
        const testDev = new HID(d.path)
        try {
            // Probe if Input Reports (ReadFile) are supported on this endpoint
            testDev.readTimeout(1)
        } catch (err: any) {
            safeClose(testDev)
            return false
        }
        safeClose(testDev)
        return true
    } catch {
        return false
    }
}

export async function getHidDevices(forceRefresh = false): Promise<Device[]> {
    if (!forceRefresh && supportedDevicesCache.length > 0) {
        return supportedDevicesCache
    }

    try {
        const devices = (await devicesAsync()).filter((d) => d.vendorId || d.productId)

        // only keep user-relevant, readable devices
        let filteredDevices: Device[] = []
        for (const device of devices) {
            if (!isRelevantDevice(device)) continue

            // verify device can be opened
            if (!isReadable(device)) continue

            filteredDevices.push(device)
        }

        // keep unique paths only (preserve multiple valid interfaces)
        const existingPaths = new Set<string>()
        filteredDevices = filteredDevices.filter((d) => {
            if (!d.path || existingPaths.has(d.path)) return false
            existingPaths.add(d.path)
            return true
        })

        supportedDevicesCache = filteredDevices
        return filteredDevices
    } catch (err) {
        console.log("HID DEVICES ERROR:", err)
        return supportedDevicesCache
    }
}

export async function hidAwaitInput(data: { path: string }) {
    const deviceId = data.path
    if (!deviceId || isUnsupportedPath(deviceId)) {
        console.log("HID UNSUPPORTED PATH:", deviceId)
        return
    }
    if (devices[deviceId]) return

    let device: HID
    try {
        device = new HID(deviceId)
    } catch (err) {
        console.log("HID COULD NOT OPEN:", deviceId, err)
        return
    }

    const group: HidGroup = { entries: {}, closed: false }
    devices[deviceId] = group

    console.log("HID LISTENING: ", deviceId)

    const entry = { device, closed: false }
    group.entries[deviceId] = entry

    device.on("data", (data: Buffer | number[]) => {
        if (entry.closed || group.closed) return
        emitHidData(deviceId, data)
    })

    device.on("error", (err) => {
        console.log("HID ERROR:", deviceId, err)
        entry.closed = true
        safeClose(device)
        delete devices[deviceId]
    })
}

export function hidClose(data: { path: string }) {
    const deviceId = data.path
    const group = devices[deviceId]
    if (!group) return

    group.closed = true
    for (const entry of Object.values(group.entries)) {
        entry.closed = true
        safeClose(entry.device)
    }
    delete devices[deviceId]
    delete lastDeviceEmitTime[deviceId]
    console.log("HID CLOSED LISTENER:", deviceId)
}
