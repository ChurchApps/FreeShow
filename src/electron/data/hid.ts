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
        devices = devices.filter(isReadable)

        resolve(devices)
    })
}

function isReadable(d: Device) {
    return true
    console.log(d)
    // THIS DID NOT WORK
    // try {
    //     const device = new HID(d.path!)
    //     device.close()
    //     return true
    // } catch (err) {
    //     return false
    // }
}

const devices: { [key: string]: HID } = {}
export function hidAwaitInput(data: { path: string }) {
    const deviceId = data.path
    if (devices[deviceId]) return

    const device = new HID(data.path)
    console.log("HID LISTENING: ", data.path)

    // try {
    device.on("data", (data) => {
        console.log("HID RECEIVED DATA")
        sendToMain(ToMain.HID_DATA, data)
    })
    // } catch (err) {
    //     console.log("HID ERROR:", err)
    // }

    devices[deviceId] = device
}

export function hidClose(data: { path: string }) {
    const deviceId = data.path
    if (!devices[deviceId]) return

    devices[deviceId].close()
    delete devices[deviceId]
}
