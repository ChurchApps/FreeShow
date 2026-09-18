import { describe, expect, it } from "vitest"
import { reshapeSongSelectExport } from "./txtSongSelectDetect"

describe("reshapeSongSelectExport", () => {
    it("returns null when there is no CCLI Song # line", () => {
        const plainSong = "Verse 1\nJust an ordinary song\n\nChorus\nWith no SongSelect footer at all"
        expect(reshapeSongSelectExport(plainSong)).toBeNull()
    })

    it("isolates a footer that's glued directly to the last lyric line, with no separating blank line", () => {
        const glued = `Rise And Sing His Praise

Chorus
Rise and sing His praise
Lift your voice today

Verse 1
Morning breaks with mercy new
Every gift a grace from You
Alex Carter, Jamie Voss
CCLI Song #1234567
© 2019 Fictional Music Publishing
For use solely with the SongSelect® Terms of Use.  All rights reserved. www.ccli.com
CCLI Licence No.9999999`
        const result = reshapeSongSelectExport(glued)

        expect(result).not.toBeNull()
        const sections = result!.text.split("\n\n").filter(Boolean)
        expect(sections).toHaveLength(3)
        expect(sections[0]).toBe("Chorus\nRise and sing His praise\nLift your voice today")
        expect(sections[1]).toBe("Verse 1\nMorning breaks with mercy new\nEvery gift a grace from You")
        expect(sections[2]).toContain("Alex Carter, Jamie Voss")
        expect(sections[2]).toContain("CCLI Song #1234567")
    })

    it("extracts the title and leaves an already-isolated footer as-is in shape", () => {
        const standard = `Rise And Sing His Praise

Chorus
Rise and sing His praise

Alex Carter
CCLI Song #1234567
© 2019 Fictional Music Publishing`
        const result = reshapeSongSelectExport(standard)

        expect(result?.title).toBe("Rise And Sing His Praise")
        expect(result?.text).not.toContain("Rise And Sing His Praise\n\n")
    })

    it("handles a song with no writer line before the CCLI Song # line", () => {
        const noWriter = `Rise And Sing His Praise

Chorus
Rise and sing His praise

CCLI Song #1234567
© 2019 Fictional Music Publishing`
        const result = reshapeSongSelectExport(noWriter)

        const sections = result!.text.split("\n\n").filter(Boolean)
        expect(sections[sections.length - 1]).toBe("CCLI Song #1234567\n© 2019 Fictional Music Publishing")
    })

    it("returns null when the writer line would swallow the entire lyric body", () => {
        // no title/blank/label shape at the top, and the one line present sits
        // directly above the CCLI line - nothing left to treat as lyric body
        const degenerate = "Just some lyrics\nCCLI Song #1234567"
        expect(reshapeSongSelectExport(degenerate)).toBeNull()
    })
})
