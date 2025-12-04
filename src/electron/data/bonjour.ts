import Bonjour, { type Bonjour as BonjourInstance } from "bonjour-service"
import crypto from "crypto"
import os from "os"

let bonjour: BonjourInstance | null = null
try {
    bonjour = new Bonjour()
} catch (err) {
    // likely no permission on macOS (System Settings > Privacy & Security > Network Access)
    console.warn("Bonjour: Failed to initialize:", err.message)
}

const ip = getLocalIP()

const instanceID = crypto.randomBytes(3).toString("hex")
const hostname = os.hostname()

// broadcast port over LAN
export function publishPort(name: string, port: number) {
    if (!bonjour) return
    if (!ip) {
        console.warn(`Bonjour: Skipping publish for ${name} - no network interface available`)
        return
    }

    // Format: computer-REMOTE-a4f2d9
    const uniqueName = `${hostname}-${name}-${instanceID}`
    const customData = { ip }

    try {
        bonjour.publish({
            name: uniqueName,
            type: "freeshow",
            protocol: "udp",
            port,
            txt: customData
        })
    } catch (err) {
        console.warn(`Bonjour: Failed to publish ${name} on port ${port}:`, err.message)
    }
}

export function unpublishPorts() {
    if (!bonjour) return

    try {
        bonjour.unpublishAll()
    } catch (err) {
        console.warn("Bonjour: Failed to unpublish ports:", err.message)
    }
}

/// HELPERS ///

function getLocalIP() {
    const interfaces = os.networkInterfaces()
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]!) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address
            }
        }
    }
    return ""
}
