// Root structure:
// [Content_Types].xml
// _rels/
// ppt/
//   presentation.xml
//   _rels/
//   slides/
//   slideLayouts/
//   slideMasters/
//   theme/
//   media/

import type { Item, Line } from "../../../types/Show"
import { getItemText } from "../../components/edit/scripts/textStyle"
import { clone } from "../../components/helpers/array"
import { getCustomShapePath, getPresetShapePath } from "./powerpointShapes"

export interface Relationship {
    id: string // rIdX
    type: string // relationship type URI
    target: string // relative path
    // targetMode?: "Internal" | "External"
}

export abstract class OpcPart<T = any> {
    constructor(
        public readonly path: string,
        public readonly json: T,
        public readonly relationships: Relationship[],
        protected readonly partResolver: PartResolver
    ) {}

    getRelationship(type: string): Relationship | undefined {
        return this.relationships.find((r) => r.type === type)
    }

    getRelationships(type: string): Relationship[] {
        return this.relationships.filter((r) => r.type === type)
    }

    resolve<TPart extends OpcPart>(rel: Relationship): TPart | null {
        return this.partResolver.resolve<TPart>(this.path, rel.target)
    }
}

export class PartResolver {
    private instances = new Map<string, OpcPart>()

    constructor(
        private readonly parts: Map<string, any>,
        private readonly rels: Map<string, Relationship[]>
    ) {}

    getRelationshipsFor(path: string): Relationship[] {
        return this.rels.get(path) || []
    }

    get<T extends OpcPart>(path: string): T | null {
        const normalized = path.replace(/^\/+/, "")
        if (this.instances.has(normalized)) return this.instances.get(normalized) as T

        const json = this.parts.get(normalized)
        const relationships = this.rels.get(normalized) || []

        let inst: OpcPart | undefined
        if (normalized === "ppt/presentation.xml") inst = new PresentationPart(normalized, json, relationships, this)
        else if (normalized.startsWith("ppt/slides/")) inst = new SlidePart(normalized, json, relationships, this)
        else if (normalized.startsWith("ppt/notesSlides/")) inst = new SlidePart(normalized, json, relationships, this)
        else if (normalized.startsWith("ppt/slideLayouts/")) inst = new SlideLayoutPart(normalized, json, relationships, this)
        else if (normalized.startsWith("ppt/slideMasters/")) inst = new SlideMasterPart(normalized, json, relationships, this)
        else if (normalized.startsWith("ppt/theme/")) inst = new ThemePart(normalized, json, relationships, this)
        // else if (normalized.startsWith("ppt/media/")) inst = new MediaPart(normalized, json, relationships, this)

        if (!inst) return null
        this.instances.set(normalized, inst)
        return inst as T
    }

    resolve<T extends OpcPart>(fromPath: string, target: string): T | null {
        const resolvedPath = resolveOpcPath(fromPath, target)
        const part = this.get<T>(resolvedPath)
        if (!part) return null
        return part
    }
}

/////

class PresentationPart extends OpcPart {
    private get slideIds(): { ":@": { id?: string; ["r:id"]?: string }; "p:sldId": [] }[] {
        return getValue(this.json, "p:presentation", "p:sldIdLst")
    }

    // Return ordered slide targets (e.g. "ppt/slides/slide1.xml") matching the presentation relationship targets
    get slideOrder(): string[] {
        const ids = this.slideIds
        const rels = this.relationships
        return ids
            .map((idNode) => {
                const rid = getRid(idNode)
                const rel = rid ? rels.find((r) => r.id === rid || String(r.id) === String(rid)) : undefined
                return getTarget(this.path, rel)
            })
            .filter(Boolean) as string[]
    }

    // Slide size from presentation (EMU) and converted to pixels
    get slideSize() {
        const p = getValue(this.json, "p:presentation")
        const cx = getAttribute(p, "cx", "p:sldSz")
        const cy = getAttribute(p, "cy", "p:sldSz")
        return { cx, cy, width: round(emuToPixels(cx)), height: round(emuToPixels(cy)) }
    }

    get slides(): SlidePart[] {
        const rels = this.getRelationships("http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide")
        return rels
            .map((r) => {
                try {
                    return this.resolve<SlidePart>(r)
                } catch (e) {
                    return null
                }
            })
            .filter(Boolean) as SlidePart[]
    }

    get slideMasters(): SlideMasterPart[] {
        const rels = this.getRelationships("http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster")
        return rels
            .map((r) => {
                try {
                    return this.resolve<SlideMasterPart>(r)
                } catch (e) {
                    return null
                }
            })
            .filter(Boolean) as SlideMasterPart[]
    }
}

class SlidePart extends OpcPart {
    get layout() {
        const rel = this.getRelationship("http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout")
        if (!rel) return null
        return this.resolve<SlideLayoutPart>(rel)
    }

    get shapes(): Shape[] {
        return getValue(this.json, "p:sld", "p:cSld", "p:spTree")
    }
}

class SlideLayoutPart extends OpcPart {
    get master() {
        const rel = this.getRelationship("http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster")
        if (!rel) return null
        return this.resolve<SlideMasterPart>(rel)
    }

    get shapes(): Shape[] {
        return getValue(this.json, "p:sldLayout", "p:cSld", "p:spTree")
    }
}

class SlideMasterPart extends OpcPart {
    get layouts(): SlideLayoutPart[] {
        const rels = this.getRelationships("http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout")
        return rels
            .map((r) => {
                try {
                    return this.resolve<SlideLayoutPart>(r)
                } catch (e) {
                    return null
                }
            })
            .filter(Boolean) as SlideLayoutPart[]
    }

    get theme() {
        const rel = this.getRelationship("http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme")
        if (!rel) return null
        return this.resolve<ThemePart>(rel)
    }

    get textStyles() {
        return getValue(this.json, "p:sldMaster", "p:txStyles")
    }

    get shapes(): Shape[] {
        return getValue(this.json, "p:sldMaster", "p:cSld", "p:spTree")
    }
}

class ThemePart extends OpcPart {
    get colorScheme() {
        return getValue(this.json, "a:theme", "a:themeElements", "a:clrScheme")
    }

    get fontScheme() {
        return getValue(this.json, "a:theme", "a:themeElements", "a:fontScheme")
    }

    get formatScheme() {
        return getValue(this.json, "a:theme", "a:themeElements", "a:fmtScheme")
    }
}

// class MediaPart extends OpcPart {
//     public readonly filesystemPath?: string

//     constructor(path: string, json: any, relationships: Relationship[], partResolver: PartResolver, filesystemPath?: string) {
//         super(path, json, relationships, partResolver)
//         this.filesystemPath = filesystemPath
//     }

//     get images(): MediaPart[] {
//         const rels = this.getRelationships("http://schemas.openxmlformats.org/officeDocument/2006/relationships/image")

//         return rels
//             .map((r) => {
//                 try {
//                     return this.resolve<MediaPart>(r)
//                 } catch (e) {
//                     const target = String(r.target || "").replace(/^\/+/, "")
//                     return this.partResolver.get<MediaPart>(target) as MediaPart
//                 }
//             })
//             .filter(Boolean) as MediaPart[]
//     }
// }

// class ContentTypesPart {
//     constructor(public readonly json: any) {}

//     getType(path: string): string | null {
//         const j = this.json || {}
//         const types = j.Types || j["ct:Types"] || j

//         const overrides = types.Override || types.Overrides || []
//         const findOverride = (Array.isArray(overrides) ? overrides : [overrides]).find((o: any) => {
//             const name = o.PartName || o.partName || o["@PartName"]
//             if (!name) return false
//             // partName in XML usually starts with '/'
//             return name.replace(/^\/+/, "") === path.replace(/^\/+/, "")
//         })

//         if (findOverride) return findOverride.ContentType || findOverride.contentType || findOverride["@ContentType"]

//         const defaults = types.Default || []
//         const ext = path.split(".").pop() || ""
//         const findDefault = (Array.isArray(defaults) ? defaults : [defaults]).find((d: any) => (d.Extension || d.extension || d["@Extension"]) === ext)

//         return findDefault ? findDefault.ContentType || findDefault.contentType || findDefault["@ContentType"] : null
//     }
// }

/////

export class PowerPointPackage {
    public readonly parts: Map<string, any> = new Map()
    public readonly rels: Map<string, Relationship[]> = new Map()
    public readonly resolver: PartResolver
    public readonly contentPaths: Record<string, string> = {}

    constructor(jsonContent: any) {
        if (!jsonContent) throw new Error("No jsonContent provided")

        if (jsonContent.contentPaths && typeof jsonContent.contentPaths === "object") {
            Object.assign(this.contentPaths, jsonContent.contentPaths)
        }

        const entries = Object.entries<any[]>(jsonContent)

        for (const [rawPath, value] of entries) {
            if (!rawPath) continue
            if (rawPath === "contentPaths") continue
            if (value == null) continue

            const path = String(rawPath).replace(/^\/+/, "").replace(/\\/g, "/")

            if (path.endsWith(".rels") || path.includes("/_rels/")) {
                let owner = path.replace(/(^|\/)_(rels)\//, "/").replace(/\.rels$/i, "")
                owner = owner.replace("/_rels/", "/").replace(/^\/+/, "")

                const rels = getValue(value, "Relationships")

                const normRels = rels.map((r: any) => {
                    const id = getAttribute(r, "Id")
                    const type = getAttribute(r, "Type")
                    const target = getAttribute(r, "Target").replace(/^\/+/, "")
                    // const targetMode = getAttribute(r, "TargetMode")
                    return { id, type, target } as Relationship
                })

                this.rels.set(owner, normRels)
                continue
            }

            this.parts.set(path, value)
        }

        this.resolver = new PartResolver(this.parts, this.rels)
    }

    getPresentation(): PresentationPart | null {
        return this.resolver.get<PresentationPart>("ppt/presentation.xml")
    }

    getSlides() {
        const presentation = this.getPresentation()
        if (!presentation) return []
        // console.log("Presentation:", presentation)

        const slides: ReturnType<typeof this.getSlide>[] = []

        for (const target of presentation.slideOrder) {
            const slide = this.getSlide(presentation, target)
            if (slide) slides.push(slide)
        }

        return slides
    }

    private resolveSlide(presentation: PresentationPart, target: string): SlidePart | null {
        // Try direct lookup first
        let slide = this.resolver.get<SlidePart>(target)
        if (slide) return slide

        slide = this.resolver.resolve<SlidePart>(presentation.path, target)
        if (slide) return slide

        // Best-effort: try normalizing by stripping leading 'ppt/' or slashes
        const alt = String(target)
            .replace(/^ppt\//, "")
            .replace(/^\/+/, "")
        return this.resolver.get<SlidePart>(alt)
    }

    private getColorScheme(theme: ThemePart | null, master: SlideMasterPart | null, layout: SlideLayoutPart | null): { [key: string]: any }[] {
        if (!theme) return []

        const colors = clone(theme.colorScheme)

        const masterColorMap = getAttributes(getValue(master?.json, "p:sldMaster"), "p:clrMap")
        const layoutColorMap = getAttributes(getValue(layout?.json, "p:sldLayout"), "p:clrMap")
        const colorKeys = [...Object.keys(masterColorMap), ...Object.keys(layoutColorMap)]

        colorKeys.forEach((a) => {
            let keyVal = layoutColorMap[a] || masterColorMap[a]
            if (!keyVal.startsWith("a:")) keyVal = `a:${keyVal}`

            const color = colors.find((a) => a[keyVal])
            if (color) colors.push({ ["a:" + a]: color[keyVal] })
        })

        return colors
    }

    // Compute target-normalized scaling to map original slide pixels -> 1920x1080
    private targetWidth = 1920
    private targetHeight = 1080
    private getScale(value: { width?: number; height?: number } | undefined) {
        const scaleX = value?.width && value.width > 0 ? this.targetWidth / value.width : 1
        const scaleY = value?.height && value.height > 0 ? this.targetHeight / value.height : 1

        return { x: scaleX, y: scaleY, factor: (scaleX + scaleY) / 2 }
    }

    getSlide(presentation: PresentationPart, target: string) {
        const slide = this.resolveSlide(presentation, target)
        if (!slide) return null

        let layout = slide?.layout || null
        let master = layout?.master || null
        let theme = master?.theme || null

        const colors = this.getColorScheme(theme, master, layout)

        // Expose raw trees and a merged slideTree (master -> layout -> slide)
        const masterShapes = master?.shapes || []
        const layoutShapes = layout?.shapes || []
        const slideShapes = slide?.shapes || []
        const slideTree = buildRenderList(masterShapes, layoutShapes, slideShapes, master)

        const scale = this.getScale(presentation?.slideSize)

        const items = slideTree.map((n) => this.shapeToItem(n, { presentation, slide, layout, master, theme, colors, scale })).filter(Boolean) as Item[]

        // slide background color
        // let fill = getValue(slide?.json, "p:sld", "p:cSld", "p:bg", "p:bgPr", "a:solidFill")
        // if (!fill.length) fill = getValue(layout?.json, "p:sldLayout", "p:cSld", "p:bg", "p:bgPr", "a:solidFill")
        // if (!fill.length) fill = getValue(master?.json, "p:sldMaster", "p:cSld", "p:bg", "p:bgPr", "a:solidFill")
        const sldSlide = getValue(slide?.json, "p:sld")
        const sldLayout = getValue(layout?.json, "p:sldLayout")
        const sldMaster = getValue(master?.json, "p:sldMaster")
        const fill = getFirstAvailable([sldSlide, sldLayout, sldMaster], "p:cSld", "p:bg", "p:bgPr", "a:solidFill")
        let bgColor = resolveColor(fill, colors)

        // const size = { width: targetWidth, height: targetHeight }

        const notes = this.getSlideNotes(slide)

        const combined = {
            items,
            bgColor,
            notes
            // presentation,
            // slide,
            // layout,
            // master,
            // theme,
            // colors,
            // slideTree,
            // size,
            // layoutTree: layoutShapes,
            // masterTextStyles,
            // slideSize: presentation?.slideSize || null
        }

        return combined
    }

    getSlideNotes(slide: SlidePart | null) {
        if (!slide) return ""

        const rel = slide.getRelationship("http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide")
        if (!rel) return ""

        const notesPart = slide.resolve<SlidePart>(rel)
        const notesShapes = getValue(notesPart?.json, "p:notes", "p:cSld", "p:spTree")

        return this.getPlainText(notesShapes)
    }

    private getPlainText(shapes: any[]) {
        let text = ""

        for (const shape of shapes) {
            const psp = shape["p:sp"] || []

            for (const sp of psp) {
                const txBody = sp["p:txBody"] || []
                const paragraphs = getValues(txBody, "a:p")

                for (const p of paragraphs) {
                    const texts = getValues(p, "a:r")

                    for (const t of texts) {
                        const tNode = getValue(t, "a:t")
                        text += tNode?.[0]?.["#text"] || ""
                    }

                    text += "\n"
                }
            }
        }

        return text.trim()
    }

    private shapeToItem(
        shape: { name: string; shape: Shape; layoutShape: Shape; masterShape: Shape; txStyles: any[]; isDecoration?: boolean },
        ctx: {
            presentation: PresentationPart
            slide: SlidePart
            layout: SlideLayoutPart | null
            master: SlideMasterPart | null
            theme: ThemePart | null
            colors: { [key: string]: any }[]
            scale: { x: number; y: number; factor: number }
        }
    ): Item | null {
        if (!Array.isArray(shape.shape)) return null

        // convert font size from 100ths of points to pixels
        function getFontSize(size: number | string) {
            if (isNaN(Number(size))) return 0

            const points = Number(size) / 100
            const dpi = 96
            const px = (points * dpi) / 72

            return round(px * ctx.scale.factor)
        }

        // get layout/master fallback style
        function getPrioritizedStyle(slide: any[], layout: any[], master: any[], txStyles: any[], key: string, tagName: string = "") {
            const s = getAttribute(slide, key, tagName)
            if (s !== "") return s
            // defRPr = only for lvlxpPr
            const l = tagName ? getAttribute(getValue(layout, "a:defRPr"), key, tagName) : getAttribute(layout, key, "a:defRPr")
            if (l !== "") return l
            const m = tagName ? getAttribute(getValue(master, "a:defRPr"), key, tagName) : getAttribute(master, key, "a:defRPr")
            if (m !== "") return m
            const t = tagName ? getAttribute(getValue(txStyles, "a:defRPr"), key, tagName) : getAttribute(txStyles, key, "a:defRPr")
            if (false && t !== "") return t
            return ""
        }

        function getRStyle(r: any[], pPrL: any, pPrM: any, tx: any) {
            let rPr = getValue(r, "a:rPr")
            if (!rPr.length) rPr = getValue(r, "a:endParaRPr")

            const typeface = getPrioritizedStyle(rPr, pPrL, pPrM, tx, "typeface", "a:latin")
            const fontSizePx = getFontSize(getPrioritizedStyle(r, pPrL, pPrM, tx, "sz"))

            const isBold = getPrioritizedStyle(r, pPrL, pPrM, tx, "b") === "1"
            const isItalic = getPrioritizedStyle(r, pPrL, pPrM, tx, "i") === "1"
            const underline = getPrioritizedStyle(r, pPrL, pPrM, tx, "u")
            const isStrikethrough = getPrioritizedStyle(r, pPrL, pPrM, tx, "strike") === "1"

            let color = resolveColor(getValue(rPr, "a:solidFill"), ctx.colors) || resolveColor(getValue(pPrL, "a:defRPr", "a:solidFill"), ctx.colors) || resolveColor(getValue(pPrM, "a:defRPr", "a:solidFill"), ctx.colors) || resolveColor(getValue(tx, "a:defRPr", "a:solidFill"), ctx.colors)
            // if (!color) color = resolveColor(getValue(ctx.colors, "a:lt1"), ctx.colors) || resolveColor(getValue(ctx.colors, "a:tx1"), ctx.colors)

            // outline
            const lnWidth = getAttribute(rPr, "w", "a:ln")
            const lnClr = resolveColor(getValue(rPr, "a:ln", "a:solidFill"), ctx.colors)
            const lnWPx = lnWidth != null ? round(emuToPixels(lnWidth)) : null
            let lnColor = ""
            if (lnWPx != null && lnClr) lnColor = lnClr

            // WIP shadow
            // const shadow = getValue(rPr, "a:effectLst", "a:outerShdw")
            let shadowVal = "text-shadow: 0 0 0 rgb(0 0 0 / 0);"
            // if (shadow.length) {
            //     // const shadowAttrs = getAttrs(shadow[0]) || {}
            // }

            // raised text
            const baseline = getAttribute(r, "baseline") || "0"
            // const subscript = getAttribute(rPr, "val", "a:sub") === "1"
            // const superscript = getAttribute(rPr, "val", "a:sup") === "1"
            let blEm = Number(baseline) / 100000

            let style = ""
            style += `font-family: ${typeface ? typeface + ", " : ""}Calibri;`
            if (fontSizePx) style += `font-size: ${fontSizePx * (blEm ? 0.6 : 1)}px;`
            if (isBold) style += "font-weight: bold;"
            if (isItalic) style += "font-style: italic;"
            if (underline === "sng" || underline === "1") style += "text-decoration: underline;"
            if (underline === "dbl") style += "text-decoration: underline;text-decoration-style: double;"
            if (isStrikethrough) style += "text-decoration: line-through;"
            style += `color: ${color || "#000000"};`
            if (shadowVal) style += shadowVal
            if (blEm) style += `vertical-align: calc(${blEm}em + 10px);`
            if (lnWPx) style += `-webkit-text-stroke-width: ${lnWPx + 0.8}px;paint-order: normal;`
            if (lnColor) style += `-webkit-text-stroke-color: ${lnColor};`

            return style
        }

        function getSharedStyle(pPr: any, pPrL: any, pPrM: any) {
            // line
            // default line spacing is typically set to 1.0, this usually corresponds to roughly 1.2 times the font size
            let lnSpc = getValue(pPr, "a:lnSpc")
            if (!lnSpc.length) lnSpc = getValue(pPrL, "a:lnSpc")
            if (!lnSpc.length) lnSpc = getValue(pPrM, "a:lnSpc")
            const spacing = getAttribute(lnSpc, "val", "a:spcPct") || "100000"
            // 100000 = 100% = apprx 1.2em
            // spacing to em
            const lnEm = (Number(spacing) / 100000) * 1.2

            let style = ""

            if (lnEm > 0) style += `line-height: ${lnEm}em;`

            return style
        }

        const getText = (n: any) => {
            const p = getValues(n, "p:txBody", "a:p")
            const pL = getValues(shape.layoutShape, "p:txBody")
            const pM = getValues(shape.masterShape, "p:txBody")
            if (!p) return []

            let bulletNum = 0
            let hasText = false
            return p
                .map((line, i) => {
                    const pPr = getValue(line, "a:pPr")

                    const lvl = Number(getAttribute(line, "lvl") || "0") + 1

                    // let pPrL = getValue(pL[i] ? pL[i] : pL[0], "a:p", "a:pPr")
                    // let pPrM = getValue(pM[i] ? pM[i] : pM[0], "a:p", "a:pPr")
                    const pPrL = getValue(pL[i] ? pL[i] : pL[0], "a:lstStyle", `a:lvl${lvl}pPr`)
                    const pPrM = getValue(pM[i] ? pM[i] : pM[0], "a:lstStyle", `a:lvl${lvl}pPr`)
                    let tx = getValue(shape.txStyles, `a:lvl${lvl}pPr`)
                    if (!tx.length) tx = getValue(shape.txStyles, "a:defPPr")

                    const sharedStyle = getSharedStyle(pPr, pPrL, pPrM)

                    // let marL: string | number = getAttribute(pPr, "marL") || "0"
                    // marL = round(emuToPixels(marL)) * ctx.scale.factor
                    // let indent: string | number = getAttribute(pPr, "indent") || "0"
                    // indent = round(emuToPixels(indent)) * ctx.scale.factor
                    // // indent is typically negative
                    // if (indent < 0) indent = Math.abs(indent)

                    const buFont = getAttribute(pPr, "typeface", "a:buFont") || getAttribute(pPrL, "typeface", "a:buFont") || getAttribute(pPrM, "typeface", "a:buFont") || "Calibri"
                    const buSize = getAttribute(pPr, "val", "a:buSzPts") || getAttribute(pPrL, "val", "a:buSzPts") || getAttribute(pPrM, "val", "a:buSzPts") || getAttribute(getValue(line, "a:r"), "sz")
                    const buClr = resolveColor(getValue(pPr, "a:buClr"), ctx.colors) || resolveColor(getValue(pPrL, "a:buClr"), ctx.colors) || resolveColor(getValue(pPrM, "a:buClr"), ctx.colors)
                    const buChar = getAttribute(pPr, "char", "a:buChar") || getAttribute(pPrL, "char", "a:buChar") || getAttribute(pPrM, "char", "a:buChar")
                    const autoNum = getAttribute(pPr, "type", "a:buAutoNum") || getAttribute(pPrL, "type", "a:buAutoNum") || getAttribute(pPrM, "type", "a:buAutoNum")
                    // const blip = getAttribute(pPr, "embed", "a:buBlip")
                    // let bulletPadding = `margin-left: ${marL - indent - 5}px;margin-right: ${indent}px;`
                    let bulletPadding = "padding-left: 38px;padding-right: 45px;"
                    let bullet = buChar || autoNum ? { value: buChar, style: `text-shadow: 0 0 0 rgb(0 0 0 / 0);font-family: ${buFont};font-size: ${getFontSize(buSize)}px;color: ${buClr || "#000000"};${bulletPadding}` } : null

                    // WIP split "a:br" properly as it breaks when style is changed

                    // const rs = getValues(line, "a:r")
                    // const br = getValues(line, "a:br")
                    const rs: any[][] = []
                    line.forEach((l) => {
                        if (l["a:r"]) rs.push(l["a:r"])
                        else if (l["a:br"]) {
                            const br = { ...l["a:br"], ["a:t"]: [{ "#text": "<br>" }] }
                            rs.push(br)
                        }
                    })
                    const algn = getAttribute(line, "algn")

                    if (i === 0) hasText = false
                    if (rs.length) hasText = true

                    function getAlignment(algn: string) {
                        if (algn === "ctr") return ""
                        if (algn === "r") return "text-align: right;"
                        return "text-align: left;" // l
                    }

                    let text = rs.length
                        ? rs.map((r) => {
                              // const br = getValue(r, "a:br")
                              const value = (getValue(r, "a:t")[0]?.["#text"]?.toString() || "").replaceAll("\t", "&nbsp;&nbsp;&nbsp;&nbsp;")
                              const style = sharedStyle + getRStyle(r, pPrL, pPrM, tx)
                              return { value, style }
                          }) // .filter((a) => a.value?.length)
                        : hasText
                          ? [
                                {
                                    value: "&nbsp;",
                                    style:
                                        sharedStyle +
                                        getRStyle(
                                            line.find((a) => a["a:endParaRPr"]),
                                            pPrL,
                                            pPrM,
                                            tx
                                        )
                                }
                            ] // space so style (font size) applies
                          : []

                    if (text.length && bullet) {
                        text = [autoNum ? { ...bullet, value: getBulletValue(autoNum, bulletNum) } : bullet, ...text]
                        bulletNum++

                        function getBulletValue(type: string, index: number) {
                            if (type === "arabicPeriod") return `${index + 1}.`
                            if (type === "alphaLcPeriod") return `${String.fromCharCode(97 + index)}.`
                            if (type === "alphaUcPeriod") return `${String.fromCharCode(65 + index)}.`
                            if (type === "romanLcPeriod") return `${toRoman(index + 1).toLowerCase()}.`
                            if (type === "romanUcPeriod") return `${toRoman(index + 1).toUpperCase()}.`
                            return "•"

                            function toRoman(num: number) {
                                const val = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
                                const syms = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"]
                                let roman = ""
                                for (let i = 0; i < val.length; i++) {
                                    while (num >= val[i]) {
                                        num -= val[i]
                                        roman += syms[i]
                                    }
                                }
                                return roman
                            }
                        }
                    }
                    text = text.filter((a) => typeof a.value === "string")

                    return {
                        align: getAlignment(algn),
                        text
                    }
                })
                .filter((a) => a.text?.length) as Line[]
        }

        const types = {
            "p:sp": "text",
            "p:pic": "media",
            "p:graphicFrame": "chart",
            "p:cxnSp": "text" // "shape"
        }

        const type2 = types[shape.name] || "icon"

        let style = ""

        const spPr = getValue(shape.shape, "p:spPr")
        const flipH = getAttribute(spPr, "flipH", "a:xfrm") === "1"
        const flipV = getAttribute(spPr, "flipV", "a:xfrm") === "1"
        const rot = getAttribute(spPr, "rot", "a:xfrm") || "0"
        const rotate = parseFloat(rot) / 60000 // convert 60,000ths of a degree to degrees

        let transform = ""
        if (flipH) transform += " scaleX(-1);"
        if (flipV) transform += " scaleY(-1);"
        if (rotate) transform += ` rotate(${rotate}deg);`
        if (transform) style += `transform: ${transform};`

        let item: Item = {
            type: type2,
            style
        }

        const itemAlign = getAttribute(shape.shape, "anchor", "p:txBody") || getAttribute(getValue(shape.layoutShape, "p:txBody"), "anchor", "a:bodyPr") || getAttribute(getValue(shape.masterShape, "p:txBody"), "anchor", "a:bodyPr") || "t"
        item.align = getItemAlign(itemAlign)
        function getItemAlign(anchor: string) {
            if (anchor === "ctr") return ""
            if (anchor === "b") return "align-items: flex-end;"
            return "align-items: flex-start;" // t
        }

        const getMediaPath = (rid?: string) => {
            if (!rid) return null
            // Look for relationship in slide, then layout, then master
            const tryFind = (part: any) => {
                if (!part) return null
                const rels = part.relationships || []
                const rel = rels.find((r: any) => r.id === rid || r.Id === rid)
                if (rel) return getTarget(part.path, rel) || rel.target
                return null
            }
            let target = tryFind(ctx.slide) || tryFind(ctx.layout) || tryFind(ctx.master)
            if (!target) target = rid
            // Map to contentPaths if available
            const fsPath = this.contentPaths && this.contentPaths[target]
            return fsPath || target
        }

        const pptShapeToNormalizedSvg = (node: any): string | null => {
            const spPr = getValue(node, "p:spPr")
            if (!spPr) return null

            const prstGeom = getAttribute(spPr, "prst", "a:prstGeom")
            // const prstGeom = spPr["a:prstGeom"]?.[0].$?.prst
            // if (!prstGeom || prstGeom === "rect") return null

            const pos = getPosition(node)
            // const xfrm = getValue(spPr, "a:xfrm")
            // const ox = getAttribute(xfrm, "x", "a:off")
            // const oy = getAttribute(xfrm, "y", "a:off")
            // const cx = getAttribute(xfrm, "cx", "a:ext")
            // const cy = getAttribute(xfrm, "cy", "a:ext")
            // if (ox == null || oy == null || cx == null || cy == null) return null

            // Fill color and opacity
            const fill = resolveColor(getValue(spPr, "a:solidFill"), ctx.colors) || "none"
            const schemeClr = getValue(spPr, "a:solidFill", "a:schemeClr")
            const alpha = getAttribute(schemeClr, "val", "a:alpha")
            const fillOpacity = alpha ? parseInt(alpha, 10) / 100000 : 1

            // ---- LINE SUPPORT ----
            let stroke = "none"
            let strokeWidth = 0
            let strokeDasharray = ""
            let strokeLinecap = ""
            let strokeLinejoin = ""
            let strokeMiterlimit = 0

            const lineFill = getValue(spPr, "a:ln", "a:solidFill")
            if (lineFill.length) {
                stroke = resolveColor(lineFill, ctx.colors) || "none"
                strokeWidth = round(emuToPixels(getAttribute(spPr, "w", "a:ln") || "0") * 0.05)
                // strokeWidth = getAttribute(spPr, "w", "a:ln") ? (parseInt(getAttribute(spPr, "w", "a:ln"), 10) / 12700) * 0.02 : 1 // EMUs → pt → px-ish
                const ln = getValue(spPr, "a:ln")
                // Dash style
                const dashVal = getAttribute(ln, "val", "a:prstDash")
                if (dashVal && dashVal !== "solid") {
                    if (dashVal === "dash") strokeDasharray = "4,2"
                    else if (dashVal === "dot") strokeDasharray = "1,2"
                    else if (dashVal === "dashDot") strokeDasharray = "4,2,1,2"
                    // ...
                }

                const cap = getAttribute(ln, "cap")
                // Line cap
                if (cap === "round" || ln["a:round"]) strokeLinecap = "round"
                else if (cap === "square") strokeLinecap = "square"

                const join = getAttribute(ln, "join")
                // Line join
                if (join === "round" || ln["a:round"]) strokeLinejoin = "round"
                else if (join === "bevel" || ln["a:bevel"]) strokeLinejoin = "bevel"
                else if (join === "miter" || ln["a:miter"]) {
                    strokeLinejoin = "miter"
                    const miterLim = getAttribute(ln, "miterLim")
                    strokeMiterlimit = miterLim ? parseFloat(miterLim) : 4
                }
            }
            // WIP stroke is overflowing outside of item

            let svgAttributes = `fill="${fill}"`
            if (fillOpacity < 1) svgAttributes += ` fill-opacity="${fillOpacity}"`
            if (stroke !== "none") svgAttributes += ` stroke="${stroke}"`
            if (strokeWidth) svgAttributes += ` stroke-width="${strokeWidth}"`
            if (strokeDasharray) svgAttributes += ` stroke-dasharray="${strokeDasharray}"`
            if (strokeLinecap) svgAttributes += ` stroke-linecap="${strokeLinecap}"`
            if (strokeLinejoin) svgAttributes += ` stroke-linejoin="${strokeLinejoin}"`
            if (strokeMiterlimit) svgAttributes += ` stroke-miterlimit="${strokeMiterlimit}"`

            // Compute aspect ratio
            const aspect = pos.width / pos.height
            let vbWidth = 1
            let vbHeight = 1

            if (aspect >= 1) {
                // wider
                vbWidth = 1
                vbHeight = 1 / aspect
            } else {
                // taller
                vbWidth = aspect
                vbHeight = 1
            }

            if (!prstGeom) {
                // custom shape
                const customPath = getValue(spPr, "a:custGeom", "a:pathLst", "a:path")
                if (customPath) {
                    // WIP
                    const customShape = getCustomShapePath(customPath)
                    if (customShape && customShape.pathData) {
                        return `<svg data-shape="custom" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${customShape.vbWidth} ${customShape.vbHeight}" style="position: absolute;">
                                <path ${svgAttributes} d="${customShape.pathData}"></path>
                            </svg>`
                    }
                }
                return null
            }

            // Define shapes
            if (prstGeom === "rect") {
                if (fill === "none") return null
                // Use vbWidth and vbHeight for non-square shapes
                return `<svg data-shape="rect" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbWidth} ${vbHeight}" preserveAspectRatio="none" style="position: absolute;">
                            <rect 
                                ${svgAttributes}
                                x="0" 
                                y="0" 
                                width="${vbWidth}" 
                                height="${vbHeight}" />
                        </svg>`
            }

            // Get adjustment value (default 50000 if missing)
            let adj = 50000
            const avLst = getValue(spPr, "a:prstGeom", "a:avLst")[0]
            if (avLst?.["a:gd"]) {
                const valStr = getAttribute(avLst, "fmla", "a:gd")
                if (valStr && valStr.startsWith("val")) {
                    adj = parseFloat(valStr.split(" ")[1])
                }
            }

            const path = getPresetShapePath(prstGeom, pos.left, pos.top, pos.width, pos.height, adj)

            // viewBox="0 0 1 1"
            return `<svg data-shape="${prstGeom}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbWidth} ${vbHeight}" style="position: absolute;">
                    <path ${svgAttributes} d="${path}"></path>
                </svg>`
        }

        const fill = getValue(shape.shape, "p:blipFill")

        // background
        const bgColor = resolveColor(getValue(spPr, "a:solidFill"), ctx.colors)
        let svgShape = false

        if (shape.name === "p:sp") {
            item.lines = getText(shape.shape)

            // padding
            // PowerPoint default text box internal padding (margins) is typically set to \(0.1\) inches (\(2.54\) mm) on the left/right and \(0.05\) inches (\(1.27\) mm) on the top/bottom.
            // let textboxStyle = "padding: 5px 10px;"
            // let textboxStyle = "padding: 14px 12px;"

            // merge all items text
            if (!item.lines.length || !getItemText(item).length) {
                const svg = pptShapeToNormalizedSvg(shape.shape)
                if (svg) {
                    delete item.lines
                    item.type = "icon"
                    item.customSvg = svg
                    // textboxStyle = ""
                    svgShape = true
                }
            }

            // don't add textboxes if decoration
            if (shape.isDecoration && !svgShape) return null

            // item.style += textboxStyle
        } else if (item.type === "media") {
            // findAttribute(node, "r:embed") || findAttribute(node, "r:link")
            const rid = getAttribute(fill, "r:embed", "a:blip")
            item.src = getMediaPath(rid)

            // const mediaFit = getAttribute(fill, "method", "p:blipFill")
            item.fit = "fill"

            // is video elem
            const nvPr = getValue(shape.shape, "p:nvPicPr", "p:nvPr")
            const videoId = getAttribute(nvPr, "r:link", "a:videoFile")
            const videoPath = getMediaPath(videoId)
            if (videoPath) {
                item.src = videoPath
                item.loop = false
            }

            // is online media element
            // const title = getAttribute(getValue(shape.shape, "p:nvPicPr")[0], "title")
            const cNvPr = getValue(shape.shape, "p:nvPicPr", "p:cNvPr")
            const hlinkClickId = getAttribute(cNvPr[0], "r:id", "hlinkClick")
            const links = ctx.slide.getRelationships("http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink")
            const url = links.find((l) => l.id === hlinkClickId)?.target
            if (url) {
                item.type = "web"
                item.web = { src: url, noNavigation: true }
                // clickReveal: true
            }

            // const effects = getValues(fill, "a:blip", "a:extLst", "a:ext", "a14:imgProps", "a14:imgLayer", "a14:imgEffect")
            // effects.forEach((effect) => {
            //     const name = Object.keys(effect[0])
            //         .find((a) => a.startsWith("a14:"))
            //         ?.slice(4)
            //     let value = ""
            //     if (name === "colorTemperature") value = getAttribute(effect[0], "colorTemp")
            //     else if (name === "brightnessContrast") value = getAttribute(effect[0], "bright")
            //     else value = getAttribute(effect[0], "amount")
            //     console.log("Image effect:", name, value)
            // })
        } else if (shape.name === "p:cxnSp") {
            // line style
        } else if (type2 === "chart") {
            // table / chart
            return null
        }

        if (shape.isDecoration) item.decoration = true

        const fallbackPadding = shape.name === "p:sp" && !svgShape ? 14 : 0
        const paddingL = getAttribute(shape.shape, "lIns", "p:txBody") || getAttribute(getValue(shape.layoutShape, "p:txBody"), "lIns", "a:bodyPr") || getAttribute(getValue(shape.masterShape, "p:txBody"), "lIns", "a:bodyPr") || "0"
        const paddingT = getAttribute(shape.shape, "tIns", "p:txBody") || getAttribute(getValue(shape.layoutShape, "p:txBody"), "tIns", "a:bodyPr") || getAttribute(getValue(shape.masterShape, "p:txBody"), "tIns", "a:bodyPr") || "0"
        const paddingR = getAttribute(shape.shape, "rIns", "p:txBody") || getAttribute(getValue(shape.layoutShape, "p:txBody"), "rIns", "a:bodyPr") || getAttribute(getValue(shape.masterShape, "p:txBody"), "rIns", "a:bodyPr") || "0"
        const paddingB = getAttribute(shape.shape, "bIns", "p:txBody") || getAttribute(getValue(shape.layoutShape, "p:txBody"), "bIns", "a:bodyPr") || getAttribute(getValue(shape.masterShape, "p:txBody"), "bIns", "a:bodyPr") || "0"
        item.style += `padding: ${round(emuToPixels(paddingT) || fallbackPadding)}px ${round(emuToPixels(paddingR) || fallbackPadding)}px ${round(emuToPixels(paddingB) || fallbackPadding)}px ${round(emuToPixels(paddingL) || fallbackPadding)}px;`

        if (bgColor && !svgShape) item.style += `background-color: ${bgColor};`

        // border
        const lineFill = getValue(spPr, "a:ln", "a:solidFill")
        if (!svgShape && lineFill.length) {
            let stroke = "none"
            let strokeWidth = 0
            // let strokeDasharray = ""
            // let strokeLinecap = ""

            stroke = resolveColor(lineFill, ctx.colors) || "none" // || "#000"
            const width = getAttribute(spPr, "w", "a:ln")
            // strokeWidth = width ? (parseInt(width, 10) / 12700) * 0.02 : 1 // EMUs → pt → px-ish
            strokeWidth = emuToPixels(width || "0")

            const ln = getValue(spPr, "a:ln")

            // Dash style
            // const dashVal = ln["a:prstDash"]?.[0]?.$?.val
            const dashVal = getAttribute(ln, "val", "a:prstDash")
            let dashStyle = ""
            if (dashVal && dashVal !== "solid") {
                if (dashVal === "dash") dashStyle = "dashed"
                else if (dashVal === "dot") dashStyle = "dotted"
                else dashStyle = "dashed" // no direct CSS equivalent, using dashed as fallback

                // if (dashVal === "dash") strokeDasharray = "4,2"
                // else if (dashVal === "dot") strokeDasharray = "1,2"
                // else if (dashVal === "dashDot") strokeDasharray = "4,2,1,2"
                // add more mappings if needed
            }

            // Line cap
            // if (ln.$?.cap === "round" || ln['a:round']) strokeLinecap = "round"
            // else if (ln.$?.cap === "square") strokeLinecap = "square"

            if (strokeWidth) {
                item.style += `border-width: ${strokeWidth + 0.8}px;`
                if (stroke !== "none") item.style += `border-color: ${stroke};`
                if (dashStyle) item.style += `border-style: ${dashStyle};`
            }
        }

        // position

        let pos = getPosition(shape.shape, ctx.scale)
        if (pos.width + pos.height + pos.left + pos.top === 0) pos = getPosition(shape.layoutShape, ctx.scale)
        if (pos.width + pos.height + pos.left + pos.top === 0) pos = getPosition(shape.masterShape, ctx.scale)
        if (pos.width === 0 && pos.height === 0) pos = { left: 80, top: 200, width: 1760, height: 680 } // set default pos
        item.style += Object.entries(pos)
            .map(([k, v]) => (v != null ? `${k}: ${v}px;` : ""))
            .join("")

        // cropping

        const l = getAttribute(fill, "l", "a:srcRect")
        const t = getAttribute(fill, "t", "a:srcRect")
        const r = getAttribute(fill, "r", "a:srcRect")
        const b = getAttribute(fill, "b", "a:srcRect")

        if (l != null || t != null || r != null || b != null) {
            item.cropping = {
                left: toFract(l), // , emuToPixels(pos.width || 0)),
                top: toFract(t), // , emuToPixels(pos.height || 0)),
                right: toFract(r), // , emuToPixels(pos.width || 0)),
                bottom: toFract(b) // , emuToPixels(pos.height || 0))
            }
            if (item.cropping.left + item.cropping.right + item.cropping.top + item.cropping.bottom === 0) delete item.cropping
        }

        function toFract(v: string): number {
            if (!v) return 0
            const n = Number(v)
            if (isNaN(n)) return 0
            // a:srcRect values are relative coordinates where 100000 == 100%
            // convert to fraction (0..1). Caller can multiply by image dimension when available.
            let rounded = round(n / 1000)
            if (rounded < 0.05) rounded = 0
            return rounded
        }

        return item
    }
}

/////////
function getPosition(psp: any, scale: { x: number; y: number; factor: number } | null = null) {
    // common path: p:spPr -> a:xfrm -> a:off/@x,y and a:ext/@cx,cy
    const spPr = getValue(psp, "p:spPr")
    const xfrm = getValue(spPr, "a:xfrm")

    const ox = getAttribute(xfrm, "x", "a:off") || "0"
    const oy = getAttribute(xfrm, "y", "a:off") || "0"
    const cx = getAttribute(xfrm, "cx", "a:ext") || "0"
    const cy = getAttribute(xfrm, "cy", "a:ext") || "0"

    return {
        left: round(emuToPixels(ox) * (scale?.x ?? 1)),
        top: round(emuToPixels(oy) * (scale?.y ?? 1)),
        width: round(emuToPixels(cx) * (scale?.x ?? 1)),
        height: round(emuToPixels(cy) * (scale?.y ?? 1))
    }
}

function resolveOpcPath(fromPath: string, target: string) {
    // If target is absolute-ish, trim any leading slash
    let t = target.replace(/^\/+/, "")
    if (/^[a-zA-Z]:\\/.test(t) || t.startsWith("ppt/")) {
        return t
    }

    const base = fromPath.substring(0, fromPath.lastIndexOf("/") + 1)
    const combined = (base + t).split("/")
    const parts: string[] = []
    for (const p of combined) {
        if (p === "" || p === ".") continue
        if (p === "..") parts.pop()
        else parts.push(p)
    }
    return parts.join("/")
}

function getRid(idNode: any | undefined): string {
    return getAttribute(idNode, "r:id") || getAttribute(idNode, "id")
}

// Helper: normalize a relationship target to a package path (e.g. "ppt/slides/slide1.xml")
// If `fromPath` is provided, resolve relative paths against it using `resolveOpcPath`.
// External targets (rel.targetMode === "External") return null.
function getTarget(fromPath: string | undefined, rel?: Relationship): string | null {
    if (!rel) return null
    // if (rel.targetMode && String(rel.targetMode).toLowerCase() === "external") return null
    const t = rel.target
    if (!t) return null

    // Prefer package-aware resolution when we have a source path
    if (fromPath) {
        try {
            return resolveOpcPath(fromPath, String(t))
        } catch (e) {
            // fallthrough to best-effort normalization
        }
    }

    let s = String(t).replace(/^\/+/, "").replace(/^\.\//, "")
    s = s.replace(/^(?:\.\.\/)+/, "")
    if (!s.startsWith("ppt/")) s = "ppt/" + s
    return s
}

// Try to find a shape id within a node by searching for common id attributes.
function findShapeId(node: any, depth = 0): string | null {
    if (!node || typeof node !== "object" || depth > 8) return null

    const getId = (node: any) => getRid(node) || getAttribute(node, "name")

    // Direct attributes
    const id = getId(node)
    if (id) return id

    // Common OpenXML location for shape id/name: p:nvSpPr -> p:cNvPr -> $ -> id/name
    const nvSpPr = getValue(node, "p:nvSpPr")
    if (nvSpPr) {
        const c = getValue(nvSpPr, "p:cNvPr")
        const id = getId(c)
        if (id) return id
    }

    // For pictures: p:pic -> p:nvPicPr -> p:cNvPr
    const pic = getValue(node, "p:pic")
    if (pic) {
        const c = getValue(pic, "p:nvPicPr", "p:cNvPr")
        const id = getId(c)
        if (id) return id
    }

    // descend limited depth
    for (const k of Object.keys(node)) {
        const v = node[k]
        if (v && typeof v === "object") {
            const found = findShapeId(v, depth + 1)
            if (found) return found
        }
    }

    return null
}

// Convert EMU (English Metric Units) to pixels. Default DPI is 96 (typical screen).
function emuToPixels(emu: number | string, dpi = 96): number {
    if (typeof emu === "string") emu = Number(emu)
    if (!emu) return 0
    // 1 inch = 914400 EMU; pixels = inches * dpi
    return (emu / 914400) * dpi
}

function round(num: number, decimalPlaces: number = 2) {
    const p = Math.pow(10, decimalPlaces)
    const n = num * p * (1 + Number.EPSILON)
    return Math.round(n) / p
}

// local helpers used inside above methods (not exported)
// function findFirstLocal(n: any, key: string, depth = 0): any {
//     if (!n || depth > 8) return undefined
//     if (n[key]) return n[key]
//     for (const v of Object.values(n)) {
//         if (v && typeof v === "object") {
//             const f = findFirstLocal(v, key, depth + 1)
//             if (f) return f
//         }
//     }
//     return undefined
// }

function getShape(node: Shape) {
    const name = Object.keys(node)[0]
    return { name, node: node[name] as Shape }
}

type Shape = any[]
type TempShape = {
    id: string
    name: string
    //   tree: 'master' | 'layout' | 'slide'
    node: Shape

    isPlaceholder: boolean
    phType?: string
    phIdx?: string // probably rarely used

    hidden?: boolean

    pos: { left: number; top: number; width: number; height: number }
}
function getTempShape(node: Shape): TempShape {
    const shape = getShape(node)
    const placeholder = getValue(shape.node, "p:nvSpPr", "p:nvPr")[0]
    const isPlaceholder = placeholder?.["p:ph"] ? true : false
    const phType = getAttribute(placeholder, "type", "p:ph")
    const phIdx = getAttribute(placeholder, "idx", "p:ph")

    return {
        id: findShapeId(shape) || "",
        name: shape.name,
        node: shape.node,
        isPlaceholder,
        phType,
        phIdx,
        hidden: getAttribute(getValue(shape.node, "p:spPr"), "hidden") === "1", // ?
        pos: getPosition(shape.node)
    }
}
type PhKey = string // "type|idx"

function computeReplacedPlaceholders(slideShapes: TempShape[], layoutShapes: TempShape[]): Map<string, PhKey> {
    const result = new Map<string, PhKey>()

    const layoutPH = layoutShapes.filter((s) => s.isPlaceholder)

    for (const slide of slideShapes) {
        if (slide.isPlaceholder) continue

        for (const lp of layoutPH) {
            if (
                slide.name === lp.name &&
                // slide.id === lp.id &&
                sameGeom(slide, lp)
            ) {
                result.set(slide.id, keyOf(lp))
            }
        }
    }

    return result
}

function sameGeom(a: TempShape, b: TempShape) {
    return a.pos.left === b.pos.left && a.pos.top === b.pos.top && a.pos.width === b.pos.width && a.pos.height === b.pos.height
}

const validShapes = ["p:sp", "p:pic", "p:cxnSp", "p:graphicFrame"]
function unpackGroups(shapes: Shape[]) {
    const out: Shape[] = []

    for (const node of shapes) {
        const shape = getShape(node)
        if (shape.name === "p:grpSp") {
            const unpacked = unpackGroups(shape.node)
            out.push(...unpacked)
        } else if (validShapes.includes(shape.name)) {
            out.push(node)
        }
    }

    return out
}

const keyOf = (s: TempShape) => `${s.phType}|${s.phIdx}`
function buildRenderList(masterShapes: Shape[], layoutShapes: Shape[], slideShapes: Shape[], master: SlideMasterPart | null, layoutShowMasterSp: boolean = false) {
    const tempSlideShapes: TempShape[] = unpackGroups(slideShapes).map(getTempShape)
    const tempLayoutShapes: TempShape[] = unpackGroups(layoutShapes).map(getTempShape)
    const tempMasterShapes: TempShape[] = unpackGroups(masterShapes).map(getTempShape)

    const replaced = computeReplacedPlaceholders(tempSlideShapes, tempLayoutShapes)

    const slidePH = new Set<string>()
    for (const s of tempSlideShapes) {
        // if (!s.hidden) {
        //     if (s.isPlaceholder) slidePH.add(keyOf(s))
        //     if (!s.isPlaceholder && s.replacesPhKey) {
        //         slidePH.add(s.replacesPhKey)
        //     }
        // }

        if (s.isPlaceholder && !s.hidden) {
            slidePH.add(keyOf(s))
        }

        const repl = replaced.get(s.id)
        if (repl) {
            slidePH.add(repl)
        }
    }

    const layoutPH = new Set<string>()
    for (const s of tempLayoutShapes) {
        if (s.isPlaceholder && !s.hidden && !slidePH.has(keyOf(s))) {
            layoutPH.add(keyOf(s))
        }
    }

    const render: { name: string; shape: Shape; layoutShape: Shape; masterShape: Shape; txStyles: any[]; isDecoration?: boolean }[] = []

    for (const s of tempSlideShapes) {
        if (!s.hidden) render.push({ name: s.name, shape: s.node, layoutShape: getMatchingShape(keyOf(s), tempLayoutShapes), masterShape: getMatchingShape(keyOf(s), tempMasterShapes), txStyles: getTxStyles(s.phType) })
    }

    for (const s of tempLayoutShapes) {
        if (s.hidden) continue
        if (!s.isPlaceholder || !slidePH.has(keyOf(s))) {
            render.push({ name: s.name, shape: s.node, layoutShape: [], masterShape: getMatchingShape(keyOf(s), tempMasterShapes), txStyles: [], isDecoration: true })
        }
    }

    if (layoutShowMasterSp) {
        for (const s of tempMasterShapes) {
            if (s.hidden) continue
            const k = keyOf(s)
            if (!s.isPlaceholder || (!slidePH.has(k) && !layoutPH.has(k))) {
                render.push({ name: s.name, shape: s.node, layoutShape: [], masterShape: [], txStyles: [] })
            }
        }
    }

    // decoration first
    return render.sort((a, b) => {
        if (a.isDecoration && !b.isDecoration) return -1
        if (!a.isDecoration && b.isDecoration) return 1
        return 0
    })

    function getTxStyles(type: string | undefined) {
        const txStyles = master?.textStyles || []
        if (type?.toLowerCase().includes("title")) return getValue(txStyles, "p:titleStyle")
        if (type?.toLowerCase().includes("body")) return getValue(txStyles, "p:bodyStyle")
        return getValue(txStyles, "p:otherStyle")
    }
}

function getMatchingShape(id: string, tempShapes: TempShape[]) {
    for (const s of tempShapes) {
        if (keyOf(s) === id) return s.node
    }
    return []
}

function resolveColor(solidFill: any[], colors: { [key: string]: any }[]) {
    if (!solidFill?.length) return null

    const srgb = getAttribute(solidFill, "val", "a:srgbClr") || getAttribute(solidFill, "lastClr", "a:sysClr")
    if (srgb) {
        // if (!srgb.startsWith("#")) return "#" + srgb
        return "#" + srgb
    }

    const prst = getAttribute(solidFill, "val", "a:prstClr")
    if (prst) {
        return prst
    }

    let scheme = getAttribute(solidFill, "val", "a:schemeClr")
    if (!scheme.startsWith("a:")) scheme = "a:" + scheme
    if (scheme) {
        const themeClr = getValue(colors, scheme)
        return resolveColor(themeClr, colors)

        // const alpha = getAttribute(scheme, "val", "a:alpha")
        // const opacity = alpha ? parseInt(alpha, 10) / 100000 : 1
        // if (alpha) {
        //     const rgb = hexToRgb(hex)
        //     return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
        // }
    }

    return ""
}

///// XML

function getValue(data: any[], ...path: string[]): any[] {
    if (!Array.isArray(data)) return []

    let current = data
    for (const key of path) {
        current = current.find((n: any) => n.hasOwnProperty(key))?.[key]
        if (!Array.isArray(current)) return []
    }

    return current
}

function getValues(data: any[], ...path: string[]): any[][] {
    if (!Array.isArray(data)) return []

    let lastPath = path.pop()!

    let current = data
    for (const key of path) {
        current = current.find((n: any) => n.hasOwnProperty(key))?.[key]
        if (!Array.isArray(current)) return []
    }

    current = current.filter((n: any) => n.hasOwnProperty(lastPath)).map((n: any) => n[lastPath])

    return current
}

function getFirstAvailable(datas: any[][], ...keys: string[]): any[] {
    for (const data of datas) {
        const d = getValue(data, ...keys)
        if (d.length) return d
    }
    return []
}

function getAttribute(data: any[], key: string, tagName: string = ""): string {
    if (!Array.isArray(data)) return fixValue(data?.[":@"]?.[key] || "")

    let index = data.findIndex((n: any) => (tagName ? n.hasOwnProperty(tagName) : n[":@"]?.[key]))
    if (index === -1) return ""

    return fixValue(data?.[index]?.[":@"]?.[key] || "")

    function fixValue(v: string) {
        if (v === "true") return "1"
        if (v === "false") return "0"
        return v
    }
}

function getAttributes(data: any[], tagName: string): { [key: string]: any } {
    if (!Array.isArray(data)) return []
    return data.find((a) => a.hasOwnProperty(tagName))?.[":@"] || {}
}
