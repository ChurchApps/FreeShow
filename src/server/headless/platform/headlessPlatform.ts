// ----- FreeShow -----
// Headless platform: portable persistence + lightweight device info, with all
// desktop-only capabilities disabled (HEADLESS_CAPABILITIES).

import { createHash } from "crypto"
import fs from "fs"
import os from "os"
import path from "path"
import { HEADLESS_CAPABILITIES } from "../../../shared/platform/capabilities"
import type { Platform } from "../../../shared/platform/Platform"
import { headlessPersistence } from "../data/persistence"

function getLocalIPs() {
    const nets = os.networkInterfaces()
    const results: { name: string; address: string }[] = []
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            if (net.family === "IPv4" && !net.internal) results.push({ name, address: net.address })
        }
    }
    return results
}

// the app version comes from package.json so the web client reports the same version as
// the desktop build it was built from (walk up: build/headless/server/headless -> repo root)
let cachedVersion = ""
function getAppVersion(): string {
    if (cachedVersion) return cachedVersion
    if (process.env.FREESHOW_VERSION) return (cachedVersion = process.env.FREESHOW_VERSION)

    let dir = __dirname
    for (let i = 0; i < 8; i++) {
        try {
            const pkg = path.join(dir, "package.json")
            if (fs.existsSync(pkg)) {
                const version = JSON.parse(fs.readFileSync(pkg, "utf8"))?.version
                if (version) return (cachedVersion = version)
            }
        } catch {
            // keep walking up
        }
        const parent = path.dirname(dir)
        if (parent === dir) break
        dir = parent
    }

    return (cachedVersion = "0.0.0")
}

export const headlessPlatform: Platform = {
    id: "headless",
    capabilities: HEADLESS_CAPABILITIES,
    data: headlessPersistence,
    getVersion: getAppVersion,
    getOS: () => ({ platform: process.platform, name: os.hostname(), arch: process.arch }),
    getDeviceId: () => createHash("sha256").update(os.hostname() + os.platform()).digest("hex").slice(0, 16),
    getDeviceName: () => os.hostname(),
    getLocalIPs
}
