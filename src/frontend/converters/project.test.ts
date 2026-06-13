import { describe, it, expect, vi, beforeEach } from "vitest"
import { get } from "svelte/store"

const historyCalls: any[] = []
vi.mock("../components/helpers/history", () => ({ history: (h: any) => historyCalls.push(h) }))
vi.mock("../components/helpers/show", () => ({ checkName: (n: string) => n }))
vi.mock("../components/helpers/media", () => ({ getExtension: (p: string) => p, getFileName: (p: string) => p, getMediaType: () => "image", removeExtension: (p: string) => p }))
vi.mock("../components/helpers/array", () => ({ keysToID: (o: any) => Object.entries(o || {}).map(([id, a]: any) => ({ ...a, id })) }))
vi.mock("../IPC/main", () => ({ sendMain: () => {} }))
vi.mock("../utils/language", () => ({ translateText: (id: string) => id }))
vi.mock("../utils/popup", () => ({ confirmCustom: async () => false }))
vi.mock("../utils/common", () => ({ newToast: () => {} }))

import { importProject } from "./project"
import { actions, effects, folders, media, overlays } from "../stores"

describe("importProject", () => {
    beforeEach(() => {
        historyCalls.length = 0
        overlays.set({} as any)
        effects.set({} as any)
        actions.set({} as any)
        media.set({} as any)
        folders.set({} as any)
    })

    it("distributes overlays/effects/actions/media into their stores", () => {
        const content = JSON.stringify({
            project: { id: "p1", name: "My Project" },
            shows: { s1: { name: "Show One" } },
            overlays: { o1: { name: "Overlay" } },
            effects: { e1: { name: "Effect" } },
            actions: { a1: { name: "Action" } },
            media: { "/img.png": { tags: ["x"] } }
        })
        importProject([{ content }])

        expect(get(overlays).o1).toEqual({ name: "Overlay" })
        expect(get(effects).e1).toEqual({ name: "Effect" })
        expect(get(actions).a1).toEqual({ name: "Action" })
        expect(get(media)["/img.png"]).toMatchObject({ tags: ["x"] })
    })

    it("creates the shows and the project through history", () => {
        const content = JSON.stringify({ project: { id: "p1", name: "My Project" }, shows: { s1: { name: "Show One" } } })
        importProject([{ content }])

        const showsCall = historyCalls.find((h) => h.id === "SHOWS")
        expect(showsCall.newData.data).toEqual([{ id: "s1", show: { name: "Show One" } }])
        expect(showsCall.newData.projectImport).toBe(true)

        const projectCall = historyCalls.find((h) => h.id === "UPDATE")
        expect(projectCall.newData.data).toMatchObject({ name: "My Project" })
        expect(projectCall.newData.data.id).toBeUndefined()
        expect(projectCall.oldData.id).toBe("p1")
    })
})
