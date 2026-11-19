import { get } from "svelte/store"
import { Main } from "../../../types/IPC/Main"
import type { Action } from "../../../types/Show"
import { sendMain } from "../../IPC/main"
import { actions } from "../../stores"
import { runAction } from "./actions"

const activePaths = new Set<string>()

export function hidInListen() {
    const required = new Set(
        Object.values(get(actions))
            .filter((a) => a.customActivation === "hid_input" && a.enabled !== false && a.hid?.device && a.hid?.data?.length)
            .map((a) => a.hid!.device!)
    )

    // Close unused devices
    activePaths.forEach((path) => {
        if (!required.has(path)) {
            sendMain(Main.CLOSE_HID, { path })
            activePaths.delete(path)
        }
    })

    // Listen to new devices
    required.forEach((path) => {
        if (!activePaths.has(path)) {
            sendMain(Main.RECEIVE_HID, { path })
            activePaths.add(path)
        }
    })
}

export function receivedHid(msg: { path?: string; data: number[] } | number[]) {
    const path = (msg as any)?.path?.toLowerCase()
    const data: number[] = Array.isArray(msg) ? msg : (msg as any)?.data || []
    if (!data.length) return

    Object.entries(get(actions)).forEach(([actionId, action]: [string, Action]) => {
        if (action.customActivation !== "hid_input" || action.enabled === false) return
        if (!action.hid?.device || !action.hid?.data?.length) return
        if (path && action.hid.device.toLowerCase() !== path) return

        const matches = action.hid.data.length === data.length && action.hid.data.every((v, i) => v === data[i])
        if (!matches) return

        runAction({ ...action, id: actionId }, { source: "hid" })
    })
}
