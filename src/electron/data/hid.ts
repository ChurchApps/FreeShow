import { type Device, devicesAsync, HID } from "node-hid"
import { ToMain } from "../../types/IPC/ToMain"
import { sendToMain } from "../IPC/main"

export function getHidDevices(): Promise<Device[]> {
    return new Promise(async (resolve) => {
        let devices = await devicesAsync()

        // remove unknown devices
        devices = devices.filter((a) => a.vendorId || a.productId)

        // remove duplicates
        // let existing: string[] = []
        // devices = devices.filter((a) => {
        //     const deviceId = a.vendorId + "_" + a.productId
        //     if (existing.includes(deviceId)) return false
        //     existing.push(deviceId)
        //     return true
        // })

        // remove devices not readable (might be in use by Windows)
        let filteredDevices: Device[] = []
        for (const device of devices) {
            if (await isReadable(device)) filteredDevices.push(device)
        }

        resolve(filteredDevices)
    })
}

async function isReadable(d: Device): Promise<boolean> {
    return new Promise((resolve) => {
        const device = new HID(d.path!)

        device.on("error", error)

        // needed to check for errors
        device.on("data", () => {})

        // give time to connect and check for connection errors
        // if no errors after 10 ms, close as valid
        setTimeout(valid, 10)

        let done = false
        function error() {
            if (done) return
            done = true
            device.close()
            resolve(false)
        }
        function valid() {
            if (done) return
            done = true
            device.close()
            resolve(true)
        }
    })
}

const devices: { [key: string]: HID } = {}
export function hidAwaitInput(data: { path: string }) {
    const deviceId = data.path
    if (devices[deviceId]) return

    const device = new HID(data.path)
    console.log("HID LISTENING: ", data.path)

    device.on("error", (err) => {
        console.log("HID ERROR:", err)
    })

    device.on("data", (data) => {
        console.log("HID RECEIVED DATA")
        sendToMain(ToMain.HID_DATA, data)
    })

    devices[deviceId] = device
}

export function hidClose(data: { path: string }) {
    const deviceId = data.path
    if (!devices[deviceId]) return

    devices[deviceId].close()
    delete devices[deviceId]
}
