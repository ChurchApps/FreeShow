import Bonjour from "bonjour-service"
import crypto from "crypto"
import os from "os"

const bonjour = new Bonjour()
const ip = getLocalIP()

const instanceID = crypto.randomBytes(3).toString("hex")
const hostname = os.hostname()

// broadcast port over LAN
export function publishPort(name: string, port: number) {
    // Format: computer-REMOTE-a4f2d9
    const uniqueName = `${hostname}-${name}-${instanceID}`
    const customData = { ip }

    bonjour.publish({
        name: uniqueName,
        type: "freeshow",
        protocol: "udp",
        port,
        txt: customData,
    })
}

export function unpublishPorts() {
    bonjour.unpublishAll()
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
