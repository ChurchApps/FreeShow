// Windows does not allow node-hid to read keyboard devices (most presentation clickers are keyboards),
// so these are read through Windows Raw Input in a small helper process instead (scripts/hid-input-helper).
// This also works when FreeShow is not focused, but the key presses still reach the focused app.

import { type ChildProcess, spawn } from "child_process"
import { app } from "electron"
import path from "path"

type DeviceInfo = { path?: string; usagePage?: number; usage?: number }
type InputCallback = (devicePath: string, data: number[]) => void

export function isRawInputDevice(device: DeviceInfo): boolean {
    if (process.platform !== "win32" || !device.path) return false
    return device.path.toLowerCase().endsWith("\\kbd") || (device.usagePage === 1 && device.usage === 6)
}

// node-hid:  \\?\HID#VID_0483&PID_2080&MI_00#7&2a5f5b2&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}\KBD
// Raw Input: \\?\HID#VID_0483&PID_2080&MI_00#7&2a5f5b2&0&0000#{884b96c3-56ef-11d1-bc8c-00a0c91405dd}
// both have the same device instance id before the interface class "#{...}"
// (the helper uses the same conversion)
export function getRawInputDeviceId(devicePath: string): string {
    const id = devicePath.toLowerCase().replace(/^(?:\\\\\?\\|\\\?\?\\)/, "")
    const classIndex = id.lastIndexOf("#{")
    return classIndex > -1 ? id.slice(0, classIndex) : id
}

const watchedDevices: Record<string, string> = {} // id: path
let helper: ChildProcess | null = null
let inputCallback: InputCallback | null = null

export function listenRawInputDevice(devicePath: string, callback: InputCallback) {
    const id = getRawInputDeviceId(devicePath)
    if (watchedDevices[id]) return

    watchedDevices[id] = devicePath
    inputCallback = callback
    console.info("HID LISTENING (Raw Input):", devicePath)

    if (!helper) startHelper()
    else sendCommand(helper, `+${id}`)
}

export function closeRawInputDevice(devicePath: string) {
    const id = getRawInputDeviceId(devicePath)
    if (!watchedDevices[id]) return

    delete watchedDevices[id]
    console.info("HID CLOSED LISTENER (Raw Input):", devicePath)

    if (!helper) return
    if (Object.keys(watchedDevices).length) sendCommand(helper, `-${id}`)
    else stopHelper()
}

function startHelper() {
    // spawn can not run files from inside the asar archive
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
    child.stdin?.on("error", (err) => console.error("HID RAW INPUT ERROR:", err))

    const stopped = (reason: Error | number | null) => {
        if (helper !== child) return
        helper = null
        console.info("HID RAW INPUT HELPER STOPPED:", reason)
        for (const id in watchedDevices) delete watchedDevices[id]
    }

    child.on("error", stopped)
    child.on("exit", stopped)

    Object.keys(watchedDevices).forEach((id) => sendCommand(child, `+${id}`))
}

function stopHelper() {
    if (!helper) return
    const child = helper
    helper = null

    // the helper exits when its input is closed
    child.stdin?.end()
    setTimeout(() => {
        if (child.exitCode === null) child.kill()
    }, 1000)
}

function sendCommand(child: ChildProcess, command: string) {
    if (!child.stdin?.writable) return
    child.stdin.write(command + "\n")
}

// "<device name>\t<virtual key>\t<scan code>\t<flags>"
function receivedLine(line: string) {
    const [deviceName, ...values] = line.trim().split("\t")
    const devicePath = watchedDevices[getRawInputDeviceId(deviceName || "")]
    if (!devicePath) return

    const data = values.map((value) => parseInt(value, 10)).filter((value) => !isNaN(value))
    if (data.length) inputCallback?.(devicePath, data)
}
