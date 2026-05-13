import Bonjour, { type Service } from "bonjour-service"
import { type ChildProcess, spawn } from "child_process"
import crypto from "crypto"
import os from "os"
import { isMac } from ".."

// On macOS, bonjour-service (pure-JS mDNS) bypasses mDNSResponder and sends raw
// mDNS packets including host/A records. mDNSResponder detects this as a hostname
// conflict and renames the computer. Use the native dns-sd command instead.

const bonjour = isMac
    ? null
    : new Bonjour({}, (err: any) => {
          // might not have permission on macOS (System Settings > Privacy & Security > Network Access)
          // catch "send EHOSTUNREACH 224.0.0.251:5353" on macOS
          console.warn("Bonjour: An error occurred:", err.message)
      })

const ips = getLocalIPs()

const instanceID = crypto.randomBytes(3).toString("hex")
const publishedServices: Partial<Record<string, Service>> = {}
const dnsSdProcesses: Partial<Record<string, ChildProcess>> = {}

// check for existing freeshow services before publishing
function checkAndPublish(name: string, port: number, uniqueName: string, customData: any) {
    if (!bonjour) return

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
    if (!ips) {
        console.warn(`Bonjour: Skipping publish for ${name} - no network interface available`)
        return
    }

    const uniqueName = `freeshow-${name}-${instanceID}`

    if (isMac) {
        if (dnsSdProcesses[name]) return // already published
        publishViaDnsSd(name, port, uniqueName)
        return
    }

    if (!bonjour) return

    const previousService = publishedServices[name]
    if (previousService) return // already published (changes to data/port will require a restart)

    checkAndPublish(name, port, uniqueName, { ip: ips[0], ips })
}

export function unpublishPorts() {
    // On macOS, kill all dns-sd processes to unpublish services
    Object.keys(dnsSdProcesses).forEach((key) => {
        dnsSdProcesses[key]?.kill("SIGTERM")
        delete dnsSdProcesses[key]
    })

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

// On macOS, publish via dns-sd to use the native Bonjour stack, avoiding hostname conflicts with mDNSResponder
function publishViaDnsSd(name: string, port: number, uniqueName: string) {
    const ip = ips[0] ?? "localhost"
    const args = ["-R", uniqueName, "_freeshow._udp", "local", String(port), `ip=${ip}`, `ips=${ips.join(",")}`]

    try {
        const proc = spawn("dns-sd", args, { stdio: "ignore" })
        proc.on("error", (err) => console.warn(`Bonjour (dns-sd): Failed to publish ${name}:`, err.message))
        proc.on("exit", (code, signal) => {
            if (signal !== "SIGTERM" && signal !== "SIGKILL") {
                console.warn(`Bonjour (dns-sd): Process for ${name} exited unexpectedly (code=${code}, signal=${signal})`)
            }
            delete dnsSdProcesses[name]
        })
        dnsSdProcesses[name] = proc
        console.info(`Bonjour: Published '${uniqueName}' on port ${port} via dns-sd`)
    } catch (err) {
        console.warn(`Bonjour: Failed to spawn dns-sd for ${name}:`, err instanceof Error ? err.message : String(err))
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
