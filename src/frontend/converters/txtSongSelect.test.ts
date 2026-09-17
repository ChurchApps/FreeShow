import { describe, expect, it } from "vitest"
import { extractSongSelectMetadata } from "./txtSongSelect"

// A representative CCLI SongSelect lyrics export: title, blank line, body with
// explicit section labels, blank line, writers, "CCLI Song #...", copyright,
// licence number and Terms of Use boilerplate.
const SONGSELECT_EXPORT = `Way Maker

Verse 1
You are here, moving in our midst
I worship You, I worship You

Chorus
Way maker, miracle worker
Promise keeper, light in the darkness

Sinach
CCLI Song # 7115744
© 2016 Integrity Music Europe
For use solely with the SongSelect Terms of Use. All rights reserved. www.ccli.com
CCLI Licence No. 123456`

describe("extractSongSelectMetadata", () => {
    it("returns the text unchanged with empty metadata when there is no CCLI Song # line", () => {
        const plainSong = "Verse 1\nJust an ordinary song\n\nChorus\nWith no SongSelect footer at all"
        const result = extractSongSelectMetadata(plainSong)
        expect(result.body).toBe(plainSong)
        expect(result.metadata.ccliNumber).toBeUndefined()
        expect(result.metadata.authors).toEqual([])
    })

    it("extracts title, writer, CCLI number and copyright from a SongSelect export", () => {
        const result = extractSongSelectMetadata(SONGSELECT_EXPORT)

        expect(result.metadata.title).toBe("Way Maker")
        expect(result.metadata.authors).toEqual(["Sinach"])
        expect(result.metadata.ccliNumber).toBe("7115744")
        expect(result.metadata.copyright).toBe("© 2016 Integrity Music Europe")
    })

    it("strips the title line and the whole footer from the returned body", () => {
        const result = extractSongSelectMetadata(SONGSELECT_EXPORT)

        expect(result.body).not.toContain("Way Maker")
        expect(result.body).not.toContain("Sinach")
        expect(result.body).not.toContain("CCLI")
        expect(result.body).not.toContain("Terms of Use")
        expect(result.body.trim().startsWith("Verse 1")).toBe(true)
        expect(result.body).toContain("Way maker, miracle worker")
    })

    it("splits multiple comma-separated writers into separate authors", () => {
        const multiWriter = SONGSELECT_EXPORT.replace("Sinach", "Osinachi Kalu Okoro Egbu, Israel Houghton")
        const result = extractSongSelectMetadata(multiWriter)

        expect(result.metadata.authors).toEqual(["Osinachi Kalu Okoro Egbu", "Israel Houghton"])
    })

    it("handles a song with no writer line before the CCLI Song # line", () => {
        const noWriter = `Way Maker

Verse 1
You are here, moving in our midst

CCLI Song # 7115744
© 2016 Integrity Music Europe`
        const result = extractSongSelectMetadata(noWriter)

        expect(result.metadata.authors).toEqual([])
        expect(result.metadata.ccliNumber).toBe("7115744")
        expect(result.body).not.toContain("CCLI")
    })
})
