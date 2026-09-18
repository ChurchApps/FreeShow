// txt.ts already extracts CCLI metadata (isCCLIBlock()/extractCCLIMetadata())
// from whatever ends up as the last "\n\n"-separated section - but only if
// that footer already survives paste/preprocessing as its own isolated
// trailing block, and it never strips the title line from the lyric body.
//
// A CCLI SongSelect export's footer (writer name, "CCLI Song #...", a
// copyright line, licensing boilerplate) doesn't always land with a blank
// line separating it from the last lyric section - it depends on exactly
// how the export was copied. This reshapes the text so that footer becomes
// exactly one blank-line-separated trailing section, and removes the title
// line (SongSelect always puts it on its own first line, before a blank
// line and the first section label) from the lyric body - then hands off
// to the existing, unmodified isCCLIBlock()/extractCCLIMetadata() pipeline
// to do all the actual field parsing. No metadata extraction logic is
// duplicated here.
//
// Anchored purely on the literal "CCLI Song #" line: no ordinary lyric
// paste contains that exact phrase, so this can run unconditionally ahead
// of the normal parsing without risking a false positive on a normal song.

const CCLI_SONG_LINE_RE = /^\s*CCLI\s*(?:Song)?\s*#\s*\d+\s*$/i

// A label line is, in full: optional bracket/paren, a name (letters, spaces,
// hyphens), an optional trailing number, optional closing bracket/paren,
// optional trailing colon - matches SongSelect's own bare labels ("Verse 1",
// "Chorus") as well as the bracket/colon forms other sources use.
const LABEL_LINE_RE = /^\s*[[(]?\s*[A-Za-z][A-Za-z -]*?\s*\d*\s*[\])]?\s*:?\s*$/

export interface SongSelectReshape {
    text: string
    title?: string
}

function findTitle(lines: string[]): { title?: string; bodyStart: number } {
    const firstContent = lines.findIndex((l) => l.trim().length > 0)
    if (firstContent === -1) return { bodyStart: 0 }

    const blankIdx = firstContent + 1
    const labelIdx = blankIdx + 1
    if (lines[blankIdx]?.trim() === "" && labelIdx < lines.length && LABEL_LINE_RE.test(lines[labelIdx])) {
        return { title: lines[firstContent].trim(), bodyStart: labelIdx }
    }

    return { bodyStart: 0 }
}

export function reshapeSongSelectExport(text: string): SongSelectReshape | null {
    const lines = text.split("\n")

    const ccliLineIdx = lines.findIndex((l) => CCLI_SONG_LINE_RE.test(l))
    if (ccliLineIdx === -1) return null

    const authorLineIdx = ccliLineIdx - 1
    const footerStart = authorLineIdx >= 0 && lines[authorLineIdx].trim() ? authorLineIdx : ccliLineIdx

    const { title, bodyStart } = findTitle(lines)
    if (bodyStart >= footerStart) return null

    const bodyLines = lines.slice(bodyStart, footerStart)
    while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === "") bodyLines.pop()
    if (!bodyLines.length) return null

    const footerLines = lines.slice(footerStart)

    return { text: bodyLines.join("\n") + "\n\n" + footerLines.join("\n"), title }
}
