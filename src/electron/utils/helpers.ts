import { machineIdSync } from "node-machine-id"
import os from "os"

// clone objects
export function clone<T>(object: T): T {
    if (typeof object !== "object") return object
    return JSON.parse(JSON.stringify(object))
}

// a few keys might not be placed in the same order in JS object vs store file
export function checkIfMatching(a: any, b: any): boolean {
    try {
        if (!a || !b || typeof a !== "object" || typeof b !== "object") return false
        return JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())
    } catch (err) {
        console.warn("Failed to compare store data:", err)
        return false
    }
}

// async wait (instead of timeouts)
export function wait(ms: number) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve("ended")
        }, Number(ms))
    })
}

// wait until input value is true
export function waitUntilValueIsDefined(value: () => any, intervalTime = 50, timeoutValue = 5000) {
    return new Promise((resolve) => {
        let currentValue = value()
        if (currentValue) resolve(currentValue)

        const timeout = setTimeout(() => {
            exit()
            resolve(null)
        }, timeoutValue)

        const interval = setInterval(() => {
            currentValue = value()
            if (!currentValue) return

            exit()
            resolve(currentValue)
        }, intervalTime)

        function exit() {
            clearTimeout(timeout)
            clearInterval(interval)
        }
    })
}

export function getMachineId(): string {
    try {
        return machineIdSync()
    } catch (err) {
        console.warn("Could not get machine ID:", err)

        // fallback to a hash of hostname + username + platform
        const crypto = require("crypto")
        const fallbackId = `${os.hostname()}-${os.userInfo().username}-${os.platform()}`
        return crypto.createHash("sha256").update(fallbackId).digest("hex")
    }
}
