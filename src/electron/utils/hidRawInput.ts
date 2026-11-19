import { type ChildProcess, spawn } from "child_process"
import { app } from "electron"
import path from "path"

type DeviceInfo = { path?: string; usagePage?: number; usage?: number }
type InputCallback = (devicePath: string, data: number[]) => void

export function isRawInputDevice(device: DeviceInfo): boolean {
    if (process.platform !== "win32" || !device.path) return false
    return device.path.toLowerCase().endsWith("\\kbd") || (device.usagePage === 1 && device.usage === 6)
}

// Extract device instance ID (everything before the interface class "#{...}")
export function getRawInputDeviceId(devicePath: string): string {
    let id = devicePath.toLowerCase()
    const classIndex = id.lastIndexOf("#{")
    if (classIndex > -1) id = id.slice(0, classIndex)
    if (id.startsWith("\\\\?\\") || id.startsWith("\\??\\")) id = id.slice(4)
    return id
}

const watchedDevices: Record<string, string> = {} // id: path
let helper: ChildProcess | null = null
let inputCallback: InputCallback | null = null

export function listenRawInputDevice(devicePath: string, callback: InputCallback) {
    const id = getRawInputDeviceId(devicePath)
    inputCallback = callback

    if (!watchedDevices[id]) {
        watchedDevices[id] = devicePath
        console.info("HID LISTENING (Raw Input):", devicePath)
        if (!helper) startHelper()
        else sendCommand(`+${id}`)
    } else if (!helper) {
        startHelper()
    }
}

export function closeRawInputDevice(devicePath: string) {
    const id = getRawInputDeviceId(devicePath)
    if (!watchedDevices[id]) return

    delete watchedDevices[id]
    console.info("HID CLOSED LISTENER (Raw Input):", devicePath)

    if (!helper) return
    if (Object.keys(watchedDevices).length) sendCommand(`-${id}`)
    else stopHelper()
}

// Windows: Presentation clickers are keyboards, which node-hid cannot open directly, these devices are read in the background using Raw Input via a helper process.
function startHelper() {
    const helperPath = path.join(app.getAppPath(), "public", "assets", "bin", "hid-input-helper.exe").replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`)
    const child = spawn(helperPath, [], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] })
    helper = child

    let received = ""
    child.stdout?.on("data", (chunk: Buffer) => {
        received += chunk.toString()
        const lines = received.split("\n")
        received = lines.pop() || ""
        lines.forEach(receivedLine)
    })

    child.stderr?.on("data", (chunk: Buffer) => console.warn("HID RAW INPUT:", chunk.toString().trim()))
    child.on("error", () => stopped())
    child.on("exit", () => stopped())

    function stopped() {
        if (helper !== child) return
        helper = null
        const prev = { ...watchedDevices }
        Object.keys(watchedDevices).forEach((id) => delete watchedDevices[id])
        if (Object.keys(prev).length && inputCallback) {
            Object.values(prev).forEach((p) => listenRawInputDevice(p, inputCallback!))
        }
    }

    Object.keys(watchedDevices).forEach((id) => sendCommand(`+${id}`))
}

function stopHelper() {
    if (!helper) return
    const child = helper
    helper = null
    child.stdin?.end()
    setTimeout(() => {
        if (child.exitCode === null) child.kill()
    }, 1000)
}

function sendCommand(command: string) {
    if (helper?.stdin?.writable) helper.stdin.write(command + "\n")
}

// "<device name>\t<virtual key>\t<scan code>\t<flags>"
function receivedLine(line: string) {
    const [deviceName, ...values] = line.trim().split("\t")
    const devicePath = watchedDevices[getRawInputDeviceId(deviceName || "")]
    if (!devicePath) return

    const data = values.map((val) => parseInt(val, 10)).filter((val) => !isNaN(val))
    if (data.length) inputCallback?.(devicePath, data)
}
