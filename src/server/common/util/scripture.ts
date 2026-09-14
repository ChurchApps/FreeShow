export function sanitizeVerseText(input: unknown): string {
    if (input === null || input === undefined) return ""

    const text = typeof input === "string" ? input : String(input)
    const withoutBreaks = text.replace(/<\s*br\s*\/?>/gi, " ")
    const normalizedSpaces = withoutBreaks.replace(/\u00a0/g, " ")
    const withQuotes = normalizedSpaces.replace(/<q>(.*?)<\/q>/g, "“$1”")
    const replacedUndertitles = withQuotes.replace(/<h4[^>]*>(.*?)<\/h4>\s*/g, '<span class="undertitle">$1 </span>')
    const withoutMultipleSpaces = replacedUndertitles.replace(/ {2,}/g, " ")

    return withoutMultipleSpaces.trim()
}
