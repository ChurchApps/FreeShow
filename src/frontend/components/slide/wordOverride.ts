import type { TemplateStyleOverride } from "../../../types/Show"
import { TemplateHelper } from "../../utils/templates"

// split the rendered text so template rules can restyle matching chunks
export function applyStyleOverrides(baseLines: any[], overrides: TemplateStyleOverride[]) {
    return baseLines.map(line => {
        if (!Array.isArray(line?.text)) return line

        let segments = line.text.map(segment => ({ ...segment }))
        overrides.forEach(override => {
            const regex = buildOverrideRegex(override)
            if (!regex) return

            const nextSegments: any[] = []
            segments.forEach(segment => {
                nextSegments.push(...splitSegment(segment, regex, override))
            })
            segments = nextSegments
        })

        return { ...line, text: segments }
    })
}

function buildOverrideRegex(override: TemplateStyleOverride) {
    const raw = (override.pattern || "").trim()
    if (!raw) return null

    if (raw.startsWith("/") && raw.lastIndexOf("/") > 0) {
        const lastSlash = raw.lastIndexOf("/")
        const body = raw.slice(1, lastSlash)
        if (!body) return null

        const flagSource = raw.slice(lastSlash + 1)
        const flags = flagSource ? (flagSource.includes("g") ? flagSource : `${flagSource}g`) : "g"
        try {
            return new RegExp(body, flags)
        } catch (error) {
            console.warn("Template style override regex failed", error)
            return null
        }
    }

    const safe = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return new RegExp(safe, "gi")
}

function splitSegment(segment: any, regex: RegExp, override: TemplateStyleOverride) {
    if (!segment?.value) return [segment]
    if (segment.customType?.includes("disableTemplate")) return [segment]

    const text = String(segment.value)
    const matcher = new RegExp(regex.source, regex.flags)
    const parts: any[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = matcher.exec(text)) !== null) {
        const matchedText = match[0]
        if (!matchedText) {
            matcher.lastIndex += 1
            continue
        }

        const start = match.index
        if (start > lastIndex) {
            const before = text.slice(lastIndex, start)
            if (before) parts.push({ ...segment, value: before })
        }

        const styledPart = { ...segment, value: matchedText, style: mergeOverrideStyles(segment.style, override) }
        parts.push(styledPart)
        lastIndex = start + matchedText.length
    }

    if (lastIndex < text.length) {
        const trailing = text.slice(lastIndex)
        if (trailing) parts.push({ ...segment, value: trailing })
    }

    return parts.length ? parts : [segment]
}

function mergeOverrideStyles(baseStyle: string, override: TemplateStyleOverride) {
    if (!override.templateId) return baseStyle || ""

    const _template = new TemplateHelper(override.templateId)

    const templateStyle = _template.getTextStyle()
    if (!templateStyle) return baseStyle || ""

    const fontSize = getRelativeFontSize(baseStyle, templateStyle)

    return templateStyle + (fontSize ? ` font-size: ${fontSize};` : "")
}

function getRelativeFontSize(baseStyle: string, templateStyle: string) {
    let templateFontSize = templateStyle.match(/font-size:\s*(\d+)px/)
    let baseFontSize = baseStyle.match(/font-size:\s*(\d+)px/)
    if (!templateFontSize && !baseFontSize) return 100
    if (!templateFontSize) return Number(baseFontSize![1])

    let percentageDiff = Number(templateFontSize[1]) / Number(baseFontSize![1])
    return Number(baseFontSize![1]) * percentageDiff
}
