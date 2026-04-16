import Bonjour, { type Service } from "bonjour-service"
import crypto from "crypto"
import os from "os"

const bonjour = new Bonjour({}, (err: any) => {
    // might not have permission on macOS (System Settings > Privacy & Security > Network Access)
    // catch "send EHOSTUNREACH 224.0.0.251:5353" on macOS
    console.warn("Bonjour: An error occurred:", err.message)
})

const ips = getLocalIPs()

const instanceID = crypto.randomBytes(3).toString("hex")
const publishedServices: Partial<Record<string, Service>> = {}

// check for existing freeshow services before publishing
function checkAndPublish(name: string, port: number, uniqueName: string, customData: any) {
    let found = false
    const browser = bonjour.find({ type: "freeshow", protocol: "udp" }, (service: any) => {
        if (service.name.startsWith(`freeshow-${name}-`)) {
            found = true
            console.warn(`Bonjour: A service named 'freeshow-${name}-*' is already published on the network.`)
            browser.stop()
        }
    })

    setTimeout(() => {
        if (found) return

        try {
            publishedServices[name] = bonjour.publish({
                name: uniqueName,
                type: "freeshow",
                protocol: "udp",
                port,
                txt: customData
            })

            console.info(`Bonjour: Published '${uniqueName}' on port ${port}`)
        } catch (err) {
            console.warn(`Bonjour: Failed to publish ${name} on port ${port}:`, err instanceof Error ? err.message : String(err))
        }

        browser.stop()
    }, 1000)
}

// broadcast port over LAN
export function publishPort(name: string, port: number) {
    if (!bonjour) return
    if (!ips) {
        console.warn(`Bonjour: Skipping publish for ${name} - no network interface available`)
        return
    }

    const uniqueName = `freeshow-${name}-${instanceID}`
    const customData = { ip: ips[0], ips }

    const previousService = publishedServices[name]
    if (previousService) return // already published (changes to data/port will require a restart)

    checkAndPublish(name, port, uniqueName, customData)
}

export function unpublishPorts() {
    if (!bonjour) return

    try {
        Object.keys(publishedServices).forEach((key) => {
            const service = publishedServices[key]
            if (service?.stop) {
                service.stop((err?: Error) => {
                    if (err) console.warn(`Bonjour: Failed to stop service '${key}':`, err.message)
                })
            }

            delete publishedServices[key]
        })

        bonjour.unpublishAll((err?: Error) => {
            if (err) console.warn("Bonjour: Failed to unpublish all services:", err.message)
        })
    } catch (err) {
        console.warn("Bonjour: Failed to unpublish ports:", err instanceof Error ? err.message : String(err))
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

    return [...(results.en0 || []), ...(results.eth0 || []), ...(results["Wi-Fi"] || []), ...Object.values(results).flat(), "localhost"]
}
