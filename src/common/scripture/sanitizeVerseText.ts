const BR_TAG_REGEX = /<\s*br\s*\/?>/gi
const NBSP_REGEX = /\u00a0/g
const QUOTES_REGEX = /<q>(.*?)<\/q>/g
const MULTIPLE_SPACES_REGEX = / {2,}/g

export function sanitizeVerseText(input: unknown): string {
    if (input === null || input === undefined) return ""

    const text = typeof input === "string" ? input : String(input)
    const withoutBreaks = text.replace(BR_TAG_REGEX, " ")
    const normalizedSpaces = withoutBreaks.replace(NBSP_REGEX, " ")
    const withQuotes = normalizedSpaces.replace(QUOTES_REGEX, "“$1”")
    return withQuotes.replace(MULTIPLE_SPACES_REGEX, " ").trim()
}
