export function isColumnBreakLine(line: string): boolean {
    return line.trim().toUpperCase() === "COLUMN_BREAK"
}

const KEYWORD_PATTERNS = [/^[A-Z]+_(?:BREAK|BRAKE)$/i, /^SECTION(?:[\s_]+HEADING)?$/i, /^(?:TRANSPOSE|REDEFINE)(?:\s+KEY)?(?:\s*[+-]\s*\d+)?$/i]

export function isPlanningCenterKeywordLine(line: string): boolean {
    const trimmed = line.trim()
    if (!trimmed) return false
    if (isColumnBreakLine(trimmed)) return true

    return KEYWORD_PATTERNS.some((pattern) => pattern.test(trimmed))
}

export function normalizeLineBreaks(text: string): string {
    return text.replace(/\n\r/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

export function filterPlanningCenterKeywordLines(text: string): string {
    return normalizeLineBreaks(text)
        .split("\n")
        .filter((line) => !isPlanningCenterKeywordLine(line))
        .join("\n")
}
