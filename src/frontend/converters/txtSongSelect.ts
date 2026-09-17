// A CCLI SongSelect lyrics export has a fixed shape: the song title on its
// own first line, a blank line, then the first section label (already
// correct - "Verse 1", "Chorus", ...), and a trailing footer of writer
// names, a "CCLI Song #..." line, a copyright line, and licensing
// boilerplate. None of that footer is lyric content - left in, it gets fed
// straight into the classifier as if it were a verse or bridge.
//
// This only runs when explicitly opted into (special.songselectMode) since
// the shape is too easily confused with an ordinary short song otherwise.
// It extracts title/writers/CCLI Song #/copyright for use as show metadata
// and strips the title line and the whole footer from the text handed to
// the rest of the importer. If the "CCLI Song #" anchor isn't found, the
// text is returned unchanged - a safe no-op on anything that isn't
// actually a SongSelect export.
//
// Deliberately not extracted: the "CCLI Licence No." line - that's the
// church's own licence number, not something about the song.

const CCLI_SONG_RE = /^\s*CCLI\s*Song\s*#?\s*(\d+)\s*$/i
const CCLI_LICENCE_RE = /CCLI\s*Licen[cs]e\s*No\.?\s*\d+/i
const COPYRIGHT_RE = /^\s*©\s*(.+?)\s*$/
const SONGSELECT_BOILERPLATE_RE = /SongSelect.*Terms of Use/i

// A label line is, in full: optional bracket/paren, a name (letters, spaces,
// hyphens), an optional trailing number, optional closing bracket/paren,
// optional trailing colon. Matching the *whole* line (not a substring) is
// what keeps this from firing on an ordinary lyric line that happens to
// start with a capital letter. Deliberately independent of the classifier's
// store-backed findGroupMatch()/dictionary lookup - title detection here
// only needs to recognise "this looks like a section label", not resolve it
// to a specific group id.
const LABEL_LINE_RE = /^\s*[[(]?\s*[A-Za-z][A-Za-z -]*?\s*\d*\s*[\])]?\s*:?\s*$/

const FOOTER_SCAN_WINDOW = 6 // lines after the CCLI line to look for copyright/boilerplate

export interface SongSelectMetadata {
    title?: string
    authors: string[]
    ccliNumber?: string
    copyright?: string
}

function findTitle(lines: string[]): { title?: string; bodyStart: number } {
    const firstContent = lines.findIndex((l) => l.trim().length > 0)
    if (firstContent === -1) return { bodyStart: 0 }

    const blankIdx = firstContent + 1
    const labelIdx = blankIdx + 1
    if (lines[blankIdx]?.trim() === "" && labelIdx < lines.length && LABEL_LINE_RE.test(lines[labelIdx])) {
        return { title: lines[firstContent].trim(), bodyStart: firstContent + 1 }
    }

    return { bodyStart: 0 }
}

export function extractSongSelectMetadata(text: string): { body: string; metadata: SongSelectMetadata } {
    const lines = text.split("\n")

    const ccliLineIdx = lines.findIndex((l) => CCLI_SONG_RE.test(l))
    if (ccliLineIdx === -1) return { body: text, metadata: { authors: [] } }

    const ccliNumber = lines[ccliLineIdx].match(CCLI_SONG_RE)![1]

    let authors: string[] = []
    const authorLineIdx = ccliLineIdx - 1
    if (authorLineIdx >= 0 && lines[authorLineIdx].trim()) {
        authors = lines[authorLineIdx]
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean)
    }

    let copyrightText: string | undefined
    const scanEnd = Math.min(ccliLineIdx + 1 + FOOTER_SCAN_WINDOW, lines.length)
    for (let i = ccliLineIdx + 1; i < scanEnd; i++) {
        const line = lines[i]
        const copyrightMatch = line.match(COPYRIGHT_RE)
        if (copyrightMatch) {
            copyrightText = "© " + copyrightMatch[1]
            continue
        }
        if (SONGSELECT_BOILERPLATE_RE.test(line) || CCLI_LICENCE_RE.test(line)) continue
        if (line.trim() === "") continue
        break // something that isn't recognised footer content - stop scanning
    }

    const { title, bodyStart } = findTitle(lines)
    const bodyEnd = authors.length ? authorLineIdx : ccliLineIdx
    const bodyLines = lines.slice(bodyStart, bodyEnd)
    while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === "") bodyLines.pop()

    return {
        body: bodyLines.join("\n"),
        metadata: { title, authors, ccliNumber, copyright: copyrightText }
    }
}
