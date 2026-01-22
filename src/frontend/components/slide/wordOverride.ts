import type { TemplateStyleOverride } from "../../../types/Show"
import { TemplateHelper } from "../../utils/templates"

// split the rendered text so template rules can restyle matching chunks
export function applyStyleOverrides(baseLines: any[], overrides: TemplateStyleOverride[]) {
    return baseLines.map((line) => {
        if (!Array.isArray(line?.text)) return line

        let segments = line.text.map((segment) => ({ ...segment }))
        overrides.forEach((override) => {
            const regex = buildOverrideRegex(override)
            if (!regex) return

            const nextSegments: any[] = []
            segments.forEach((segment) => {
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

    // Parse both styles into objects
    const baseProps = parseStyleString(baseStyle || "")
    const templateProps = parseStyleString(templateStyle)

    // Merge: base properties + template override properties
    // Template properties (color, font-weight, font-style, etc.) override base
    const merged = { ...baseProps, ...templateProps }

    // IMPORTANT: Remove font-size from merged result since it will be set separately by fontSizePart
    // This prevents duplicate font-size declarations in the final style string
    delete merged["font-size"]

    // Convert back to CSS string with !important for color and font-style to ensure they override
    const result = Object.entries(merged)
        .map(([key, value]) => {
            // Add !important to style overrides that might be getting overridden
            if (key === "color" || key === "font-style" || key === "font-weight") {
                return `${key}:${value} !important`
            }
            return `${key}:${value}`
        })
        .join(";") + (Object.keys(merged).length ? ";" : "")

    return result
}

function parseStyleString(styleString: string): Record<string, string> {
    const result: Record<string, string> = {}
    if (!styleString) return result

    // Split by semicolon and parse each property
    styleString.split(";").forEach((declaration) => {
        const colonIndex = declaration.indexOf(":")
        if (colonIndex === -1) return

        const property = declaration.slice(0, colonIndex).trim()
        const value = declaration.slice(colonIndex + 1).trim()

        if (property && value) {
            result[property] = value
        }
    })

    return result
}
