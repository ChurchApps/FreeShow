// ----- GPU device selection + runtime GPU health check -----
// - applyGraphicsDeviceSelection(): applies the persisted "Graphics device" setting as command-line
//   switches before app "ready" (a change requires restart, like the hardware-acceleration toggle)
// - listGraphicsDevices(): enumerates selectable devices for the Settings dropdown
// - scheduleGpuHealthCheck(): ~20s after ready (getGPUFeatureStatus is premature at ready), compares
//   the actual GPU state against the user's intent and raises one notification on degradation
//
// Per-platform selection mechanism:
//   Linux — --render-node-override pins the GPU process to a DRM render node (the switch Chromium
//     itself uses); nodes enumerated from /dev/dri, named via sysfs PCI ids.
//   macOS — force_high_performance_gpu / force_low_power_gpu, a discrete-vs-integrated preference,
//     offered only on dual-GPU machines.
//   Windows — no selector: adapter LUIDs change every boot so a persisted value goes stale; the
//     OS per-app GPU preference (Settings > Display > Graphics) is the right mechanism there.

import { app } from "electron"
import fs from "fs"
import path from "path"
import { ToMain } from "../../types/IPC/ToMain"
import { config } from "../data/store"
import { getMainWindow, hardwareAccelerationDisabled, isLinux, isMac } from "../index"
import { sendToMain } from "../IPC/main"

// Universal PCI vendor ids (not machine-specific — these are the registry-assigned constants)
const PCI_VENDOR_NAMES: { [id: number]: string } = {
    0x8086: "Intel",
    0x10de: "NVIDIA",
    0x1002: "AMD",
    0x1af4: "VirtIO",
    0x15ad: "VMware",
    0x5143: "Qualcomm"
}

// suggested VA-API driver package per vendor (Ubuntu/Debian names)
function vaPackagesFor(vendorName: string): string[] {
    if (vendorName === "Intel") return ["intel-media-va-driver-non-free"]
    if (vendorName === "AMD") return ["mesa-va-drivers"]
    if (vendorName === "NVIDIA") return ["nvidia-vaapi-driver"]
    return ["intel-media-va-driver-non-free", "mesa-va-drivers"]
}

export type GraphicsDeviceOption = { value: string; label: string }

// ---- enumeration (Settings dropdown; called over IPC after the app is fully up) ----

// Linux: /dev/dri/renderD* -> human name via sysfs PCI vendor/device ids. Returns [] when there is nothing
// meaningful to choose (0-1 nodes) so the frontend hides the selector instead of shipping a dead control.
function listLinuxRenderNodes(): GraphicsDeviceOption[] {
    let nodes: string[] = []
    try {
        nodes = fs.readdirSync("/dev/dri").filter((n) => /^renderD\d+$/.test(n))
    } catch {
        return []
    }
    nodes.sort((a, b) => parseInt(a.slice(7), 10) - parseInt(b.slice(7), 10))
    const options = nodes.map((node) => {
        let label = node
        try {
            const devDir = `/sys/class/drm/${node}/device`
            const readHex = (f: string) => parseInt(fs.readFileSync(path.join(devDir, f), "utf8").trim(), 16)
            const vendorId = readHex("vendor")
            const deviceId = readHex("device")
            const vendor = PCI_VENDOR_NAMES[vendorId] || `0x${vendorId.toString(16)}`
            label = `${vendor} GPU (${node}, ${vendorId.toString(16)}:${deviceId.toString(16)})`
        } catch {
            // sysfs unreadable: keep the bare node name (still selectable)
        }
        return { value: `/dev/dri/${node}`, label }
    })
    // a single render node offers no real choice — "Auto" is already correct; hide the selector
    return options.length >= 2 ? options : []
}

// macOS: only a power PREFERENCE exists (see the header). Offered only on actual dual-GPU machines.
async function listMacGpuPreferences(): Promise<GraphicsDeviceOption[]> {
    try {
        const info: any = await app.getGPUInfo("basic")
        const devices = info?.gpuDevice || []
        if (devices.length < 2) return []
        return [
            { value: "high-performance", label: "" }, // labels are i18n'd in the frontend (settings.gpu_high_performance)
            { value: "low-power", label: "" }
        ]
    } catch {
        return []
    }
}

export async function listGraphicsDevices(): Promise<GraphicsDeviceOption[]> {
    if (isLinux) return listLinuxRenderNodes()
    if (isMac) return await listMacGpuPreferences()
    return [] // Windows: no reliable persistable mechanism (see header) — selector not shown
}

// ---- application (BEFORE app ready; switches must precede GPU process launch) ----

export function applyGraphicsDeviceSelection() {
    if (config.get("disableHardwareAcceleration") === true) return // no GPU process to pin

    const configured = (config.get("graphicsDevice") as string | null) || ""

    if (isLinux) {
        // env override kept as a no-rebuild debugging lever; the Settings value is the product mechanism
        const node = process.env.FS_LINUX_RENDER_NODE || configured
        if (!node) return
        if (!/^\/dev\/dri\/renderD\d+$/.test(node)) {
            console.warn(`[GPU] configured graphics device "${node}" is not a DRM render node path, using auto`)
            return
        }
        if (!fs.existsSync(node)) {
            // device gone (eGPU unplugged, hardware change): fall back to auto instead of a dead GPU process
            console.warn(`[GPU] configured graphics device ${node} does not exist on this system, using auto`)
            return
        }
        app.commandLine.appendSwitch("render-node-override", node)
        console.info(`[GPU] pinning GPU process DRM render node: --render-node-override=${node}${process.env.FS_LINUX_RENDER_NODE ? " (from FS_LINUX_RENDER_NODE)" : ""}`)
        return
    }

    if (isMac) {
        if (configured === "high-performance") {
            app.commandLine.appendSwitch("force_high_performance_gpu")
            console.info("[GPU] forcing high-performance GPU preference (--force_high_performance_gpu)")
        } else if (configured === "low-power") {
            app.commandLine.appendSwitch("force_low_power_gpu")
            console.info("[GPU] forcing low-power GPU preference (--force_low_power_gpu)")
        }
    }
    // Windows: nothing to apply (see header)
}

// ---- runtime health check -> verbose user notification ----

// hardware video decode needs a *_drv_video.so VA driver; many installs (e.g. Ubuntu live ISOs) ship none
const VA_DRIVER_DIRS = ["/usr/lib/x86_64-linux-gnu/dri", "/usr/lib/aarch64-linux-gnu/dri", "/usr/lib/dri", "/usr/lib64/dri", "/usr/local/lib/dri"]
function findVaDrivers(): string[] {
    const found: string[] = []
    for (const dir of VA_DRIVER_DIRS) {
        try {
            for (const f of fs.readdirSync(dir)) if (f.endsWith("_drv_video.so")) found.push(f)
        } catch {
            // dir absent — expected on most systems
        }
    }
    return found
}

// "enabled..." / "hardware..." = real hardware; everything else (disabled_software, unavailable_off,
// disabled_off_ok, ...) is a software fallback or off.
function isHardware(status: string | undefined): boolean {
    return !!status && /^(enabled|hardware)/.test(status)
}

let healthNotified = false // at most one notification per session

export function scheduleGpuHealthCheck() {
    // deliberate user choice: with HWA disabled software rendering IS the intent — never nag about it
    if (hardwareAccelerationDisabled) return

    // ~20s: past the premature at-ready window but early enough to read as a startup notice;
    // retries a few times if the frontend isn't loaded yet
    let attempts = 0
    const attempt = () => {
        const win = getMainWindow()
        if ((!win || win.webContents.isLoading()) && ++attempts < 10) {
            setTimeout(attempt, 5000)
            return
        }
        runGpuHealthCheck().catch((err) => console.warn("[GPU-HEALTH] check failed:", err))
    }
    setTimeout(attempt, 20_000)
}

// The authoritative "will video hardware-decode?" answer: mediaCapabilities.decodingInfo reports
// powerEfficient from the GPU process's actual enumerated decoder profiles. This is the only signal
// that survives our own VaapiIgnoreDriverChecks (which makes the video_decode FEATURE status read
// "enabled" even on driverless systems) and driver files on disk that don't serve the active GPU
// (e.g. Ubuntu's default mesa-va-drivers on an Intel iGPU that needs iHD). Returns null when the
// probe itself fails, so the caller can fall back to the weaker signals instead of a false alarm.
async function probeHardwareDecode(): Promise<boolean | null> {
    const win = getMainWindow()
    if (!win || win.webContents.isLoading()) return null
    try {
        const result = await win.webContents.executeJavaScript(
            `navigator.mediaCapabilities.decodingInfo({
                type: "file",
                video: { contentType: 'video/mp4; codecs="avc1.640028"', width: 1920, height: 1080, bitrate: 8000000, framerate: 30 }
            }).then((r) => !!r.powerEfficient).catch(() => null)`,
            true
        )
        return typeof result === "boolean" ? result : null
    } catch {
        return null
    }
}

// whether any installed VA driver actually serves this vendor's GPU (Gallium drivers for other
// vendors don't count — Ubuntu ships several by default)
function vendorVaDriverPresent(vendorName: string, drivers: string[]): boolean {
    if (vendorName === "Intel") return drivers.some((d) => /^(iHD|i965)/.test(d))
    if (vendorName === "AMD") return drivers.some((d) => /^(radeonsi|r600)/.test(d))
    if (vendorName === "NVIDIA") return drivers.some((d) => /^(nvidia|vdpau)/.test(d))
    return drivers.length > 0
}

async function runGpuHealthCheck() {
    if (healthNotified) return

    let status: Record<string, string> = {}
    try {
        status = app.getGPUFeatureStatus() as unknown as Record<string, string>
    } catch (err) {
        console.warn("[GPU-HEALTH] getGPUFeatureStatus failed:", err)
        return
    }

    const compositingHw = isHardware(status.gpu_compositing)
    const statusDecodeHw = isHardware(status.video_decode)
    const hwDecodeProbe = await probeHardwareDecode()
    // probe verdict wins; when it couldn't run, fall back to the (optimistic) feature status
    const videoDecodeHw = hwDecodeProbe !== null ? hwDecodeProbe : statusDecodeHw

    if (compositingHw && videoDecodeHw) {
        console.info(`[GPU-HEALTH] healthy: hardware compositing + hardware video decode (probe=${hwDecodeProbe ?? "unavailable"})`)
        return
    }

    // active GPU vendor (for the VA package suggestion + naming the device in the message)
    let vendorName = ""
    try {
        const info: any = await app.getGPUInfo("basic")
        const d = info?.gpuDevice?.find((g: any) => g.active) ?? info?.gpuDevice?.[0]
        vendorName = PCI_VENDOR_NAMES[d?.vendorId] || info?.auxAttributes?.glVendor || ""
    } catch {
        // vendor stays unknown; the notification still fires
    }

    // compositing dead = GPU init failed entirely; otherwise compositing is fine but video decode is
    // software (a few CPU cores per 4K60 stream — choppy playback, starved outputs)
    const issue: "compositing" | "video-decode" = compositingHw ? "video-decode" : "compositing"

    // driver scan feeds the remediation message only (the probe already decided the verdict)
    let vaDriverMissing = false
    let packages: string[] = []
    if (isLinux) {
        const drivers = findVaDrivers()
        vaDriverMissing = !vendorVaDriverPresent(vendorName, drivers)
        if (vaDriverMissing) packages = vaPackagesFor(vendorName)
        console.info(`[GPU-HEALTH] VA drivers found: ${drivers.length ? drivers.join(", ") : "NONE"} (vendor=${vendorName || "?"} match=${!vaDriverMissing})`)
    }

    healthNotified = true
    console.info(`[GPU-HEALTH] degraded: issue=${issue} gpu_compositing=${status.gpu_compositing} video_decode=${status.video_decode} probe=${hwDecodeProbe ?? "unavailable"} vendor=${vendorName || "?"} vaDriverMissing=${vaDriverMissing}`)
    sendToMain(ToMain.GPU_HEALTH, { issue, platform: process.platform, vendorName, vaDriverMissing, packages })
}
