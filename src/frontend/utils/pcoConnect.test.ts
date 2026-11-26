import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => {
    const makeStore = (initial: any) => {
        let value = initial
        return {
            set: (v: any) => (value = v),
            update: (fn: (v: any) => any) => (value = fn(value)),
            subscribe: (fn: (v: any) => void) => (fn(value), () => {})
        }
    }
    return { activePopup: makeStore(null), contentProviderData: makeStore({}), saved: makeStore(true), sendMain: vi.fn() }
})
vi.mock("../stores", () => ({ activePopup: h.activePopup, contentProviderData: h.contentProviderData, saved: h.saved }))
vi.mock("../IPC/main", () => ({ sendMain: h.sendMain }))

import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { connectPlanningCenter, isPcoSyncModePending, promptPcoSyncMode, startFirstPcoSync } from "./pcoConnect"

describe("Planning Center first sync", () => {
    beforeEach(() => {
        h.activePopup.set(null)
        h.contentProviderData.set({ planningcenter: { syncFolderIds: ["f1"], songOrigin: "online" } })
        h.sendMain.mockClear()
    })

    it("only authorizes when connecting, and waits for a sync mode", () => {
        connectPlanningCenter()

        expect(h.sendMain).toHaveBeenCalledTimes(1)
        expect(h.sendMain).toHaveBeenCalledWith(Main.PROVIDER_LOAD_SERVICES, { providerId: "planningcenter", connectScope: "services" })
        expect(isPcoSyncModePending()).toBe(true)
    })

    it("asks for the mode only while it is pending", () => {
        expect(promptPcoSyncMode()).toBe(false)
        expect(get(h.activePopup as any)).toBe(null)

        connectPlanningCenter()

        expect(promptPcoSyncMode()).toBe(true)
        expect(get(h.activePopup as any)).toBe("pco_sync_mode")
    })

    it("syncs with the chosen mode", () => {
        connectPlanningCenter()
        h.sendMain.mockClear()
        startFirstPcoSync("placeholder")

        expect(h.sendMain).toHaveBeenCalledWith(Main.PROVIDER_LOAD_SERVICES, { providerId: "planningcenter", data: { syncFolderIds: ["f1"], songOrigin: "placeholder" } })
        expect(isPcoSyncModePending()).toBe(false)
        expect((get(h.contentProviderData as any) as any).planningcenter.songOrigin).toBe("placeholder")
        expect(get(h.activePopup as any)).toBe(null)
    })
})
