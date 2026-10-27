import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => {
    const makeStore = (initial: any) => {
        let value = initial
        return {
            _get: () => value,
            _set: (v: any) => (value = v),
            set: (v: any) => (value = v),
            update: (fn: (v: any) => any) => (value = fn(value)),
            subscribe: (fn: (v: any) => void) => {
                fn(value)
                return () => undefined
            }
        }
    }

    return {
        folders: makeStore({}),
        categories: makeStore({}),
        overlays: makeStore({}),
        effects: makeStore({}),
        actions: makeStore({}),
        media: makeStore({}),
        playerVideos: makeStore({}),
        projects: makeStore({}),
        projectTemplates: makeStore({}),
        activePopup: makeStore(null),
        alertMessage: makeStore(""),
        activePage: makeStore("show"),
        activeProject: makeStore(""),
        activeShow: makeStore(null),
        editingProjectTemplate: makeStore(""),
        focusMode: makeStore(false),
        projectView: makeStore(false),
        recentFiles: makeStore([])
    }
})

vi.mock("../stores", () => ({
    actions: h.actions,
    activePage: h.activePage,
    activePopup: h.activePopup,
    activeProject: h.activeProject,
    activeShow: h.activeShow,
    alertMessage: h.alertMessage,
    categories: h.categories,
    editingProjectTemplate: h.editingProjectTemplate,
    effects: h.effects,
    focusMode: h.focusMode,
    folders: h.folders,
    media: h.media,
    overlays: h.overlays,
    playerVideos: h.playerVideos,
    projects: h.projects,
    projectTemplates: h.projectTemplates,
    projectView: h.projectView,
    recentFiles: h.recentFiles
}))

vi.mock("../components/helpers/history", () => ({
    history: vi.fn()
}))

vi.mock("../components/helpers/show", () => ({
    checkName: (name: string) => name
}))

vi.mock("../components/helpers/media", () => ({
    getExtension: (path: string) => path.split(".").pop() || "",
    getFileName: (path: string) => path.split("/").pop()?.split("\\").pop() || "",
    getMediaType: () => "video",
    removeExtension: (name: string) => name.replace(/\.[^/.]+$/, "")
}))

vi.mock("../IPC/main", () => ({
    sendMain: vi.fn()
}))

vi.mock("../utils/common", () => ({
    newToast: vi.fn()
}))

vi.mock("../utils/language", () => ({
    translateText: (k: string) => k
}))

vi.mock("../utils/popup", () => ({
    confirmCustom: vi.fn()
}))

import { importProject } from "./project"

describe("importProject - player videos handling (Issue 3928)", () => {
    beforeEach(() => {
        h.playerVideos._set({})
        h.folders._set({})
    })

    it("imports player videos present in project.shows into playerVideos store", () => {
        const projectContent = JSON.stringify({
            project: {
                id: "proj_1",
                name: "Sunday Service",
                shows: [
                    {
                        id: "player_uuid_1",
                        name: "Worship Song Video",
                        type: "player",
                        data: {
                            id: "dQw4w9WgXcQ",
                            name: "Worship Song Video",
                            type: "youtube"
                        }
                    }
                ]
            },
            shows: {}
        })

        importProject([{ content: projectContent }])

        const stored = h.playerVideos._get()
        expect(stored.player_uuid_1).toBeDefined()
        expect(stored.player_uuid_1.id).toBe("dQw4w9WgXcQ")
        expect(stored.player_uuid_1.name).toBe("Worship Song Video")
        expect(stored.player_uuid_1.type).toBe("youtube")
    })

    it("imports top-level playerVideos into playerVideos store", () => {
        const projectContent = JSON.stringify({
            project: {
                id: "proj_2",
                name: "Youth Night",
                shows: []
            },
            playerVideos: {
                vimeo_1: {
                    id: "12345678",
                    name: "Intro Video",
                    type: "vimeo"
                }
            },
            shows: {}
        })

        importProject([{ content: projectContent }])

        const stored = h.playerVideos._get()
        expect(stored.vimeo_1).toBeDefined()
        expect(stored.vimeo_1.id).toBe("12345678")
        expect(stored.vimeo_1.type).toBe("vimeo")
    })

    it("imports player videos from show media backgrounds", () => {
        const projectContent = JSON.stringify({
            project: {
                id: "proj_3",
                name: "Conference",
                shows: []
            },
            shows: {
                show_1: {
                    name: "Opening Show",
                    media: {
                        bg_player_1: {
                            name: "Background Stream",
                            type: "player",
                            data: {
                                id: "live_yt_id",
                                type: "youtube"
                            }
                        }
                    }
                }
            }
        })

        importProject([{ content: projectContent }])

        const stored = h.playerVideos._get()
        expect(stored.bg_player_1).toBeDefined()
        expect(stored.bg_player_1.id).toBe("live_yt_id")
        expect(stored.bg_player_1.type).toBe("youtube")
    })

    it("does not overwrite existing player videos", () => {
        h.playerVideos._set({
            existing_1: {
                id: "original_yt_id",
                name: "Original",
                type: "youtube"
            }
        })

        const projectContent = JSON.stringify({
            project: {
                id: "proj_4",
                name: "Event",
                shows: [
                    {
                        id: "existing_1",
                        name: "Overwritten Name",
                        type: "player",
                        data: {
                            id: "new_yt_id",
                            name: "Overwritten Name",
                            type: "youtube"
                        }
                    }
                ]
            },
            shows: {}
        })

        importProject([{ content: projectContent }])

        const stored = h.playerVideos._get()
        expect(stored.existing_1.id).toBe("original_yt_id")
        expect(stored.existing_1.name).toBe("Original")
    })
})
