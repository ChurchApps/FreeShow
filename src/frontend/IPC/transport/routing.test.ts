import { describe, expect, it } from "vitest"
import { routeChannel } from "./routing"

describe("hybrid transport routing", () => {
    it("routes co-editing + shared library channels to the remote server", () => {
        expect(routeChannel("YJS")).toBe("remote")
        for (const sub of ["SHOW", "SHOWS", "FULL_SHOWS_LIST", "OVERLAYS", "TEMPLATES", "PROJECTS", "EVENTS", "THEMES", "SYNCED_SETTINGS", "MEDIA", "BIBLE"]) {
            expect(routeChannel("MAIN", sub)).toBe("remote")
        }
    })

    it("keeps hardware / machine channels local (incl. STAGE display config)", () => {
        for (const sub of ["SETTINGS", "STAGE", "GET_SCREENS", "GET_DISPLAYS", "OUTPUT", "PRESENTATION_CONTROL", "CAPTURE_SLIDE", "GET_MIDI_OUTPUTS", "HISTORY", "CACHE", "USAGE", "URL", "SYSTEM_OPEN", "READ_FILE", "START", "SPOTIFY_COMMAND"]) {
            expect(routeChannel("MAIN", sub)).toBe("local")
        }
        for (const transport of ["OUTPUT", "NDI", "BLACKMAGIC", "AUDIO", "EXPORT", "CLOUD", "STARTUP"]) {
            expect(routeChannel(transport)).toBe("local")
        }
    })
})
