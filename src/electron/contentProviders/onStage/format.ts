/**
 * WARNING: This file should ONLY be accessed through OnStageProvider.
 *
 * OnStage delivers lyrics already split into slides, but that split follows the OnStage
 * presenter layout, not the local output. These helpers re-shape a section's lyrics to the
 * user's own settings (Settings > Connection > OnStage) before the show is built.
 */

export type OnStageFormatSettings = {
    // 0 keeps the slide split exactly as OnStage sent it
    linesPerSlide: number
    // 0 never breaks a line, no matter how long
    maxLineLength: number
    // collapse same-label sections carrying identical lyrics (Chorus 1 / Chorus 2) into one group
    mergeIdenticalSections: boolean
}

export const defaultOnStageFormat: OnStageFormatSettings = {
    linesPerSlide: 0,
    maxLineLength: 0,
    mergeIdenticalSections: true
}

// Latin basic + Latin-1 Supplement + Latin Extended-A/B, so Romanian ă â î ș ț count as letters.
// Written as explicit ranges because unicode property escapes need a target above ES2015.
const LETTER = "A-Za-z\\u00C0-\\u024F"
const FIRST_LETTER_REGEX = new RegExp(`^([^${LETTER}]*)([${LETTER}])`)
const NON_LYRIC_REGEX = new RegExp(`[^${LETTER}0-9 ]`, "g")

export function getFormatSettings(data: unknown): OnStageFormatSettings {
    const settings = (data || {}) as Partial<OnStageFormatSettings>

    return {
        linesPerSlide: toPositiveInt(settings.linesPerSlide),
        maxLineLength: toPositiveInt(settings.maxLineLength),
        mergeIdenticalSections: settings.mergeIdenticalSections !== false
    }
}

function toPositiveInt(value: unknown): number {
    const num = Number(value)
    if (!Number.isFinite(num) || num <= 0) return 0
    return Math.floor(num)
}

/** Uppercase the first letter, leaving any leading quote or bracket in place. */
export function capitalizeFirstWord(text: string): string {
    return text.replace(FIRST_LETTER_REGEX, (_match, prefix: string, letter: string) => prefix + letter.toLocaleUpperCase())
}

/**
 * Break a line that does not fit into whole-word halves, splitting as close to the middle as
 * possible. Each continuation line starts a new visual line, so its first word is capitalized.
 */
export function splitLongLine(line: string, maxLength: number): string[] {
    const text = line.trim().replace(/\s+/g, " ")
    if (!maxLength || text.length <= maxLength) return text ? [text] : []

    const words = text.split(" ")
    // a single word longer than the limit has no word boundary to break on
    if (words.length < 2) return [text]

    const target = text.length / 2
    let bestIndex = 1
    let bestDistance = Infinity
    let length = 0

    // only boundaries 1..words.length-1 are considered, so both halves are always shorter
    for (let i = 0; i < words.length - 1; i++) {
        length += words[i].length + (i ? 1 : 0)
        const distance = Math.abs(length - target)
        if (distance < bestDistance) {
            bestDistance = distance
            bestIndex = i + 1
        }
    }

    const first = words.slice(0, bestIndex).join(" ")
    const second = capitalizeFirstWord(words.slice(bestIndex).join(" "))

    return [...splitLongLine(first, maxLength), ...splitLongLine(second, maxLength)]
}

/**
 * Re-shape one section's slides: break over-long lines, then regroup the lines into slides of
 * `linesPerSlide`. An empty section (instrumental) keeps its single empty slide.
 */
export function formatSectionSlides(sectionSlides: { lines: string[] }[], settings: OnStageFormatSettings): { lines: string[] }[] {
    if (!settings.linesPerSlide && !settings.maxLineLength) return sectionSlides

    const splitSlideLines = (lines: string[]) => lines.flatMap((line) => splitLongLine(line, settings.maxLineLength))

    // keep OnStage's own slide boundaries, only re-wrapping the lines inside them
    if (!settings.linesPerSlide) return sectionSlides.map((slide) => ({ lines: splitSlideLines(slide.lines || []) }))

    const allLines = splitSlideLines(sectionSlides.flatMap((slide) => slide.lines || []))
    if (!allLines.length) return sectionSlides

    const slides: { lines: string[] }[] = []
    for (let i = 0; i < allLines.length; i += settings.linesPerSlide) {
        slides.push({ lines: allLines.slice(i, i + settings.linesPerSlide) })
    }
    return slides
}

/**
 * A comparable form of a section's lyrics — case, punctuation and slide boundaries removed — so
 * two sections holding the same words match even when OnStage split them differently.
 */
export function getLyricsSignature(sectionSlides: { lines: string[] }[]): string {
    return sectionSlides
        .flatMap((slide) => slide.lines || [])
        .map((line) => line.toLowerCase().replace(NON_LYRIC_REGEX, "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
}

/** "Chorus 2" -> "Chorus": used when a label's numbered sections all collapsed into one group. */
export function stripSectionNumber(name: string): string {
    return name.replace(/\s*\d+\s*$/, "").trim() || name
}
