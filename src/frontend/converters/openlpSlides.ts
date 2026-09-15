const LINE_SEPARATOR = "__BREAK__"
const SLIDE_BREAK = /<p\s*style=["']page-break-after:\s*always;["']\s*\/?>|\[--\}\{--\]/i

export function splitOpenLPSlideLines(lines: string[]) {
    return lines
        .join(LINE_SEPARATOR)
        .split(SLIDE_BREAK)
        .map((slideData) => slideData.trim().split(LINE_SEPARATOR).filter(Boolean))
}
