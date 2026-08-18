import { get } from "svelte/store"
import { Main } from "../../../types/IPC/Main"
import type { Action } from "../../../types/Show"
import { sendMain } from "../../IPC/main"
import { actions } from "../../stores"
import { runAction } from "./actions"

export const activeHidPaths = new Set<string>()

export function hidInListen() {
    const requiredPaths = new Set<string>()

    Object.entries(get(actions)).forEach(([_id, action]: [string, Action]) => {
        if (action.customActivation !== "hid_input") return
        if (action.enabled === false) return
        if (!action.hid?.device) return
        if (!action.hid?.data?.length) return

        requiredPaths.add(action.hid.device)
    })

    // Close paths that are no longer needed
    for (const path of activeHidPaths) {
        if (!requiredPaths.has(path)) {
            sendMain(Main.CLOSE_HID, { path })
            activeHidPaths.delete(path)
        }
    }

    // Start listening on newly required paths
    for (const path of requiredPaths) {
        if (!activeHidPaths.has(path)) {
            sendMain(Main.RECEIVE_HID, { path })
            activeHidPaths.add(path)
        }
    }
}

const lastActionTriggerTime: Record<string, number> = {}

export function receivedHid(msg: { path?: string; data: number[] } | number[]) {
    const path = (msg as any)?.path
    const data: number[] = Array.isArray(msg) ? msg : (msg as any)?.data || []
    if (!data.length) return

    const now = Date.now()

    Object.entries(get(actions)).forEach(([actionId, action]: [string, Action]) => {
        if (action.customActivation !== "hid_input") return
        if (action.enabled === false) return
        if (!action.hid?.device || !action.hid?.data?.length) return

        // match device path strictly (case-insensitive)
        if (path && action.hid.device.toLowerCase() !== path.toLowerCase()) return

        // match data bytes strictly
        const matches = action.hid.data.length === data.length && action.hid.data.every((val, idx) => val === data[idx])
        if (!matches) return

        // Debounce action execution: max once per 400ms per action
        const lastTime = lastActionTriggerTime[actionId] || 0
        if (now - lastTime < 400) return
        lastActionTriggerTime[actionId] = now

        runAction(action, { source: "hid" })
    })
}
