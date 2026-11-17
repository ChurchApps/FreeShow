import { EventEmitter } from "events"
import { PassThrough } from "stream"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("electron", () => ({
    app: { getAppPath: () => "C:\\FreeShow\\resources\\app.asar" }
}))

// Fake helper process: records the commands FreeShow writes and lets the test print helper output
class FakeChildProcess extends EventEmitter {
    stdin = new PassThrough()
    stdout = new PassThrough()
    stderr = new PassThrough()
    exitCode: number | null = null
    commands: string[] = []
    constructor() {
        super()
        this.stdin.on("data", (chunk: Buffer) => this.commands.push(...chunk.toString().split("\n").filter(Boolean)))
        this.stdin.on("finish", () => {
            this.exitCode = 0
            this.emit("exit", 0)
        })
    }
    kill() {}
}

let spawned: FakeChildProcess[] = []
let spawnedPath = ""
vi.mock("child_process", () => ({
    spawn: (path: string) => {
        spawnedPath = path
        const child = new FakeChildProcess()
        spawned.push(child)
        return child
    }
}))

const { closeRawInputDevice, getRawInputDeviceId, isRawInputDevice, listenRawInputDevice } = await import("./hidRawInput")

// a clicker receiver as listed by node-hid and as named by Raw Input
const NODE_HID_PATH = "\\\\?\\HID#VID_0483&PID_2080&MI_00#7&2a5f5b2&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}\\KBD"
const RAW_INPUT_NAME = "\\\\?\\HID#VID_0483&PID_2080&MI_00#7&2a5f5b2&0&0000#{884b96c3-56ef-11d1-bc8c-00a0c91405dd}"

const nextTick = () => new Promise((resolve) => setImmediate(resolve))

describe("getRawInputDeviceId", () => {
    it("gives node-hid paths and Raw Input names of the same device the same id", () => {
        expect(getRawInputDeviceId(NODE_HID_PATH)).toBe("hid#vid_0483&pid_2080&mi_00#7&2a5f5b2&0&0000")
        expect(getRawInputDeviceId(RAW_INPUT_NAME)).toBe(getRawInputDeviceId(NODE_HID_PATH))
    })

    it("supports collections, Bluetooth devices and the older \\??\\ prefix", () => {
        const collection = "HID#VID_046D&PID_C52B&MI_01&COL01#8&1d2e3f&0&0000"
        expect(getRawInputDeviceId(`\\\\?\\${collection}#{4d1e55b2-f16f-11cf-88cb-001111000030}\\KBD`)).toBe(getRawInputDeviceId(`\\??\\${collection}#{884b96c3-56ef-11d1-bc8c-00a0c91405dd}`))

        // the Bluetooth instance id contains "#{" too, only the last one is the interface class
        const bluetooth = "HID#{00001124-0000-1000-8000-00805f9b34fb}_VID&0002046d_PID&b00c&Col01#9&2f3a&0&0000"
        expect(getRawInputDeviceId(`\\\\?\\${bluetooth}#{884b96c3-56ef-11d1-bc8c-00a0c91405dd}`)).toBe(bluetooth.toLowerCase())
    })

    it("does not match different devices", () => {
        const otherDevice = RAW_INPUT_NAME.replace("7&2a5f5b2", "7&99aa11")
        expect(getRawInputDeviceId(otherDevice)).not.toBe(getRawInputDeviceId(NODE_HID_PATH))
    })
})

describe("Raw Input listener", () => {
    const platform = process.platform

    beforeEach(() => {
        Object.defineProperty(process, "platform", { value: "win32" })
        spawned = []
    })
    afterEach(() => {
        closeRawInputDevice(NODE_HID_PATH)
        closeRawInputDevice("\\\\?\\HID#VID_1111&PID_2222#1&abc&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}\\KBD")
        Object.defineProperty(process, "platform", { value: platform })
    })

    it("only uses Raw Input for Windows keyboard devices", () => {
        expect(isRawInputDevice({ path: NODE_HID_PATH })).toBe(true)
        expect(isRawInputDevice({ path: "\\\\?\\HID#VID_0483&PID_2080&MI_01#x#{4d1e55b2-f16f-11cf-88cb-001111000030}", usagePage: 1, usage: 6 })).toBe(true)
        expect(isRawInputDevice({ path: "\\\\?\\HID#VID_0483&PID_2080&MI_01#x#{4d1e55b2-f16f-11cf-88cb-001111000030}", usagePage: 12, usage: 1 })).toBe(false)

        Object.defineProperty(process, "platform", { value: "darwin" })
        expect(isRawInputDevice({ path: "DevSrvsID:4295062035", usagePage: 1, usage: 6 })).toBe(false)
    })

    it("starts the unpacked helper and sends the device id", () => {
        listenRawInputDevice(NODE_HID_PATH, () => {})

        expect(spawned).toHaveLength(1)
        expect(spawnedPath).toContain("app.asar.unpacked")
        expect(spawnedPath).toMatch(/hid-input-helper\.exe$/)
        return nextTick().then(() => expect(spawned[0].commands).toEqual(["+hid#vid_0483&pid_2080&mi_00#7&2a5f5b2&0&0000"]))
    })

    it("reports key presses with the node-hid path the frontend listens to", async () => {
        const received: [string, number[]][] = []
        listenRawInputDevice(NODE_HID_PATH, (path, data) => received.push([path, data]))

        // output can arrive split across chunks
        spawned[0].stdout.write(`${RAW_INPUT_NAME}\t34\t8`)
        spawned[0].stdout.write(`1\t2\n${RAW_INPUT_NAME.replace("7&2a5f5b2", "7&99aa11")}\t34\t81\t2\n`)
        await nextTick()

        expect(received).toEqual([[NODE_HID_PATH, [34, 81, 2]]])
    })

    it("uses one helper for all devices and stops it when nothing is listened to", async () => {
        const otherDevice = "\\\\?\\HID#VID_1111&PID_2222#1&abc&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}\\KBD"
        listenRawInputDevice(NODE_HID_PATH, () => {})
        listenRawInputDevice(otherDevice, () => {})
        expect(spawned).toHaveLength(1)

        closeRawInputDevice(otherDevice)
        await nextTick()
        expect(spawned[0].commands).toEqual(["+hid#vid_0483&pid_2080&mi_00#7&2a5f5b2&0&0000", "+hid#vid_1111&pid_2222#1&abc&0&0000", "-hid#vid_1111&pid_2222#1&abc&0&0000"])
        expect(spawned[0].exitCode).toBe(null)

        closeRawInputDevice(NODE_HID_PATH)
        await nextTick()
        expect(spawned[0].exitCode).toBe(0)
    })

    it("can listen again after the helper stopped unexpectedly", () => {
        listenRawInputDevice(NODE_HID_PATH, () => {})
        spawned[0].emit("exit", 1)

        listenRawInputDevice(NODE_HID_PATH, () => {})
        expect(spawned).toHaveLength(2)
    })
})
