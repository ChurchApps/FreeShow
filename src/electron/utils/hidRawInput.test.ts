import { EventEmitter } from "events"
import { PassThrough } from "stream"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("electron", () => ({
    app: { getAppPath: () => "C:\\FreeShow\\resources\\app.asar" }
}))

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

const NODE_HID_PATH = "\\\\?\\HID#VID_0483&PID_2080&MI_00#7&2a5f5b2&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}\\KBD"
const RAW_INPUT_NAME = "\\\\?\\HID#VID_0483&PID_2080&MI_00#7&2a5f5b2&0&0000#{884b96c3-56ef-11d1-bc8c-00a0c91405dd}"
const nextTick = () => new Promise((resolve) => setImmediate(resolve))

describe("hidRawInput", () => {
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

    it("matches device instance IDs regardless of interface class", () => {
        const expected = "hid#vid_0483&pid_2080&mi_00#7&2a5f5b2&0&0000"
        expect(getRawInputDeviceId(NODE_HID_PATH)).toBe(expected)
        expect(getRawInputDeviceId(RAW_INPUT_NAME)).toBe(expected)
    })

    it("identifies Windows keyboard endpoints", () => {
        expect(isRawInputDevice({ path: NODE_HID_PATH })).toBe(true)
        expect(isRawInputDevice({ path: "\\\\?\\foo", usagePage: 1, usage: 6 })).toBe(true)
        expect(isRawInputDevice({ path: "\\\\?\\foo", usagePage: 12, usage: 1 })).toBe(false)
        Object.defineProperty(process, "platform", { value: "darwin" })
        expect(isRawInputDevice({ path: "DevSrvsID:123", usagePage: 1, usage: 6 })).toBe(false)
    })

    it("spawns helper, registers devices, and parses key presses", async () => {
        const received: [string, number[]][] = []
        listenRawInputDevice(NODE_HID_PATH, (path, data) => received.push([path, data]))

        expect(spawnedPath).toMatch(/hid-input-helper\.exe$/)
        await nextTick()
        expect(spawned[0].commands).toEqual(["+hid#vid_0483&pid_2080&mi_00#7&2a5f5b2&0&0000"])

        // Split chunk arrival simulation
        spawned[0].stdout.write(`${RAW_INPUT_NAME}\t34\t8`)
        spawned[0].stdout.write("1\t2\n")
        await nextTick()
        expect(received).toEqual([[NODE_HID_PATH, [34, 81, 2]]])
    })

    it("manages helper lifecycle across multiple devices", async () => {
        const otherDevice = "\\\\?\\HID#VID_1111&PID_2222#1&abc&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}\\KBD"
        listenRawInputDevice(NODE_HID_PATH, () => {})
        listenRawInputDevice(otherDevice, () => {})
        expect(spawned).toHaveLength(1)

        closeRawInputDevice(otherDevice)
        await nextTick()
        expect(spawned[0].exitCode).toBe(null)

        closeRawInputDevice(NODE_HID_PATH)
        await nextTick()
        expect(spawned[0].exitCode).toBe(0)
    })
})
