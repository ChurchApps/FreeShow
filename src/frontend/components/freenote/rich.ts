// ----- FreeNote rich-text pipeline -----
// The TipTap editor produces plain HTML. `---` (a horizontal rule) splits the
// document into one chunk per slide. Every chunk goes through DOMPurify before
// it becomes a FreeShow Item (XSS gate — hard requirement) and before any
// preview uses `{@html}`.

import type { Item, Line } from "../../../types/Show"
import type { FreeNoteTemplate } from "./freeNote"

// lazy import so the module stays importable in non-browser (vitest node) runs
// without a window: sanitizeRich only touches DOMPurify when called, and
// htmlToItems only touches DOMParser when called.
import DOMPurify from "dompurify"

// the only tags/attributes we accept from the editor
export const RICH_ALLOWED_TAGS = ["div", "p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "br", "hr", "ul", "ol", "li", "blockquote", "pre", "em", "strong", "b", "i", "u", "s", "strike", "del", "code", "sub", "sup", "a", "mark", "table", "tbody", "thead", "tr", "td", "th"]
export const RICH_ALLOWED_ATTR = ["style", "href", "rel", "target", "title", "src", "alt", "colspan", "rowspan"]

// the only CSS properties we accept inside style="" (strips everything else,
// including position:/expression()/url(javascript:) which DOMPurify alone lets
// through verbatim — keeps the sanitize gate honest as an XSS barrier)
const RICH_ALLOWED_CSS = new Set(["color", "background-color", "font-family", "font-size", "font-style", "font-weight", "text-decoration", "text-align", "text-transform", "vertical-align", "line-height", "letter-spacing", "word-spacing", "white-space", "text-shadow", "-webkit-text-stroke-width", "-webkit-text-stroke-color", "paint-order"])

function cleanStyles(html: string): string {
    return html.replace(/style\s*=\s*("([^"]*)"|'([^']*)')/gi, (match, _raw, double, single) => {
        const value = double ?? single ?? ""
        const kept = value
            .split(";")
            .map((decl) => decl.trim())
            .filter(Boolean)
            .map((decl) => {
                const colon = decl.indexOf(":")
                if (colon < 0) return ""
                const prop = decl.slice(0, colon).trim().toLowerCase()
                const val = decl.slice(colon + 1).trim()
                if (!RICH_ALLOWED_CSS.has(prop)) return ""
                if (/expression\s*\(/i.test(val) || /url\s*\(\s*["']?javascript:/i.test(val)) return ""
                return `${prop}:${val};`
            })
            .join("")
        const quote = double !== undefined ? '"' : "'"
        if (!kept) return ""
        return `style=${quote}${kept}${quote}`
    })
}

// SECURITY GATE: every editor chunk (and the preview) must pass through here.
export function sanitizeRich(html: string): string {
    return DOMPurify.sanitize(cleanStyles(String(html ?? "")), { ALLOWED_TAGS: RICH_ALLOWED_TAGS, ALLOWED_ATTR: RICH_ALLOWED_ATTR })
}

// Full rich document -> one chunk per slide. Horizontal rules (`<hr>` = the
// markdown `---`) split the document into chunks.
export function chunkRichHtml(html: string): string[] {
    return sanitizeRich(html)
        .split(/<hr\s*\/?>/gi)
        .map((chunk) => chunk.trim())
        .filter((chunk) => visibleText(chunk).length > 0)
}

// true when a chunk carries real text (not just empty <p>/<br> wrappers)
function visibleText(html: string): string {
    return html
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
}

// ---- projection text treatment (VideoPsalm OutlinedText idea, native CSS) ----

export const FREE_NOTE_PROJECTIONS: { id: string; label: string; style: string }[] = [
    { id: "", label: "none", style: "" },
    { id: "outline", label: "outline", style: "-webkit-text-stroke-width:2px;-webkit-text-stroke-color:#000000;paint-order:stroke fill;" },
    { id: "shadow", label: "shadow", style: "text-shadow:0px 0px 24px rgba(0,0,0,0.85);" },
    { id: "contrast", label: "contrast", style: "color:#ffffff;-webkit-text-stroke-width:3px;-webkit-text-stroke-color:#000000;paint-order:stroke fill;text-shadow:0px 0px 24px rgba(0,0,0,0.7);" }
]

export function getProjectionStyle(id: string): string {
    return FREE_NOTE_PROJECTIONS.find((a) => a.id === id)?.style || ""
}

// ---- HTML -> FreeShow items ----

// default full-screen text box (mirrors FreeShow's DEFAULT_ITEM_STYLE)
const DEFAULT_ITEM_STYLE = "top:88px;left:50px;height:904px;width:1820px;"

const V_ALIGN_CSS: Record<string, string> = { top: "align-items:flex-start;", center: "", bottom: "align-items:flex-end;" }
// horizontal position drives the default per-line text-align (FreeShow's model)
const H_POS_CSS: Record<string, string> = { left: "text-align:left;", center: "text-align:center;", right: "text-align:right;" }

const HEADING_SIZES: Record<string, string> = { h1: "360px", h2: "240px", h3: "180px", h4: "140px", h5: "120px", h6: "100px" }
const LINK_COLOR = "#6bc5ff"
const MARK_COLOR = "#ffd63c"

const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "pre"])
const VOID_TAGS = new Set(["br", "hr"])

type Seg = { value: string; style: string }

function parseDoc(html: string): HTMLElement {
    if (typeof DOMParser === "undefined") return null as unknown as HTMLElement
    return new DOMParser().parseFromString(html, "text/html").body
}

// contribution of a single inline element to the ongoing CSS accumulator
function inlineCss(el: HTMLElement, css: string): string {
    const tag = el.tagName.toLowerCase()
    if (tag === "b" || tag === "strong") return mergeCss(css, "font-weight:bold;")
    if (tag === "i" || tag === "em") return mergeCss(css, "font-style:italic;")
    if (tag === "u") return mergeCss(css, "text-decoration:underline;")
    if (tag === "s" || tag === "strike" || tag === "del") return mergeCss(css, "text-decoration:line-through;")
    if (tag === "code") return mergeCss(css, "font-family:monospace;")
    if (tag === "sub") return mergeCss(css, "vertical-align:sub;")
    if (tag === "sup") return mergeCss(css, "vertical-align:super;")
    if (tag === "a") return mergeCss(css, `color:${LINK_COLOR};`)
    if (tag === "mark") return mergeCss(css, `background-color:${MARK_COLOR};`)
    return mergeCss(css, el.getAttribute("style") || "")
}

// merge new CSS declarations over existing ones (later declarations win)
function mergeCss(base: string, extra: string): string {
    if (!extra) return base
    const map: { [key: string]: string } = {}
    ;(base + ";" + extra).split(";").forEach((decl) => {
        const index = decl.indexOf(":")
        if (index < 0) return
        const key = decl.slice(0, index).trim()
        if (!key) return
        map[key] = decl.slice(index + 1).trim()
    })
    return Object.entries(map)
        .map(([key, value]) => `${key}:${value};`)
        .join("")
}

// note: strip the browser prefix that Chrome adds to typed colors like rgb(...)
function rawCss(el: HTMLElement): string {
    return el.getAttribute("style") || ""
}

// collect inline segments inside an element (recursive)
function collectInline(el: Element, css: string, sink: Seg[]): void {
    el.childNodes.forEach((node) => {
        if (node.nodeType === 3) {
            const value = node.textContent || ""
            if (value) sink.push({ value, style: css })
            return
        }
        if (node.nodeType !== 1) return
        const child = node as HTMLElement
        const tag = child.tagName.toLowerCase()
        if (tag === "br") {
            sink.push({ value: "\n", style: css })
            return
        }
        if (VOID_TAGS.has(tag)) return
        if (tag === "table") {
            // a table inside a block: flatten its cells as lines elsewhere; skip here
            return
        }
        collectInline(child, inlineCss(child, css), sink)
    })
}

type BlockContext = {
    defaultAlign: string
    defaultFont: string
    projectionCss: string
    template: FreeNoteTemplate | null
    table: Item | null
    lines: Line[]
}

// extract the per-block text-align from a css string
function cssTextAlign(css: string): string {
    if (!css) return ""
    // text-align may be set either on its own or with other props
    const matches = css.match(/(?:^|;)text-align\s*:\s*([^;]+)/)
    if (!matches) return ""
    return `text-align:${matches[1].trim()};`
}

// split the accumulated segments (which may contain \n sentinels for <br>) into lines
function splitSegmentsByNewline(segs: Seg[]): Seg[][] {
    const lines: Seg[][] = []
    let current: Seg[] = []
    segs.forEach((seg) => {
        const parts = seg.value.split("\n")
        parts.forEach((part, index) => {
            if (index > 0) {
                lines.push(current)
                current = []
            }
            if (part) current.push({ value: part, style: seg.style })
        })
    })
    lines.push(current)
    return lines
}

function trimSegments(segs: Seg[]): void {
    while (segs.length && !segs[0].value.trim()) segs.shift()
    if (!segs.length) return
    const first = segs[0]
    if (first.value.startsWith(" ") || first.value.startsWith("\u00A0")) first.value = first.value.replace(/^[ \u00A0]+/, "")
    const last = segs[segs.length - 1]
    if (/( |\u00A0)$/.test(last.value)) last.value = last.value.replace(/[ \u00A0]+$/, "")
}

function buildLine(ctx: BlockContext, segs: Seg[], align: string, lineStyle: string): Line | null {
    trimSegments(segs)
    if (!segs.length) return null
    const text = segs
        .filter((seg) => seg.value)
        .map((seg) => {
            let style = lineStyle + ctx.projectionCss
            if (ctx.defaultFont && !/font-family/.test(style) && !/font-family/.test(seg.style)) style += `font-family:${ctx.defaultFont};`
            style += seg.style
            return { value: seg.value, style }
        })
    if (!text.some((t) => t.value.trim())) return null
    return { align, text }
}

// one block element (p/h1-6/li/...) -> its lines
function blockToLines(el: HTMLElement, ctx: BlockContext, opts: { lineStyle?: string; align?: string; listMarker?: string }): void {
    const css = rawCss(el)
    const tag = el.tagName.toLowerCase()

    let lineStyle = opts.lineStyle || ""
    if (HEADING_SIZES[tag]) lineStyle += `font-size:${HEADING_SIZES[tag]};font-weight:bold;`
    // keep other block-level css (font-size on the paragraph etc.) except text-align
    if (css) lineStyle += css.replace(cssTextAlign(css), "")

    // the element's own text-align wins over an inherited parent alignment
    const align = cssTextAlign(css) || opts.align || ctx.defaultAlign

    // list marker prefix
    const marker = opts.listMarker || ""

    const segments: Seg[] = []
    if (marker) segments.push({ value: marker, style: "" })

    const flush = () => {
        const split = splitSegmentsByNewline(segments.splice(0))
        split.forEach((lineSegs) => {
            if (!lineSegs.length) return
            const line = buildLine(ctx, lineSegs, align, lineStyle)
            if (line) ctx.lines.push(line)
        })
    }

    el.childNodes.forEach((node) => {
        if (node.nodeType === 3) {
            const value = node.textContent || ""
            // collapsed whitespace could be multiple spaces; keep as-is
            if (value) segments.push({ value, style: "" })
            return
        }
        if (node.nodeType !== 1) return
        const child = node as HTMLElement
        const childTag = child.tagName.toLowerCase()
        if (childTag === "br") {
            segments.push({ value: "\n", style: "" })
            return
        }
        if (VOID_TAGS.has(childTag)) return
        if (childTag === "table") {
            flush()
            buildTableItem(child, ctx)
            return
        }
        if (childTag === "ul" || childTag === "ol") {
            flush()
            buildList(child, ctx)
            return
        }
        if (BLOCK_TAGS.has(childTag)) {
            // nested block (e.g. a <p> inside a <li>): flush and recurse
            flush()
            blockToLines(child, ctx, { lineStyle, align })
            return
        }
        // inline
        collectInline(child, inlineCss(child, ""), segments)
    })
    flush()
}

function buildList(el: HTMLElement, ctx: BlockContext): void {
    const ordered = el.tagName.toLowerCase() === "ol"
    let counter = 0
    Array.from(el.children)
        .filter((child) => child.tagName.toLowerCase() === "li")
        .forEach((li) => {
            counter++
            const marker = ordered ? `${counter}. ` : "• "
            blockToLines(li as HTMLElement, ctx, { listMarker: marker })
        })
}

// a <table> element -> one FreeShow table item
function buildTableItem(el: HTMLElement, ctx: BlockContext): void {
    if (ctx.table) return // one table per slide
    const rowsValue: { cells: { text: string; style?: string }[] }[] = []
    let hasHeader = false

    const cellsOf = (row: HTMLElement) => {
        const cells: { text: string; style?: string }[] = []
        Array.from(row.children).forEach((cellEl) => {
            if (cellEl.tagName.toLowerCase() !== "td" && cellEl.tagName.toLowerCase() !== "th") return
            if (cellEl.tagName.toLowerCase() === "th") hasHeader = true
            const cellSegs: Seg[] = []
            collectInline(cellEl, "", cellSegs)
            const text = cellSegs
                .map((seg) => seg.value.replace(/\n/g, " "))
                .join("")
                .trim()
            let style = cellSegs.length ? cellSegs.map((seg) => seg.style).join("") : ""
            if (cellEl.tagName.toLowerCase() === "th") style = "font-weight:bold;" + style + "background-color:rgba(255,255,255,0.08);"
            cells.push(style ? { text, style } : { text })
        })
        return cells
    }

    Array.from(el.querySelectorAll("tr")).forEach((row) => {
        rowsValue.push({ cells: cellsOf(row as HTMLElement) })
    })
    if (!rowsValue.length) return

    const alignCss = cssTextAlign(rawCss(el))
    ctx.table = {
        style: DEFAULT_ITEM_STYLE,
        type: "table",
        table: { headers: hasHeader, rows: rowsValue },
        ...(alignCss ? { align: alignCss } : {})
    } as Item
}

// process every top-level block of a chunk
function processTopLevel(root: HTMLElement, ctx: BlockContext): void {
    root.childNodes.forEach((node) => {
        if (node.nodeType === 3) {
            const value = node.textContent || ""
            if (value.trim()) {
                const line = buildLine(ctx, [{ value, style: "" }], ctx.defaultAlign, "")
                if (line) ctx.lines.push(line)
            }
            return
        }
        if (node.nodeType !== 1) return
        const el = node as HTMLElement
        const tag = el.tagName.toLowerCase()
        if (tag === "table") {
            buildTableItem(el, ctx)
            return
        }
        if (tag === "ul" || tag === "ol") {
            buildList(el, ctx)
            return
        }
        if (BLOCK_TAGS.has(tag)) {
            blockToLines(el, ctx, {})
            return
        }
        // stray inline element at top level
        const segs: Seg[] = []
        collectInline(el, inlineCss(el, ""), segs)
        const split = splitSegmentsByNewline(segs)
        split.forEach((lineSegs) => {
            const line = buildLine(ctx, lineSegs, ctx.defaultAlign, "")
            if (line) ctx.lines.push(line)
        })
    })
}

// One sanitized HTML chunk -> FreeShow items for a slide.
// `defaultFont` and `projection` mirror the markdown pipeline's defaults.
export function htmlToItems(chunkHtml: string, template: FreeNoteTemplate | null = null, vertical = "", horizontal = "", defaultFont = "", projection = ""): Item[] {
    const root = parseDoc(sanitizeRich(chunkHtml))
    if (!root) return []

    const effectiveAlign = (horizontal && H_POS_CSS[horizontal]) || template?.textAlign || "text-align:center;"
    const boxCss = (vertical && V_ALIGN_CSS[vertical]) || ""

    const ctx: BlockContext = {
        defaultAlign: effectiveAlign,
        defaultFont,
        projectionCss: getProjectionStyle(projection),
        template,
        table: null,
        lines: []
    }

    processTopLevel(root, ctx)

    const items: Item[] = []
    if (ctx.lines.length) {
        const item: Item = {
            style: template?.itemStyle || DEFAULT_ITEM_STYLE,
            type: "text",
            textFit: "none",
            lines: ctx.lines,
            ...(boxCss ? { align: boxCss } : {})
        }
        if (template) {
            if (template.textColor) item.style += `color:${template.textColor};`
            if (template.fontSize) item.style += `font-size:${template.fontSize};`
        }
        items.push(item)
    }
    if (ctx.table) {
        // position the table below an optional text block
        ctx.table.style = `${DEFAULT_ITEM_STYLE}top:${ctx.lines.length ? 400 : 200}px;height:${ctx.lines.length ? 600 : 700}px;`
        items.push(ctx.table)
    }
    return items
}

// ---- reverse helpers (mode switching / export) ----

// walk the sanitized inline content and emit markdown tokens (bold/italic/
// underline/links/code). Only tokens the FreeNote compiler understands are
// emitted; marks it cannot round-trip (sub/sup/strike/highlight) become plain
// text so re-import never shows literal `~x~`/`^x^`/`~~x~~`/`==x==` junk.
function inlineToMarkdown(child: ChildNode, out: string[]): void {
    const node = child as HTMLElement
    const tag = node.tagName ? node.tagName.toLowerCase() : ""
    const text = (child.textContent || "").replace(/\s+/g, " ").trim()

    if (tag === "br") {
        out.push("\n")
        return
    }
    if (node.nodeType === 3 || !tag) {
        const value = child.textContent || ""
        if (value) out.push(value)
        return
    }
    if (!text) return
    if (tag === "a") {
        const href = node.getAttribute("href") || ""
        out.push(`[${text}](${href})`)
        return
    }
    if (tag === "strong" || tag === "b") return out.push(`**${text}**`)
    if (tag === "em" || tag === "i") return out.push(`*${text}*`)
    if (tag === "u") return out.push(`__${text}__`)
    if (tag === "code") return out.push(`\`${text}\``)
    if (tag === "span") return inlineContainerToMarkdown(node, out)
    // generic inline element (incl. sub/sup/s/strike/del/mark, which the
    // markdown compiler cannot round-trip): emit its text plainly
    Array.from(node.childNodes).forEach((n) => inlineToMarkdown(n, out))
}

function inlineContainerToMarkdown(el: HTMLElement, out: string[]): void {
    // span with an inline style: map size/family to FreeNote tokens
    const css = el.getAttribute("style") || ""
    const size = css.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/)
    const family = css.match(/font-family\s*:\s*('?)([^;]+?)\1/)
    const style = css.match(/font-style\s*:\s*italic/)
    const weight = css.match(/font-weight\s*:\s*(bold|\d+)/)
    const align = css.match(/text-align\s*:\s*(left|center|right)/)

    const inner: string[] = []
    if (align) inner.push(`[align:${align[1]}]`)
    Array.from(el.childNodes).forEach((n) => inlineToMarkdown(n, inner))
    let text = inner.join("")

    if (style && /^i$/i.test(el.tagName || "")) text = `*${text}*`
    if (weight) text = `**${text}**`
    if (size) text = `[size:${Math.round(Number(size[1]))}]${text}[/size]`
    if (family) text = `[font:${family[1]}${family[2].trim()}${family[1]}]${text}[/font]`
    if (text) out.push(text)
}

// one block element -> its markdown line(s)
function blockToMarkdown(el: HTMLElement, out: string[]): void {
    const tag = el.tagName.toLowerCase()
    if (tag === "ul" || tag === "ol") {
        const ordered = tag === "ol"
        let counter = 0
        Array.from(el.children)
            .filter((c) => c.tagName.toLowerCase() === "li")
            .forEach((li) => {
                counter++
                const inner: string[] = []
                Array.from(li.childNodes).forEach((n) => inlineToMarkdown(n, inner))
                out.push(`${ordered ? `${counter}. ` : "- "}${inner.join("").trim()}`)
            })
        return
    }
    if (tag === "blockquote") {
        // the FreeNote compiler does not strip a `> ` quote prefix, so emit the
        // content plainly to keep the round-trip free of literal `>` markers
        const inner: string[] = []
        Array.from(el.childNodes).forEach((n) => inlineToMarkdown(n, inner))
        inner.forEach((line) => out.push(line.trim()))
        return
    }
    if (tag === "pre") {
        out.push("```", (el.textContent || "").trim(), "```")
        return
    }
    if (tag === "table") {
        // FreeNote markdown has no table syntax; flatten each row to plain text
        Array.from(el.querySelectorAll("tr")).forEach((row) => {
            const cells = Array.from(row.children)
                .map((c) => (c.textContent || "").trim())
                .filter(Boolean)
                .join(" | ")
            if (cells) out.push(cells)
        })
        return
    }
    if (tag === "p" || tag === "div" || tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6" || tag === "li") {
        const prefix = tag.startsWith("h") ? Array(Number(tag[1]) + 1).join("#") + " " : ""
        const inner: string[] = []
        Array.from(el.childNodes).forEach((n) => inlineToMarkdown(n, inner))
        const css = el.getAttribute("style") || ""
        const align = css.match(/text-align\s*:\s*(left|center|right)/)
        const line = (align ? `[align:${align[1]}]` : "") + prefix + inner.join("").trim()
        if (line.trim()) out.push(line)
        return
    }
    // fallback: recurse
    Array.from(el.childNodes).forEach((n) => {
        if ((n as HTMLElement).childNodes?.length && (n as HTMLElement).tagName) blockToMarkdown(n as HTMLElement, out)
        else inlineToMarkdown(n, out)
    })
}

function chunkToMarkdown(chunkHtml: string): string {
    const root = parseDoc(sanitizeRich(chunkHtml))
    if (!root) return ""
    const out: string[] = []
    Array.from(root.childNodes).forEach((node) => {
        const el = node as HTMLElement
        if (el && el.tagName) blockToMarkdown(el, out)
        else inlineToMarkdown(node, out)
    })
    return out.filter((line) => line.trim()).join("\n")
}

// rich HTML -> markdown source (mode switching / export). Each slide chunk is
// joined by the standard FreeNote slide separator.
export function htmlToMarkdown(html: string): string {
    return chunkRichHtml(html)
        .map((chunk) => chunkToMarkdown(chunk))
        .filter((chunk) => chunk.trim().length > 0)
        .join("\n---\n")
}

// flatten one chunk into plain lines (used for titles + b:/h: shortcodes)
function chunkToPlainLines(chunkHtml: string): string[] {
    const root = parseDoc(sanitizeRich(chunkHtml))
    if (!root) return []
    const ctx: BlockContext = {
        defaultAlign: "",
        defaultFont: "",
        projectionCss: "",
        template: null,
        table: null,
        lines: []
    }
    processTopLevel(root, ctx)
    return ctx.lines.map((line) => line.text.map((t) => t.value).join(""))
}

// plain text of the first slide (used for titles + b:/h: shortcodes)
export function plainTextOfChunk(html: string): string {
    return chunkToPlainLines(html).join(" ").trim()
}
