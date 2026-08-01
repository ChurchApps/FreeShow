// ----- FreeShow -----
// Transport installation: choose which `window.api` implementation the frontend
// uses, and install it before startup() runs.
//
// Selection order:
//   1. Web build (VITE_TARGET === "web")            -> Socket.IO to the serving origin
//   2. Desktop with a persisted remote connection   -> Socket.IO to that server (Phase 3 GUI)
//   3. Otherwise (desktop default)                   -> Electron IPC (preload's window.api)

import { connectionStatus } from "../../stores"
import { getElectronApi } from "./electronTransport"
import { createHybridApi } from "./hybridTransport"
import { createSocketApi } from "./socketTransport"
import type { FreeShowApi } from "./types"

const onStatus = (status: "connected" | "disconnected" | "reconnecting") => connectionStatus.set(status)

// Local, NON-synced storage for a desktop -> remote-server connection.
// Kept in localStorage (never the synced data folder) so credentials don't propagate to other devices.
const REMOTE_SERVER_KEY = "freeshow_remote_server"

interface RemoteServerConfig {
    enabled: boolean
    url: string
    token?: string
}

export function getRemoteServerConfig(): RemoteServerConfig | null {
    try {
        const raw = typeof localStorage !== "undefined" ? localStorage.getItem(REMOTE_SERVER_KEY) : null
        if (!raw) return null
        const config = JSON.parse(raw) as RemoteServerConfig
        return config?.enabled && config.url ? config : null
    } catch {
        return null
    }
}

export function setRemoteServerConfig(config: RemoteServerConfig | null) {
    if (typeof localStorage === "undefined") return
    if (!config) localStorage.removeItem(REMOTE_SERVER_KEY)
    else localStorage.setItem(REMOTE_SERVER_KEY, JSON.stringify(config))
}

/** Returns true if this frontend is running against a Socket.IO backend (web build or remote desktop). */
export function isSocketTransport(): boolean {
    const isWeb = (import.meta as any).env?.VITE_TARGET === "web"
    return isWeb || !!getRemoteServerConfig()
}

// safely set window.api. In Electron the preload now exposes the IPC bridge as
// `window.electronAPI` (not `window.api`), so `window.api` is a normal writable
// property. The try/catch guards against an older preload that made window.api
// read-only via contextBridge (in which case the existing IPC api is kept).
function setWindowApi(api: FreeShowApi) {
    try {
        window.api = api
    } catch (err) {
        console.error("Could not set window.api (read-only preload?). Rebuild the app so preload exposes electronAPI.", err)
    }
}

export function installTransport() {
    const isWeb = (import.meta as any).env?.VITE_TARGET === "web"

    // 1. Web build: connect to the origin that served the bundle.
    if (isWeb) {
        setWindowApi(createSocketApi({ onStatus }))
        return
    }

    // 2. Desktop configured (via GUI) to use a remote server: HYBRID transport.
    //    Library/show data + co-editing -> remote server; hardware/output/present +
    //    machine config -> local Electron IPC. See ./routing.ts for the exact split.
    const remote = getRemoteServerConfig()
    if (remote) {
        const socket = createSocketApi({ url: remote.url, auth: remote.token ? { token: remote.token } : undefined, onStatus })
        const local = getElectronApi()
        setWindowApi(local ? createHybridApi(local, socket) : socket)
        return
    }

    // 3. Desktop default: install the Electron IPC bridge (window.electronAPI) onto window.api.
    const electronApi = getElectronApi()
    if (electronApi && window.api !== electronApi) setWindowApi(electronApi)
}
