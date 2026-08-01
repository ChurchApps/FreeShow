// ----- FreeShow -----
// Hybrid transport for a DESKTOP client connected to a remote server.
//
// Show/library content + co-editing go to the REMOTE server; presentation, output,
// hardware, file system and machine config stay on the LOCAL Electron main. The
// split is defined entirely in ./routing.ts (the single source of truth) so it's
// clear to devs which channel goes where.

import type { FreeShowApi } from "./types"
import { REMOTE_SAVE_KEYS, routeChannel } from "./routing"

const SAVE = "SAVE"
const SAVE_CONTROL_KEYS = ["closeWhenFinished", "customTriggers"]

// the batched SaveData carries both resource and machine stores; split it so each side
// persists its own slice.
function splitSaveData(saveData: Record<string, any>) {
    const remoteData: Record<string, any> = {}
    const localData: Record<string, any> = {}
    for (const [key, value] of Object.entries(saveData)) {
        if (SAVE_CONTROL_KEYS.includes(key)) continue
        if (REMOTE_SAVE_KEYS.includes(key)) remoteData[key] = value
        else localData[key] = value
    }
    // control flags go to both sides
    for (const key of SAVE_CONTROL_KEYS) {
        if (key in saveData) {
            remoteData[key] = saveData[key]
            localData[key] = saveData[key]
        }
    }
    return { remoteData, localData }
}

export function createHybridApi(local: FreeShowApi, remote: FreeShowApi): FreeShowApi {
    return {
        send(channel: string, data?: any, id?: string) {
            // split the batched SAVE across both sides (resource stores -> server, machine -> local)
            if (channel === "MAIN" && data?.channel === SAVE && data?.data) {
                const { remoteData, localData } = splitSaveData(data.data)
                remote.send(channel, { channel: SAVE, data: remoteData }, id)
                local.send(channel, { channel: SAVE, data: localData }, id)
                return
            }

            const target = routeChannel(channel, data?.channel) === "remote" ? remote : local
            target.send(channel, data, id)
        },
        receive(channel: string, func: any, id?: string) {
            // STARTUP (and thus capabilities) comes from the LOCAL main so a connected
            // desktop keeps FULL desktop capabilities (it can still present locally).
            if (channel === "STARTUP") {
                local.receive(channel, func, id)
                return
            }
            // register on both sides; only the side a message was routed to will reply,
            // so the correct handler fires without double-dispatch for request/response.
            local.receive(channel, func, id)
            remote.receive(channel, func, id)
        },
        removeListener(channel: string, id: string) {
            local.removeListener(channel, id)
            remote.removeListener(channel, id)
        },
        getListeners() {
            return [...local.getListeners(), ...remote.getListeners()]
        },
        showFilePath(file: File) {
            return local.showFilePath(file)
        }
    }
}
