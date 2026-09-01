// Detects holychords.pro pastes and rewrites them into the plain-text format convertText() (txt.ts) already understands.

const URL_RE = /https?:\/\/(?:www\.)?holychords\.pro\/\d+\/?/i

const LABELS: { re: RegExp; group: string }[] = [
    { re: /^(?:\d+\s*)?куплет(?:\s*\d+)?\s*:?\s*$/, group: "Verse" },
    { re: /^(?:\d+\s*)?(?:інтро|вступ)(?:\s*\d+)?\s*:?\s*$/, group: "Intro" },
    { re: /^(?:\d+\s*)?(?:приспів|припев|хор)(?:\s*\d+)?\s*:?\s*$/, group: "Chorus" },
    { re: /^(?:\d+\s*)?(?:бридж|міст)(?:\s*\d+)?\s*:?\s*$/, group: "Bridge" }
]

function matchLabel(line: string): string | null {
    const trimmed = line.trim().toLowerCase()
    const found = LABELS.find(({ re }) => re.test(trimmed))
    return found ? found.group : null
}

const CHORD_TOKEN_RE = /^[A-H](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:-[A-H](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*)?(?:\/[A-H](?:#|b)?)?$/i

function tokenizeLine(line: string): { token: string; index: number }[] {
    const tokens: { token: string; index: number }[] = []
    const re = /\S+/g
    let match: RegExpExecArray | null
    while ((match = re.exec(line))) tokens.push({ token: match[0], index: match.index })
    return tokens
}

function isChordOnlyLine(line: string): boolean {
    if (!line.trim()) return false
    const tokens = tokenizeLine(line)
    if (!tokens.length) return false
    // Requires every token to be chord-shaped, since holychords.pro cleanly separates chord/lyric lines - one stray token (e.g. "2x") demotes the whole line to lyrics.
    return tokens.every(({ token }) => CHORD_TOKEN_RE.test(token))
}

// Unlike txt.ts's insertChordsIntoLyrics(), this doesn't nudge chords off spaces - stays faithful to the site's own column positions.
function mergeChordAndLyric(chordLine: string, lyricLine: string): string {
    const tokens = tokenizeLine(chordLine)
    if (!tokens.length) return lyricLine

    let result = ""
    let tokenIndex = 0
    for (let pos = 0; pos < lyricLine.length; pos++) {
        while (tokenIndex < tokens.length && tokens[tokenIndex].index <= pos) {
            result += `[${tokens[tokenIndex].token}]`
            tokenIndex++
        }
        result += lyricLine[pos]
    }
    // any tokens positioned past the end of the (often shorter) lyric line are appended last
    while (tokenIndex < tokens.length) {
        result += `[${tokens[tokenIndex].token}]`
        tokenIndex++
    }

    return result
}

function chordOnlyLineToBrackets(line: string): string {
    // Trailing space keeps a single-token line's text non-empty after bracket extraction, so txt.ts's empty-text check doesn't wipe the chord too.
    return (
        tokenizeLine(line)
            .map(({ token }) => `[${token}]`)
            .join(" ") + " "
    )
}

function processSectionLines(lines: string[]): string[] {
    const output: string[] = []
    let i = 0

    while (i < lines.length) {
        const line = lines[i]

        if (isChordOnlyLine(line)) {
            const next = lines[i + 1]
            if (next !== undefined && next.trim() !== "" && !isChordOnlyLine(next)) {
                output.push(mergeChordAndLyric(line, next))
                i += 2
                continue
            }

            output.push(chordOnlyLineToBrackets(line))
            i += 1
            continue
        }

        output.push(line)
        i += 1
    }

    return output
}

export function isHolychords(text: string): boolean {
    return URL_RE.test(text || "")
}

export function preprocessHolychords(text: string): { name: string; text: string } {
    const lines = (text || "").replace(/\r/g, "").split("\n")

    const titleIndex = lines.findIndex((line) => line.trim() !== "")
    const name = titleIndex >= 0 ? lines[titleIndex].trim() : ""
    if (titleIndex >= 0) lines.splice(titleIndex, 1)

    // Kept aside as a notes= metadata line rather than left in the lyrics.
    let sourceUrl = ""
    const urlIndex = lines.findIndex((line) => URL_RE.test(line))
    if (urlIndex >= 0) {
        sourceUrl = lines[urlIndex].trim()
        lines.splice(urlIndex, 1)
    }

    while (lines.length && lines[0].trim() === "") lines.shift()
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop()

    const sections = lines
        .join("\n")
        .split(/\n{2,}/)
        .map((section) => section.split("\n"))

    const processedSections = sections.map((sectionLines) => {
        while (sectionLines.length && sectionLines[sectionLines.length - 1].trim() === "") sectionLines.pop()
        if (!sectionLines.length) return []

        const labelGroup = matchLabel(sectionLines[0])
        if (labelGroup) return [`${labelGroup}:`, ...processSectionLines(sectionLines.slice(1))]

        return processSectionLines(sectionLines)
    })

    let result = processedSections
        .map((sectionLines) => sectionLines.join("\n"))
        .filter((section) => section.trim() !== "")
        .join("\n\n")

    // Attached to the last section (single "\n") rather than its own "\n\n" section - a separate section would survive as a stray empty slide downstream.
    if (sourceUrl) result += `${result ? "\n" : ""}notes=${sourceUrl}`

    return { name, text: result }
}
