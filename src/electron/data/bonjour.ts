import Bonjour from "bonjour-service"
import os from "os"

const bonjour = new Bonjour()
const ip = getLocalIP()

// broadcast port over LAN
export function publishPort(name: string, port: number) {
    const customData = { ip }

    bonjour.publish({
        name,
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
