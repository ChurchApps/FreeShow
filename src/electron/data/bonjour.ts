import Bonjour from "bonjour-service"
import crypto from "crypto"
import os from "os"

const bonjour = new Bonjour()
const ip = getLocalIP()

const instanceID = crypto.randomBytes(3).toString("hex")
const hostname = os.hostname()

// broadcast port over LAN
export function publishPort(name: string, port: number) {
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
        // Likely no permission on macOS (System Settings > Privacy & Security > Network Access)
        console.warn(`Bonjour: Failed to publish ${name} on port ${port}:`, err instanceof Error ? err.message : err)
    }
}

export function unpublishPorts() {
    try {
        bonjour.unpublishAll()
    } catch (err) {
        console.warn("Bonjour: Failed to unpublish ports:", err instanceof Error ? err.message : err)
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
