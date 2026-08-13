// FreeNote markdown pipeline — pure functions, testable without a DOM.
// `renderMarkdown` renders sanitized HTML for the live preview, while
// `blockToItem` converts a markdown block into a native FreeShow text Item.

import DOMPurify from "dompurify"
import { marked } from "marked"
import type { Item, Line, Show } from "../../../types/Show"
import type { FreeNoteTemplate } from "./freeNote"

export function extractFirstHeading(src: string): string {
    if (!src?.trim()) return ""
    const lines = src.split("\n")
    for (const line of lines) {
        const trimmed = line.trim()
        const headingMatch = trimmed.match(/^#\s+(.+)$/)
        if (headingMatch) return headingMatch[1].trim()
    }
    return ""
}

// split markdown source into one block per slide (--- separator)
export function splitBlocks(src: string): string[] {
    if (typeof src !== "string") return []
    return src
        .split(/^---+$/gm)
        .map((block) => block.trim())
        .filter((block) => block.length > 0)
}

// Expand FreeNote inline tokens ([size:x], [font:y]) into styled HTML spans so the
// markdown preview shows them as proper styling instead of literal brackets.
function expandTokens(src: string): string {
    return src.replace(/\[size:\s*(\d+)\s*\]([\s\S]*?)\[\/size\]/g, (_m, px: string, text: string) => `<span style="font-size:${px}px">${text}</span>`).replace(/\[font\s*:?\s*('?)([^'\]\n]+?)\1\]([\s\S]*?)\[\/font\]/g, (_m, quote: string, family: string, text: string) => `<span style="font-family:${quote}${family.trim()}${quote}">${text}</span>`)
}

// marked -> DOMPurify -> sanitized HTML (for the live preview)
export function renderMarkdown(src: string): string {
    if (!src?.trim()) return ""
    const expanded = expandTokens(src)
    const html = marked.parse(expanded, { async: false })
    return DOMPurify.sanitize(html, { ALLOWED_TAGS: ["span", "h1", "h2", "h3", "h4", "h5", "h6", "p", "div", "br", "ul", "ol", "li", "em", "strong", "b", "i", "u", "code", "pre", "a", "img"], ALLOWED_ATTR: ["style", "class", "src", "href", "alt", "title"] })
}

// default full-screen text box (mirrors FreeShow's DEFAULT_ITEM_STYLE)
const DEFAULT_ITEM_STYLE = "top:88px;left:50px;height:904px;width:1820px;"

const INLINE_PATTERN = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\n]+\*|\[size:\d+\][^[\n]+\[\/size\]|\[font\s*:?\s*(?:'[^'\n]+'|"[^"\n]+"|[^\[\]\n]+)\][^[\n]+\[\/font\])/g

// escape raw text before it reaches FreeShow's {@html} stage renderer, so typed or
// pasted HTML in markdown mode can never inject scripts into the projection output.
function escapeHtml(value: string): string {
    return value.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] as string)
}

// convert inline markdown (bold, italic, underline, code, size) into styled text segments
export function parseInlineMarkdown(text: string): { value: string; style: string }[] {
    const segments: { value: string; style: string }[] = []

    text.split(INLINE_PATTERN).forEach((part) => {
        if (!part) return

        let value = part
        let style = ""
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
            value = part.slice(2, -2)
            style = "font-weight:bold;"
        } else if (part.startsWith("__") && part.endsWith("__") && part.length > 4) {
            value = part.slice(2, -2)
            style = "text-decoration:underline;"
        } else if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
            value = part.slice(1, -1)
            style = "font-family:monospace;"
        } else if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
            value = part.slice(1, -1)
            style = "font-style:italic;"
        } else {
            const size = part.match(/^\[size:(\d+)\](.*)\[\/size\]$/)
            if (size) {
                // nested markdown inside a size token: recursively parse the body
                // and prepend the container style so [size:101]**word**[/size]
                // renders bold AND sized instead of literal asterisks.
                parseInlineMarkdown(size[2]).forEach((seg) => {
                    seg.style = `font-size:${size[1]}px;` + seg.style
                    segments.push(seg)
                })
                return
            }
            const font = part.match(/^\[font\s*:?\s*('?)([^'\]]+?)\1\](.*)\[\/font\]$/)
            if (font) {
                parseInlineMarkdown(font[3]).forEach((seg) => {
                    seg.style = `font-family:${font[1]}${font[2].trim()}${font[1]};` + seg.style
                    segments.push(seg)
                })
                return
            }
        }

        segments.push({ value: escapeHtml(value), style })
    })

    return segments
}

// vertical positions drive where the text block sits inside the slide (.align container)
const V_ALIGN_CSS: Record<string, string> = { top: "align-items:flex-start;", center: "", bottom: "align-items:flex-end;" }
// block-level horizontal position drives the default per-line text-align.
// (justify-content on .align can never move the block: .lines is width:100%,
// so we use FreeShow's native per-line text-align, exactly like <align:>.)
const H_POS_CSS: Record<string, string> = { left: "text-align:left;", center: "text-align:center;", right: "text-align:right;" }

// turn a single markdown block into a FreeShow text item (one slide)
export function blockToItem(block: string, template: FreeNoteTemplate | null = null, vertical = "", horizontal = "", defaultFont = ""): Item {
    const lines: Line[] = []
    // horizontal position (when set) wins over the template's default alignment,
    // and an explicit [align:] token on a line still overrides both.
    const effectiveAlign = (horizontal && H_POS_CSS[horizontal]) || template?.textAlign || "text-align:center;"
    // vertical position lives on item.align (align-items); horizontal is per-line.
    const boxCss = (vertical && V_ALIGN_CSS[vertical]) || ""

    // block-level font wrapper: [font 'family'] ... [/font] on their own lines
    // makes every line inside inherit the font (inline overrides still win).
    let blockFont = ""

    block.split("\n").forEach((rawLine, lineIndex) => {
        const trimmed = rawLine.trim()
        // opening tag: only recognized on the first content line so an inline
        // [font:...] token inside a line can never be mistaken for a wrapper.
        if (lineIndex === 0 && !blockFont) {
            const fontOpen = trimmed.match(/^\[font\s*:?\s*('?)([^'\]\n]+?)\1\]$/)
            if (fontOpen) {
                blockFont = fontOpen[1] + fontOpen[2].trim() + fontOpen[1]
                return
            }
        }
        // closing tag on its own line: stop applying the block font.
        if (blockFont && trimmed === "[/font]") {
            blockFont = ""
            return
        }

        const line = rawLine.trimEnd()
        // A blank line is NOT a slide-break (only `---` is), so treat it as
        // vertical spacing between the surrounding lines instead of dropping it.
        if (!line.trim()) {
            lines.push({ align: effectiveAlign, text: [{ value: "\u00A0" }] })
            return
        }

        let value = line.trim()
        let lineStyle = ""
        let lineAlign = effectiveAlign

        // per-line alignment override: [align:left|center|right] at the start of a
        // line lets each line be positioned independently within the same slide.
        const perLineAlign = value.match(/^\[align:\s*(left|center|right)\s*\]\s*(.*)$/i)
        if (perLineAlign) {
            lineAlign = `text-align:${perLineAlign[1].toLowerCase()};`
            value = perLineAlign[2]
        }

        // headings become larger BOLD (level 1-6), proportional to level.
        // NOTE: use px (not em/%): TextboxLines.resolveFontSize strips units to px,
        // and the item uses textFit "none" so per-line sizes are applied.
        const heading = value.match(/^(#{1,6})\s+(.*)$/)
        if (heading) {
            const level = heading[1].length
            const levels: Record<number, string> = { 1: "360px", 2: "240px", 3: "180px", 4: "140px", 5: "120px", 6: "100px" }
            lineStyle += `font-size:${levels[level] || "120px"};font-weight:bold;`
            value = heading[2]
        } else if (value.match(/^[-•*]\s+/)) {
            // list items
            value = "• " + value.replace(/^[-•*]\s+/, "")
        }

        const text = parseInlineMarkdown(value).filter((segment) => segment.value.trim())
        if (!text.length) return

        // keep each segment's own inline style (bold/italic/underline/size/font),
        // combined with the line-level style (e.g. heading size + bold)
        text.forEach((segment) => {
            // a default font applies to every line, but inline [font:...] overrides win
            const font = blockFont || defaultFont
            if (font && !segment.style.includes("font-family:")) segment.style = `font-family:${font};` + segment.style
            segment.style = lineStyle + segment.style
        })
        lines.push({ align: lineAlign, text })
    })

    const item: Item = {
        style: template?.itemStyle || DEFAULT_ITEM_STYLE,
        type: "text",
        // "none" lets each line keep its own font-size (headings stay large).
        // shrinkToFit would override every line to a single autosized size.
        textFit: "none",
        lines,
        ...(boxCss ? { align: boxCss } : {})
    }

    if (template) {
        if (template.textColor) item.style += `color:${template.textColor};`
        if (template.fontSize) item.style += `font-size:${template.fontSize};`
    }

    return item
}

// --- reverse: existing FreeShow -> markdown source ------------------------------

// map a styled text segment back to the closest inline markdown token
export function segmentToMarkdown(segment: { value: string; style?: string }): string {
    const style = segment.style || ""
    const value = segment.value

    const size = style.match(/font-size\s*:\s*(\d+)px/)
    const bold = /font-weight\s*:\s*(bold|\d+)/.test(style)
    const italic = /font-style\s*:\s*italic/.test(style)
    const underline = /text-decoration\s*:\s*underline/.test(style)

    // keep nested marks inside a size token so the round trip stays lossless
    if (size) {
        let markdown = bold ? `**${value}**` : value
        if (italic) markdown = `*${markdown}*`
        if (underline) markdown = `__${markdown}__`
        return `[size:${size[1]}]${markdown}[/size]`
    }
    if (bold) return `**${value}**`
    if (italic) return `*${value}*`
    if (underline) return `__${value}__`
    return value
}

// Convert a loaded FreeShow into FreeNote markdown source (one block per slide).
// Only text items are kept; media items are skipped.
export function showToMarkdown(show: Show): string {
    if (!show?.slides) return ""

    const layoutId = show.settings?.activeLayout || Object.keys(show.layouts || {})[0]
    const layoutSlides = show.layouts?.[layoutId]?.slides
    const slideIds = layoutSlides?.length ? layoutSlides.map((s) => s.id) : Object.keys(show.slides)

    const blocks: string[] = []
    for (const slideId of slideIds) {
        const slide = show.slides[slideId]
        if (!slide) continue

        const blockLines: string[] = []
        for (const item of slide.items || []) {
            if (item?.type !== undefined && item.type !== "text") continue
            if (!item.lines?.length) continue
            for (const line of item.lines) {
                const markdownLine = (line.text || []).map(segmentToMarkdown).join("")
                if (markdownLine.trim()) blockLines.push(markdownLine)
            }
        }
        if (blockLines.length) blocks.push(blockLines.join("\n"))
    }

    return blocks.join("\n---\n")
}
