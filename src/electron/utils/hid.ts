import { type Device, devicesAsync, HID } from "node-hid"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"

function isUnsupportedPath(path: string): boolean {
    // macOS virtual service entries are not openable with node-hid
    return path.startsWith("DevSrvsID:")
}

let supportedDevicesCache: Device[] = []

type HidEntry = {
    device: HID
    closed: boolean
}

type HidGroup = {
    entries: Record<string, HidEntry>
    closed: boolean
}

const devices: Record<string, HidGroup> = {}

function safeClose(device: HID) {
    try {
        device.close()
    } catch {}
}

function emitHidData(path: string, data: Buffer | number[]) {
    if (!data?.length) return
    console.log("HID RECEIVED DATA:", path)
    sendToMain(ToMain.HID_DATA, data)
}

function isRelevantDevice(device: Device): boolean {
    return !!device.path && !isUnsupportedPath(device.path) && !!device.product && !!device.manufacturer
}

export async function getHidDevices(): Promise<Device[]> {
    try {
        const devices = (await devicesAsync()).filter((d) => d.vendorId || d.productId)

        // only keep user-relevant devices
        let filteredDevices: Device[] = []
        for (const device of devices) {
            if (!isRelevantDevice(device)) continue

            // keep windows readability check
            if (process.platform === "win32" && !(await isReadable(device))) continue

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
        supportedDevicesCache = []
        return []
    }
}

async function isReadable(d: Device): Promise<boolean> {
    return new Promise((resolve) => {
        if (!d.path) {
            resolve(false)
            return
        }

        let device: HID
        try {
            device = new HID(d.path)
        } catch {
            resolve(false)
            return
        }

        const onError = () => complete(false)
        const onData = () => {}

        device.on("error", onError)

        // needed to check for errors
        device.on("data", onData)

        // give time to connect and check for connection errors
        // if no errors after 10 ms, close as valid
        setTimeout(() => complete(true), 10)

        let done = false
        function complete(isValid: boolean) {
            if (done) return
            done = true

            device.removeListener("error", onError)
            device.removeListener("data", onData)
            safeClose(device)

            resolve(isValid)
        }
    })
}

async function getCandidatePaths(deviceId: string): Promise<string[]> {
    const fallbackPaths: string[] = [deviceId]

    try {
        const list = supportedDevicesCache.length ? supportedDevicesCache : await devicesAsync()
        const selected = list.find((d) => d.path === deviceId)
        if (!selected) return fallbackPaths

        const candidatePaths = list
            .filter((d) => {
                if (!d.path) return false
                if (d.vendorId !== selected.vendorId || d.productId !== selected.productId) return false

                // prefer matching serial when available, otherwise allow all same VID/PID interfaces
                if (selected.serialNumber) return d.serialNumber === selected.serialNumber
                return true
            })
            .map((d) => d.path!)

        return Array.from(new Set(candidatePaths))
    } catch (err) {
        console.log("HID LIST MATCH ERROR:", err)
    }

    return fallbackPaths
}

export async function hidAwaitInput(data: { path: string }) {
    const deviceId = data.path
    if (isUnsupportedPath(deviceId)) {
        console.log("HID UNSUPPORTED PATH:", deviceId)
        return
    }
    if (devices[deviceId]) return

    const group: HidGroup = { entries: {}, closed: false }
    devices[deviceId] = group
    const candidatePaths = await getCandidatePaths(deviceId)
    let openedAny = false

    for (const path of candidatePaths) {
        if (group.closed) break
        if (isUnsupportedPath(path)) continue

        let device: HID
        try {
            device = new HID(path)
        } catch {
            continue
        }

        if (group.closed) {
            safeClose(device)
            break
        }

        openedAny = true

        console.log("HID LISTENING: ", path)

        const entry = { device, closed: false }
        group.entries[path] = entry

        const isClosed = () => entry.closed || group.closed

        device.on("error", (err) => {
            console.log("HID ERROR:", path, err)
        })

        const readLoop = () => {
            if (isClosed()) return

            device.read((err, data) => {
                if (isClosed()) return

                if (err) {
                    console.log("HID READ ERROR:", path, err)
                    // retry to keep listening for transient read failures
                    setTimeout(readLoop, 50)
                    return
                }

                if (data?.length) {
                    emitHidData(path, data)
                }

                readLoop()
            })
        }
        readLoop()
    }

    if (!openedAny && !group.closed) {
        delete devices[deviceId]
        console.log("HID NO OPENABLE PATHS:", deviceId)
    }
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
}
