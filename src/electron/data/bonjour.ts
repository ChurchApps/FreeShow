import Bonjour from "bonjour-service"
import crypto from "crypto"
import os from "os"

const bonjour = new Bonjour({}, (err: any) => {
    // might not have permission on macOS (System Settings > Privacy & Security > Network Access)
    // catch "send EHOSTUNREACH 224.0.0.251:5353" on macOS
    console.warn("Bonjour: An error occurred:", err.message)
})

const ips = getLocalIPs()

const instanceID = crypto.randomBytes(3).toString("hex")
const hostname = os.hostname()

// broadcast port over LAN
export function publishPort(name: string, port: number) {
    if (!bonjour) return
    if (!ips) {
        console.warn(`Bonjour: Skipping publish for ${name} - no network interface available`)
        return
    }

    // Format: computer-REMOTE-a4f2d9
    const uniqueName = `${hostname}-${name}-${instanceID}`
    const customData = { ip: ips[0], ips }

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

export function getLocalIPs() {
    const interfaces = os.networkInterfaces()
    const results: Record<string, string[]> = {}

    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name] || []) {
            if (net.internal) continue

            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
            const familyV4Value = typeof net.family === "string" ? "IPv4" : 4
            if (net.family !== familyV4Value) continue

            if (!results[name]) results[name] = []
            results[name].push(net.address)
        }
    }

    return [...(results["en0"] || []), ...(results["eth0"] || []), ...(results["Wi-Fi"] || []), ...Object.values(results).flat(), "localhost"]
}
