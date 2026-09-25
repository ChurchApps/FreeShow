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

import { uid } from "uid"
import type { Item, Line } from "../../../types/Show"
import { getItemText } from "../../components/edit/scripts/textStyle"
import { clone } from "../../components/helpers/array"
import { hexToHSL, hexToRgb, hslToHex } from "../../components/helpers/color"
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
        console.log("Presentation:", presentation)

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

    private getColorScheme(theme: ThemePart | null, master: SlideMasterPart | null, layout: SlideLayoutPart | null, slide: SlidePart | null): { [key: string]: any }[] {
        if (!theme) return []

        const colors = clone(theme.colorScheme || [])

        const masterColorMap = getAttributes(getValue(master?.json, "p:sldMaster"), "p:clrMap")
        const layoutColorMap = getAttributes(getValue(layout?.json, "p:sldLayout"), "p:clrMap")
        const slideColorMap = getAttributes(getValue(slide?.json, "p:sld"), "p:clrMap")
        const colorKeys = [...Object.keys(masterColorMap), ...Object.keys(layoutColorMap), ...Object.keys(slideColorMap)]

        colorKeys.forEach((a) => {
            let keyVal = slideColorMap[a] || layoutColorMap[a] || masterColorMap[a]
            if (!keyVal.startsWith("a:")) keyVal = `a:${keyVal}`

            const color = colors.find((a) => a[keyVal])
            if (color) colors.push({ ["a:" + a]: color[keyVal] })
        })

        const masterOverride = getAttributes(getValue(master?.json, "p:sldMaster", "p:clrMapOvr"), "a:overrideClrMapping")
        const layoutOverride = getAttributes(getValue(layout?.json, "p:sldLayout", "p:clrMapOvr"), "a:overrideClrMapping")
        const slideOverride = getAttributes(getValue(slide?.json, "p:sld", "p:clrMapOvr"), "a:overrideClrMapping")
        const overrideKeys = { ...masterOverride, ...layoutOverride, ...slideOverride }

        Object.entries(overrideKeys).forEach(([key, value]) => {
            if (!key.startsWith("a:")) key = `a:${key}`
            if (!value.startsWith("a:")) value = `a:${value}`

            const index = colors.findIndex((c) => c[key])
            if (index !== -1) colors.splice(index, 1)

            colors.push({ [key]: getValue(colors, value) })
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

    private extraItems: { index: number; item: Item | null }[] = []
    getSlide(presentation: PresentationPart, target: string) {
        const slide = this.resolveSlide(presentation, target)
        if (!slide) return null

        let layout = slide?.layout || null
        let master = layout?.master || null
        let theme = master?.theme || null

        const colors = this.getColorScheme(theme, master, layout, slide)

        // Expose raw trees and a merged slideTree (master -> layout -> slide)
        const masterShapes = master?.shapes || []
        const layoutShapes = layout?.shapes || []
        const slideShapes = slide?.shapes || []
        const slideShowMaster = getAttribute(getValue(slide?.json, "p:sld"), "showMasterSp") !== "0"
        const layoutShowMaster = getAttribute(getValue(layout?.json, "p:sldLayout"), "showMasterSp") !== "0"
        const layoutShowMasterSp = slideShowMaster && layoutShowMaster
        const slideTree = buildRenderList(masterShapes, layoutShapes, slideShapes, master, slide, layout, layoutShowMasterSp)

        const scale = this.getScale(presentation?.slideSize)

        let items = slideTree.map((n, i) => this.shapeToItem(n, { presentation, slide, layout, master, theme, colors, scale }, i)).filter(Boolean) as Item[]

        // add SVG textboxes
        this.extraItems
            .sort((a, b) => b.index - a.index)
            .forEach(({ index, item }) => {
                if (item) items.splice(index + 1, 0, item)
            })
        this.extraItems = []

        // slide background color
        // let fill = getValue(slide?.json, "p:sld", "p:cSld", "p:bg", "p:bgPr", "a:solidFill")
        // if (!fill.length) fill = getValue(layout?.json, "p:sldLayout", "p:cSld", "p:bg", "p:bgPr", "a:solidFill")
        // if (!fill.length) fill = getValue(master?.json, "p:sldMaster", "p:cSld", "p:bg", "p:bgPr", "a:solidFill")
        const sldSlide = getValue(slide?.json, "p:sld")
        const sldLayout = getValue(layout?.json, "p:sldLayout")
        const sldMaster = getValue(master?.json, "p:sldMaster")
        let fill = getFirstAvailable([sldSlide, sldLayout, sldMaster], ["p:cSld", "p:bg", "p:bgPr", "a:solidFill"], ["p:cSld", "p:bg", "p:bgRef"])
        let bgColor = resolveColor(fill, colors)

        // slide gradient
        const gradFill = getFirstAvailable([sldSlide, sldLayout, sldMaster], ["p:cSld", "p:bg", "p:bgPr", "a:gradFill"])
        bgColor = resolveGradient(gradFill, colors) || bgColor

        // slide background image
        let bgPart: SlidePart | SlideLayoutPart | SlideMasterPart | null = null
        let bgFill: any[] = []

        for (const part of [slide, layout, master]) {
            if (!part) continue
            const sld = getValue(part.json, part === slide ? "p:sld" : part === layout ? "p:sldLayout" : "p:sldMaster")
            const blip = getValue(sld, "p:cSld", "p:bg", "p:bgPr", "a:blipFill")
            if (blip.length) {
                bgFill = blip
                bgPart = part
                break
            }
        }

        const bgImgId = getAttribute(bgFill, "r:embed", "a:blip") || getAttribute(bgFill, "r:link", "a:blip")
        const bgImage = this.getMediaPath(bgImgId, bgPart || { slide, layout, master })
        if (bgImage) {
            let imageItem: Item = { type: "media", style: "width:1920px;height:1080px;top:0;left:0;", src: bgImage, fit: "fill" }

            const filter = resolveImageEffects(bgFill, colors)
            if (filter) imageItem.filter = filter

            const alpha = getAttribute(getValue(bgFill, "a:blip"), "amt", "a:alphaModFix")
            let a = parseInt(alpha || "100000") / 100000
            if (a < 1) imageItem.style += `opacity: ${a};`

            const srcL = getAttribute(bgFill, "l", "a:srcRect")
            const srcT = getAttribute(bgFill, "t", "a:srcRect")
            const srcR = getAttribute(bgFill, "r", "a:srcRect")
            const srcB = getAttribute(bgFill, "b", "a:srcRect")

            if (srcL !== "" || srcT !== "" || srcR !== "" || srcB !== "") {
                imageItem.cropping = {
                    left: toFract(srcL),
                    top: toFract(srcT),
                    right: toFract(srcR),
                    bottom: toFract(srcB),
                    type: "ppt"
                }
                if (imageItem.cropping.left + imageItem.cropping.right + imageItem.cropping.top + imageItem.cropping.bottom === 0) delete imageItem.cropping
            }

            function toFract(v: string): number {
                if (!v) return 0
                const n = Number(v)
                if (isNaN(n)) return 0
                let rounded = round(n / 1000)
                if (rounded < 0.05 && rounded > -0.05) rounded = 0
                return rounded
            }

            items = [imageItem, ...items]
        }

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
        shape: { name: string; shape: Shape; pos: Position; layoutShape: Shape; masterShape: Shape; txStyles: any[]; isDecoration?: boolean; part?: OpcPart },
        ctx: {
            presentation: PresentationPart
            slide: SlidePart
            layout: SlideLayoutPart | null
            master: SlideMasterPart | null
            theme: ThemePart | null
            colors: { [key: string]: any }[]
            scale: { x: number; y: number; factor: number }
        },
        index: number,
        svgText: boolean = false
    ): Item | null {
        if (!Array.isArray(shape.shape)) return null

        // convert size from 100ths of points to pixels
        function ptsToPx(size: number | string) {
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
            if (t !== "") return t
            return ""
        }

        function getTypeface(typeface: string) {
            if (!typeface) return ""

            if (typeface.startsWith("+")) {
                // const isMajor = typeface.startsWith("+mj")
                const isMinor = typeface.startsWith("+mn")
                const themeFont = getValue(ctx.theme?.fontScheme || [], isMinor ? "a:minorFont" : "a:majorFont")

                let key = typeface.slice(typeface.indexOf("-") + 1)
                if (key === "lt") key = "latin"

                const value = getAttribute(themeFont, "typeface", "a:" + key)
                return value
            }

            // See fonts.ts:252
            // trim subfamily names (e.g. "Bold", "Italic") since these are usually represented as separate attributes in PowerPoint and not part of the font name
            const subfamilyIndicators = ["bold", "italic", "oblique", "regular", "light", "thin", "black", "heavy", "narrow", "condensed", "extended", "semi", "demi", "ultra", "medium", "normal"]
            const regex = new RegExp(`\\b(${subfamilyIndicators.join("|")})\\b`, "gi")
            typeface = typeface.replace(regex, "").replace(/\s+/g, " ").trim()

            return typeface
        }

        function getShadowStyle(rPr: any, pPrL: any, pPrM: any, tx: any) {
            let shadowVal = "text-shadow: 0 0 0 rgb(0 0 0 / 0);"

            let effects = getValue(rPr, "a:effectLst")
            if (!effects.length) effects = getValue(pPrL, "a:defRPr", "a:effectLst")
            if (!effects.length) effects = getValue(pPrM, "a:defRPr", "a:effectLst")
            if (!effects.length) effects = getValue(tx, "a:defRPr", "a:effectLst")
            const glow = getValue(effects, "a:glow")
            const outerShadow = getValue(effects, "a:outerShdw")
            if (outerShadow.length) {
                const color = resolveColor(outerShadow, ctx.colors)
                const rgb = hexToRgb(color || "#000000")
                const shadowColor = color?.startsWith("rgba") ? color : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`
                const blur = round((emuToPixels(getAttribute(outerShadow, "blurRad")) || 0) * 1.5 * ctx.scale.factor)
                const dist = (emuToPixels(getAttribute(outerShadow, "dist")) || 0) * ctx.scale.factor
                const angle = ((Number(getAttribute(outerShadow, "dir") || "0") / 60000) * Math.PI) / 180
                const x = round(Math.cos(angle) * dist)
                const y = round(Math.sin(angle) * dist)
                shadowVal = `text-shadow: ${x}px ${y}px ${blur}px ${shadowColor};`
            } else if (glow.length) {
                const glowColor = resolveColor(glow, ctx.colors) || "rgb(255 255 255)"
                const glowSize = round((emuToPixels(getAttribute(glow, "rad")) || 0) * ctx.scale.factor)
                shadowVal = `text-shadow: 0 0 ${glowSize}px ${glowColor};`
            }

            return shadowVal
        }

        function getRStyle(r: any[], pPr: any, pPrL: any, pPrM: any, tx: any, parentRuns: any[] = []) {
            let rPr = getValue(r, "a:rPr")
            if (!rPr.length) rPr = getValue(r, "a:endParaRPr")

            // a:hlinkClick

            // getPrioritizedStyle(rPr, pPrL, pPrM, tx, "a:rFonts", "a:ascii") ||
            const typeface = getTypeface(getPrioritizedStyle(rPr, pPrL, pPrM, tx, "typeface", "a:latin")) || getTypeface(getAttribute(pPr, "typeface", "a:latin"))
            const fontSizePx = ptsToPx(getPrioritizedStyle(r, pPrL, pPrM, tx, "sz")) || ptsToPx(getAttribute(pPr, "sz", "a:defRPr")) || 24
            const letterSpacing = ptsToPx(getPrioritizedStyle(r, pPrL, pPrM, tx, "spc")) || ptsToPx(getAttribute(pPr, "spc", "a:defRPr"))

            const cap = getPrioritizedStyle(r, pPrL, pPrM, tx, "cap") || getAttribute(pPr, "cap", "a:defRPr") || "none"

            const isBold = (getPrioritizedStyle(r, pPrL, pPrM, tx, "b") || getAttribute(pPr, "b", "a:defRPr")) === "1"
            const isItalic = (getPrioritizedStyle(r, pPrL, pPrM, tx, "i") || getAttribute(pPr, "i", "a:defRPr")) === "1"
            const underline = getPrioritizedStyle(r, pPrL, pPrM, tx, "u") || getAttribute(pPr, "u", "a:defRPr")
            const isStrikethrough = (getPrioritizedStyle(r, pPrL, pPrM, tx, "strike") || getAttribute(pPr, "strike", "a:defRPr")) === "1"

            const colorFills = [getValue(rPr, "a:solidFill"), getValue(pPr, "a:defRPr", "a:solidFill"), ...parentRuns, getValue(pPrL, "a:defRPr", "a:solidFill"), getValue(pPrM, "a:defRPr", "a:solidFill"), getValue(tx, "a:defRPr", "a:solidFill"), getValue(tx, "a:solidFill"), getValue(ctx.colors, "a:tx1")]
            const color = colorFills.map((f) => resolveColor(f, ctx.colors)).find(Boolean) || ""

            // outline
            const lnWidth = getAttribute(rPr, "w", "a:ln") || getAttribute(getValue(pPr, "a:defRPr"), "w", "a:ln")
            const lnClr = resolveColor(getValue(rPr, "a:ln", "a:solidFill"), ctx.colors) || resolveColor(getValue(pPr, "a:defRPr", "a:ln", "a:solidFill"), ctx.colors)
            const lnWPx = lnWidth != null ? round(emuToPixels(lnWidth)) : null
            let lnColor = ""
            if (lnWPx != null && lnClr) lnColor = lnClr

            let shadowVal = getShadowStyle(rPr, pPrL, pPrM, tx)

            // raised text
            const baseline = getAttribute(r, "baseline") || "0"
            // const subscript = getAttribute(rPr, "val", "a:sub") === "1"
            // const superscript = getAttribute(rPr, "val", "a:sup") === "1"
            let blEm = Number(baseline) / 100000

            let style = ""
            style += `font-family: ${typeface ? typeface + ", " : ""}Calibri;`
            style += `font-size: ${fontSizePx * (blEm ? 0.6 : 1)}px;`
            if (letterSpacing) style += `letter-spacing: ${letterSpacing}px;`
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
            if (cap === "all") style += "text-transform: uppercase;"
            if (cap === "small") style += "text-transform: lowercase;"

            return style
        }

        function getSharedStyle(pPr: any, pPrL: any, pPrM: any) {
            // line
            // default line spacing is typically set to 1.0, this usually corresponds to roughly 1.2 times the font size
            let lnSpc = getValue(pPr, "a:lnSpc")
            if (!lnSpc.length) lnSpc = getValue(pPrL, "a:lnSpc")
            if (!lnSpc.length) lnSpc = getValue(pPrM, "a:lnSpc")

            let style = ""

            if (getAttribute(lnSpc, "val", "a:spcPct")) {
                const spacing = getAttribute(lnSpc, "val", "a:spcPct") || "100000"
                // 100000 = 100% = apprx 1.2em
                // spacing to em
                const lnEm = (Number(spacing) / 100000) * 1.2
                if (lnEm > 0) style += `line-height: ${lnEm}em;`
            } else {
                const lnPx = ptsToPx(getAttribute(lnSpc, "val", "a:spcPts"))
                if (lnPx > 0) style += `line-height: ${lnPx}px;`
            }

            // paragraph space before / after
            function getSpace(tag: "a:spcBef" | "a:spcAft") {
                const spc = getValue(pPr, tag).length ? getValue(pPr, tag) : getValue(pPrL, tag).length ? getValue(pPrL, tag) : getValue(pPrM, tag)
                if (getAttribute(spc, "val", "a:spcPct")) {
                    const pct = (Number(getAttribute(spc, "val", "a:spcPct") || "0") / 100000) * 1.2
                    return pct > 0 ? `${round(pct, 2)}em` : ""
                }
                const pts = ptsToPx(getAttribute(spc, "val", "a:spcPts"))
                return pts > 0 ? `${pts}px` : ""
            }
            const spcBef = getSpace("a:spcBef")
            const spcAft = getSpace("a:spcAft")
            if (spcBef) style += `margin-top: ${spcBef};`
            if (spcAft) style += `margin-bottom: ${spcAft};`

            return style
        }

        function getBullet(pPr: any, pPrL: any, pPrM: any, tx: any, firstRun: any[]) {
            const buChar = getPrioritizedAttribute("char", "a:buChar")
            const autoNum = getPrioritizedAttribute("type", "a:buAutoNum")
            if (!buChar && !autoNum) return null

            function getPrioritizedAttribute(key: string, tagName: string = "") {
                return getAttribute(pPr, key, tagName) || getAttribute(pPrL, key, tagName) || getAttribute(pPrM, key, tagName)
            }

            const firstRunRPr = getValue(firstRun, "a:rPr").length ? getValue(firstRun, "a:rPr") : firstRun
            const customBuFont = getPrioritizedAttribute("typeface", "a:buFont")
            const defaultTypeface = getTypeface(getPrioritizedStyle(firstRunRPr, pPrL, pPrM, tx, "typeface", "a:latin"))
            const buFont = customBuFont ? getTypeface(customBuFont) : defaultTypeface

            const customBuClr = resolveColor(getValue(pPr, "a:buClr"), ctx.colors) || resolveColor(getValue(pPrL, "a:buClr"), ctx.colors) || resolveColor(getValue(pPrM, "a:buClr"), ctx.colors)
            const defaultClr = resolveColor(getValue(firstRunRPr, "a:solidFill"), ctx.colors) || resolveColor(getValue(pPr, "a:defRPr", "a:solidFill"), ctx.colors) || resolveColor(getValue(pPrL, "a:defRPr", "a:solidFill"), ctx.colors) || resolveColor(getValue(pPrM, "a:defRPr", "a:solidFill"), ctx.colors) || resolveColor(getValue(tx, "a:defRPr", "a:solidFill"), ctx.colors) || resolveColor(getValue(ctx.colors, "a:tx1"), ctx.colors)
            const buClr = customBuClr || defaultClr || "#000000"

            const buSzPts = getPrioritizedAttribute("val", "a:buSzPts")
            const buSzPct = getPrioritizedAttribute("val", "a:buSzPct")
            const defaultFontSizePx = ptsToPx(getPrioritizedStyle(firstRun, pPrL, pPrM, tx, "sz")) || 24
            let buFontSizePx = defaultFontSizePx
            if (buSzPts) buFontSizePx = ptsToPx(buSzPts) || defaultFontSizePx
            else if (buSzPct) buFontSizePx = round(defaultFontSizePx * (Number(buSzPct) / 100000))

            const marL = Number(getPrioritizedAttribute("marL") || "0")
            const indent = Number(getPrioritizedAttribute("indent") || "0")
            const padLeft = marL ? round(emuToPixels(Math.max(0, marL + indent)) * (ctx.scale.x ?? 1)) : 0
            const rawPadRight = indent < 0 ? round(emuToPixels(Math.abs(indent)) * (ctx.scale.x ?? 1)) : 16
            const padRight = !rawPadRight || rawPadRight < 8 ? 16 : rawPadRight

            let style = `font-family: ${buFont ? buFont + ", " : ""}Calibri;font-size: ${buFontSizePx}px;color: ${buClr};padding-left: ${padLeft}px;padding-right: ${padRight}px;`
            style += getShadowStyle(firstRunRPr, pPrL, pPrM, tx)
            if (getPrioritizedStyle(firstRun, pPrL, pPrM, tx, "b") === "1") style += "font-weight: bold;"
            if (getPrioritizedStyle(firstRun, pPrL, pPrM, tx, "i") === "1") style += "font-style: italic;"

            const startAt = Number(getPrioritizedAttribute("startAt", "a:buAutoNum") || "1")

            return { value: buChar, style, autoNum, startAt }
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

                    const pPrL = getValue(pL[i] ? pL[i] : pL[0], "a:lstStyle", `a:lvl${lvl}pPr`)
                    const pPrM = getValue(pM[i] ? pM[i] : pM[0], "a:lstStyle", `a:lvl${lvl}pPr`)
                    let tx = getValue(shape.txStyles, `a:lvl${lvl}pPr`)
                    if (!tx.length) tx = getValue(shape.txStyles, "a:defPPr")

                    const parentRuns = [
                        getValue(shape.layoutShape, "p:txBody", "a:p", "a:r", "a:rPr", "a:solidFill"),
                        getValue(shape.layoutShape, "p:txBody", "a:p", "a:pPr", "a:defRPr", "a:solidFill"),
                        getValue(shape.layoutShape, "p:txBody", "a:p", "a:endParaRPr", "a:solidFill"),
                        getValue(shape.masterShape, "p:txBody", "a:p", "a:r", "a:rPr", "a:solidFill"),
                        getValue(shape.masterShape, "p:txBody", "a:p", "a:pPr", "a:defRPr", "a:solidFill"),
                        getValue(shape.masterShape, "p:txBody", "a:p", "a:endParaRPr", "a:solidFill")
                    ].filter((f) => f.length)

                    const sharedStyle = getSharedStyle(pPr, pPrL, pPrM)
                    const firstRun = line.find((a: any) => a["a:r"])?.["a:r"] || line.find((a: any) => a["a:endParaRPr"]) || []
                    const bullet = getBullet(pPr, pPrL, pPrM, tx, firstRun)

                    // WIP split "a:br" properly as it breaks when style is changed

                    // const rs = getValues(line, "a:r")
                    // const br = getValues(line, "a:br")
                    const rs: any[][] = []
                    line.forEach((l) => {
                        if (l["a:r"]) rs.push(l["a:r"])
                        else if (l["a:fld"]) rs.push(l["a:fld"])
                        else if (l["a:br"]) {
                            const br = { ...l["a:br"], ["a:t"]: [{ "#text": "<br>" }] }
                            rs.push(br)
                        }
                    })
                    const algn = getAttribute(pPr, "algn") || getAttribute(pPrL, "algn") || getAttribute(pPrM, "algn") || getAttribute(tx, "algn") || (svgText ? "ctr" : "")

                    if (i === 0) hasText = false
                    if (rs.length) hasText = true

                    function getAlignment(algn: string) {
                        if (algn === "ctr") return "" // FreeShow default is center
                        if (algn === "r") return "text-align: right;"
                        if (algn === "just") return "text-align: justify;"
                        if (algn === "l") return "text-align: left;"
                        return svgText ? "" : "text-align: left;" // PPT default is left
                    }

                    let text = rs.length
                        ? rs.map((r) => {
                              // const br = getValue(r, "a:br")
                              const value = (getValue(r, "a:t")[0]?.["#text"]?.toString() || "").replaceAll("\t", "&nbsp;&nbsp;&nbsp;&nbsp;")
                              const style = sharedStyle + getRStyle(r, pPr, pPrL, pPrM, tx, parentRuns)
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
                                            pPr,
                                            pPrL,
                                            pPrM,
                                            tx,
                                            parentRuns
                                        )
                                }
                            ] // space so style (font size) applies
                          : []

                    if (text.length) {
                        const mergedText: { value: string; style: string }[] = []
                        for (const seg of text) {
                            const prev = mergedText[mergedText.length - 1]
                            if (prev && prev.style === seg.style && prev.value !== "<br>" && seg.value !== "<br>") {
                                prev.value += seg.value
                            } else {
                                mergedText.push({ ...seg })
                            }
                        }
                        text = mergedText
                    }

                    const hasContent = text.some((t) => t.value && t.value !== "<br>" && t.value !== "&nbsp;" && t.value.replaceAll("&nbsp;", "").trim().length > 0)
                    if (hasContent && bullet) {
                        const val = bullet.autoNum ? getBulletValue(bullet.autoNum, bulletNum + bullet.startAt - 1) : bullet.value
                        text = [{ value: val, style: bullet.style }, ...text]
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

        let style = "overflow: visible;" // PPT shows overflow text

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

        const bodyPrs = [getValue(shape.shape, "p:txBody", "a:bodyPr"), getValue(shape.layoutShape, "p:txBody", "a:bodyPr"), getValue(shape.masterShape, "p:txBody", "a:bodyPr")]

        // auto size (shrinkToFit changes the font size even when it's not overflowing)
        // const hasNormAutofit = bodyPrs.some((b) => b?.some?.((n: any) => n.hasOwnProperty("a:normAutofit")))
        // const hasSpAutoFit = bodyPrs.some((b) => b?.some?.((n: any) => n.hasOwnProperty("a:spAutoFit")))
        // if (hasNormAutofit || hasSpAutoFit) item.textFit = "shrinkToFit"

        const itemAlign = getAttribute(shape.shape, "anchor", "p:txBody") || getAttribute(getValue(shape.shape, "p:txBody"), "anchor", "a:bodyPr") || getAttribute(getValue(shape.layoutShape, "p:txBody"), "anchor", "a:bodyPr") || getAttribute(getValue(shape.masterShape, "p:txBody"), "anchor", "a:bodyPr") || ""
        item.align = getItemAlign(itemAlign) + "overflow: visible;" // PPT shows overflow text
        function getItemAlign(anchor: string) {
            if (anchor === "ctr") return "" // FreeShow default is center alignment
            if (anchor === "b") return "align-items: flex-end;"
            if (anchor === "t") return "align-items: flex-start;"
            if (svgText) return ""
            return "align-items: flex-start;" // PPT default is top alignment
        }

        const pptShapeToNormalizedSvg = (node: any, image?: string): string | null => {
            const spPr = getValue(node, "p:spPr")
            if (!spPr) return null

            let prstGeom = getAttribute(spPr, "prst", "a:prstGeom")
            if (!prstGeom && shape.name === "p:cxnSp") prstGeom = "line"
            // const prstGeom = spPr["a:prstGeom"]?.[0].$?.prst
            // if (!prstGeom || prstGeom === "rect") return null

            const pos = shape.pos
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
                const lnW = getAttribute(spPr, "w", "a:ln") || "0"
                strokeWidth = Math.max(1, round((emuToPixels(lnW) || 1) * (ctx.scale?.factor ?? 1)))
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
            } else if (shape.name === "p:cxnSp") {
                stroke = resolveColor(getValue(spPr, "a:ln", "a:schemeClr"), ctx.colors) || "#ffffff"
                strokeWidth = 1
            }
            // WIP stroke is overflowing outside of item

            let svgAttributes = `fill="${fill}"`
            if (fillOpacity < 1) svgAttributes += ` fill-opacity="${fillOpacity}"`
            if (stroke !== "none") svgAttributes += ` stroke="${stroke}"`
            if (strokeWidth && stroke !== "none") svgAttributes += ` stroke-width="${strokeWidth}" vector-effect="non-scaling-stroke"`
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
                    const size = getAttributes(getValue(spPr, "a:custGeom", "a:pathLst"), "a:path") as { w: string; h: string }
                    const customShape = getCustomShapePath(customPath, size)
                    if (customShape && customShape.pathData) {
                        if (!image) {
                            return `<svg data-shape="custom" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${customShape.vbWidth} ${customShape.vbHeight}" style="position: absolute;">
                                <path ${svgAttributes} d="${customShape.pathData}"></path>
                            </svg>`
                        }

                        function toFract(v: string): number {
                            if (!v) return 0
                            const n = Number(v)
                            if (isNaN(n)) return 0
                            // 100,000 units = 100%. Divide by 100,000 to get a 0.0-1.0 fraction.
                            return n / 100000
                        }

                        const stretch = getValue(blipFill, "a:stretch")
                        const l = toFract(getAttribute(stretch, "l", "a:fillRect"))
                        const t = toFract(getAttribute(stretch, "t", "a:fillRect"))
                        const r = toFract(getAttribute(stretch, "r", "a:fillRect"))
                        const b = toFract(getAttribute(stretch, "b", "a:fillRect"))

                        // The image frame starts at (l, t)
                        let imgX = l * 100
                        let imgY = t * 100

                        // The width is the total (100%) minus the left and right offsets
                        let imgW = (1 - l - r) * 100
                        let imgH = (1 - t - b) * 100

                        // srcRect is inset
                        if (imgX === 0 && imgY === 0 && imgW === 100 && imgH === 100) {
                            const srcL = toFract(getAttribute(blipFill, "l", "a:srcRect"))
                            const srcT = toFract(getAttribute(blipFill, "t", "a:srcRect"))
                            const srcR = toFract(getAttribute(blipFill, "r", "a:srcRect"))
                            const srcB = toFract(getAttribute(blipFill, "b", "a:srcRect"))

                            imgX = srcL * 100 * -1
                            imgY = srcT * 100 * -1
                            imgW = 100 + (srcL + srcR) * 100
                            imgH = 100 + (srcT + srcB) * 100
                        }

                        const uniqueId = `clip_${uid(5)}`

                        return `<svg viewBox="0 0 ${customShape.vbWidth} ${customShape.vbHeight}" style="position: absolute;">
                                <defs>
                                    <clipPath id="${uniqueId}">
                                        <path d="${customShape.pathData}"></path>
                                    </clipPath>
                                </defs>
                                <image 
                                    href="${image}" 
                                    clip-path="url(#${uniqueId})" 
                                    x="${imgX}%" 
                                    y="${imgY}%" 
                                    width="${imgW}%" 
                                    height="${imgH}%" 
                                    preserveAspectRatio="none" 
                                />
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
            if (!path) return null

            return `<svg data-shape="${prstGeom}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none" style="position: absolute; width: 100%; height: 100%;">
                    <path ${svgAttributes} d="${path}"></path>
                </svg>`
        }

        let blipFill = getValue(shape.shape, "p:blipFill")
        if (!blipFill.length) blipFill = getValue(spPr, "a:blipFill")

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
            const hasContent = item.lines.length && getItemText(item).length
            const prstGeom = getAttribute(spPr, "prst", "a:prstGeom")
            const customPath = getValue(spPr, "a:custGeom", "a:pathLst", "a:path")
            if (!svgText && (!hasContent || (prstGeom && prstGeom !== "rect") || customPath.length)) {
                const rid = getAttribute(blipFill, "r:embed", "a:blip")
                const image = this.getMediaPath(rid, shape.part ? { part: shape.part, ...ctx } : ctx) || ""

                const svg = pptShapeToNormalizedSvg(shape.shape, image)
                if (svg) {
                    if (hasContent) {
                        if (svgText) return null
                        this.extraItems.push({ index, item: this.shapeToItem(clone(shape), clone(ctx), index, true) })
                    }

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
            const rid = getAttribute(blipFill, "r:embed", "a:blip")
            const image = this.getMediaPath(rid, shape.part ? { part: shape.part, ...ctx } : ctx) || ""

            const svg = pptShapeToNormalizedSvg(shape.shape, image)
            if (svg) {
                delete item.lines
                item.type = "icon"
                item.customSvg = svg
                // textboxStyle = ""
                svgShape = true
            } else {
                item.src = image

                // const mediaFit = getAttribute(fill, "method", "p:blipFill")
                item.fit = "fill"

                const filter = resolveImageEffects(blipFill, ctx.colors)
                if (filter) item.filter = filter

                // is video elem
                const nvPr = getValue(shape.shape, "p:nvPicPr", "p:nvPr")
                const videoId = getAttribute(nvPr, "r:link", "a:videoFile")
                const videoPath = this.getMediaPath(videoId, shape.part ? { part: shape.part, ...ctx } : ctx)
                if (videoPath) {
                    item.src = videoPath
                    item.loop = false
                }

                // is online media element
                // const title = getAttribute(getValue(shape.shape, "p:nvPicPr")[0], "title")
                const cNvPr = getValue(shape.shape, "p:nvPicPr", "p:cNvPr")
                const hlinkClickId = getAttribute(cNvPr[0], "r:id", "hlinkClick")
                const activePart = shape.part || ctx.slide
                const links = activePart?.getRelationships?.("http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink") || []
                const url = links.find((l: any) => l.id === hlinkClickId)?.target
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
            }
        } else if (shape.name === "p:cxnSp") {
            const svg = pptShapeToNormalizedSvg(shape.shape)
            if (svg) {
                delete item.lines
                item.type = "icon"
                item.customSvg = svg
                svgShape = true
            }
        } else if (type2 === "chart") {
            // table / chart
            return null
        }

        if (shape.isDecoration) item.decoration = true

        // padding: default 72000 EMU (0.1 in) left/right, 36000 EMU (0.05 in) top/bottom for text shapes
        const isText = (shape.name === "p:sp" || svgText) && !svgShape
        const getPad = (key: string, defEmu: number, scale = 1) => {
            const raw = bodyPrs.map((b) => getAttribute(b, key)).find((v) => v !== "")
            const emu = raw != null && !isNaN(Number(raw)) ? Number(raw) : isText ? (svgText && (key === "tIns" || key === "bIns") ? 0 : defEmu) : 0
            return round(emuToPixels(emu) * scale)
        }
        item.style += `padding: ${getPad("tIns", 36000, ctx.scale.y)}px ${getPad("rIns", 72000, ctx.scale.x)}px ${getPad("bIns", 36000, ctx.scale.y)}px ${getPad("lIns", 72000, ctx.scale.x)}px;`

        if (bgColor && !svgShape && !svgText) item.style += `background-color: ${bgColor};`

        // border
        const lineFill = getValue(spPr, "a:ln", "a:solidFill")
        if (!svgShape && !svgText && lineFill.length) {
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

        let pos = shape.pos
        if (pos.left) pos.left *= ctx.scale.x ?? 1
        if (pos.top) pos.top *= ctx.scale.y ?? 1
        if (pos.width) pos.width *= ctx.scale.x ?? 1
        if (pos.height) pos.height *= ctx.scale.y ?? 1
        if (pos.width + pos.height + pos.left + pos.top === 0) pos = getPosition(shape.layoutShape, ctx.scale)
        if (pos.width + pos.height + pos.left + pos.top === 0) pos = getPosition(shape.masterShape, ctx.scale)
        if (pos.width === 0 && pos.height === 0) pos = { left: 80, top: 200, width: 1760, height: 680 } // set default pos

        // some PPT shapes have width or height of 0, which will cause them to not be visible in CSS rendering, set minimum size
        if (svgShape) {
            const lnW = getAttribute(spPr, "w", "a:ln") || "0"
            const strokeWidth = emuToPixels(lnW)
            if (!pos.height) {
                const size = Math.max(strokeWidth, 4)
                pos.top -= size / 2
                pos.height = size
            }
            if (!pos.width) {
                const size = Math.max(strokeWidth, 4)
                pos.left -= size / 2
                pos.width = size
            }
        }

        item.style += Object.entries(pos)
            .map(([k, v]) => (v != null ? `${k}: ${v}px;` : ""))
            .join("")

        // cropping

        if (!svgShape && !svgText) {
            const l = getAttribute(blipFill, "l", "a:srcRect")
            const t = getAttribute(blipFill, "t", "a:srcRect")
            const r = getAttribute(blipFill, "r", "a:srcRect")
            const b = getAttribute(blipFill, "b", "a:srcRect")

            // should be mainly for media item
            if (l !== "" || t !== "" || r !== "" || b !== "") {
                item.cropping = {
                    left: toFract(l), // , emuToPixels(pos.width || 0)),
                    top: toFract(t), // , emuToPixels(pos.height || 0)),
                    right: toFract(r), // , emuToPixels(pos.width || 0)),
                    bottom: toFract(b), // , emuToPixels(pos.height || 0))
                    type: "ppt"
                }
                if (item.cropping.left + item.cropping.right + item.cropping.top + item.cropping.bottom === 0) delete item.cropping
            }
        }

        function toFract(v: string): number {
            if (!v) return 0
            const n = Number(v)
            if (isNaN(n)) return 0
            // a:srcRect values are relative coordinates where 100000 == 100%
            // convert to fraction (0..1). Caller can multiply by image dimension when available.
            let rounded = round(n / 1000) // 1000 works here
            if (rounded < 0.05 && rounded > -0.05) rounded = 0
            return rounded
        }

        return item
    }

    private getMediaPath(rid?: string, ctx?: { slide?: any; layout?: any; master?: any; part?: any } | OpcPart | null): string | null {
        if (!rid) return null
        // Look for relationship in part, then slide, then layout, then master
        const tryFind = (part: any) => {
            if (!part) return null
            const rels = part.relationships || []
            const rel = rels.find((r: any) => r.id === rid || r.Id === rid)
            if (rel) return getTarget(part.path, rel) || rel.target
            return null
        }
        let target: string | null = null
        if (ctx instanceof OpcPart || (ctx && "relationships" in ctx && "path" in ctx)) {
            target = tryFind(ctx)
        } else if (ctx) {
            target = tryFind(ctx.part) || tryFind(ctx.slide) || tryFind(ctx.layout) || tryFind(ctx.master)
        }
        if (!target) target = rid
        // Map to contentPaths if available
        const fsPath = this.contentPaths && this.contentPaths[target]
        return fsPath || target
    }
}

/////////
type Position = { left: number; top: number; width: number; height: number }
function getPosition(psp: any, scale: { x: number; y: number; factor: number } | null = null) {
    // common path: p:spPr -> a:xfrm -> a:off/@x,y and a:ext/@cx,cy
    let spPr = getValue(psp, "p:spPr")
    if (!spPr.length) spPr = getValue(psp, "p:grpSpPr")
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
    } as Position
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

    pos: Position
}
function getTempShape(data: { shape: Shape; parentPos: Position | null; child: Position | null }): TempShape {
    const shape = getShape(data.shape)
    const placeholder = getValue(shape.node, "p:nvSpPr", "p:nvPr")[0]
    const isPlaceholder = placeholder?.["p:ph"] ? true : false
    const phType = getAttribute(placeholder, "type", "p:ph")
    const phIdx = getAttribute(placeholder, "idx", "p:ph")

    const pos = getPosition(shape.node)
    if (data.parentPos) {
        pos.left += data.parentPos.left
        pos.top += data.parentPos.top

        if (data.child) {
            pos.left += data.child.left
            pos.top += data.child.top
            const scaleX = data.child.width ? data.parentPos.width / data.child.width : 1
            const scaleY = data.child.height ? data.parentPos.height / data.child.height : 1
            pos.width *= scaleX
            pos.height *= scaleY
        }
    }

    return {
        id: findShapeId(shape) || "",
        name: shape.name,
        node: shape.node,
        isPlaceholder,
        phType,
        phIdx,
        hidden: getAttribute(getValue(shape.node, "p:spPr"), "hidden") === "1", // ?
        pos
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
function unpackGroups(shapes: Shape[], parentPos: Position | null = null, child: Position | null = null): { shape: Shape; parentPos: Position | null; child: Position | null }[] {
    const out: { shape: Shape; parentPos: Position | null; child: Position | null }[] = []

    for (const node of shapes) {
        const shape = getShape(node)
        if (shape.name === "p:grpSp") {
            const groupPos = getPosition(shape.node)
            if (parentPos) {
                groupPos.left += parentPos.left
                groupPos.top += parentPos.top
            }
            const chOff = getAttributes(getValue(shape.node, "p:grpSpPr", "a:xfrm"), "a:chOff")
            const chExt = getAttributes(getValue(shape.node, "p:grpSpPr", "a:xfrm"), "a:chExt")
            const child = { left: round(emuToPixels(chOff?.x)), top: round(emuToPixels(chOff?.y)), width: round(emuToPixels(chExt?.cx)), height: round(emuToPixels(chExt?.cy)) }

            const unpacked = unpackGroups(shape.node, groupPos, child)
            out.push(...unpacked)
        } else if (validShapes.includes(shape.name)) {
            out.push({ shape: node, parentPos, child })
        }
    }

    return out
}

const keyOf = (s: TempShape) => `${s.phType}|${s.phIdx}`
function buildRenderList(masterShapes: Shape[], layoutShapes: Shape[], slideShapes: Shape[], master: SlideMasterPart | null, slide: SlidePart | null = null, layout: SlideLayoutPart | null = null, layoutShowMasterSp: boolean = false) {
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

    const render: { name: string; shape: Shape; pos: Position; layoutShape: Shape; masterShape: Shape; txStyles: any[]; isDecoration?: boolean; part?: OpcPart }[] = []

    for (const s of tempSlideShapes) {
        if (!s.hidden) {
            const matchedLayout = findMatchingPlaceholder(s, tempLayoutShapes)
            const matchedMaster = findMatchingPlaceholder(s, tempMasterShapes) || (matchedLayout ? findMatchingPlaceholder(matchedLayout, tempMasterShapes) : null)
            const effectivePhType = s.phType || matchedLayout?.phType || matchedMaster?.phType || (s.phIdx === "0" ? "title" : s.phIdx === "1" ? "body" : "")

            render.push({
                name: s.name,
                shape: s.node,
                pos: s.pos,
                layoutShape: matchedLayout ? matchedLayout.node : [],
                masterShape: matchedMaster ? matchedMaster.node : [],
                txStyles: getTxStyles(effectivePhType),
                part: slide || undefined
            })
        }
    }

    for (const s of tempLayoutShapes) {
        if (s.hidden) continue
        if (!s.isPlaceholder || !slidePH.has(keyOf(s))) {
            const matchedMaster = findMatchingPlaceholder(s, tempMasterShapes)
            const effectivePhType = s.phType || matchedMaster?.phType || (s.phIdx === "0" ? "title" : s.phIdx === "1" ? "body" : "")
            render.push({
                name: s.name,
                shape: s.node,
                pos: s.pos,
                layoutShape: [],
                masterShape: matchedMaster ? matchedMaster.node : [],
                txStyles: getTxStyles(effectivePhType),
                isDecoration: true,
                part: layout || undefined
            })
        }
    }

    if (layoutShowMasterSp) {
        for (const s of tempMasterShapes) {
            if (s.hidden) continue
            const k = keyOf(s)
            if (!s.isPlaceholder || (!slidePH.has(k) && !layoutPH.has(k))) {
                render.push({ name: s.name, shape: s.node, pos: s.pos, layoutShape: [], masterShape: [], txStyles: [], isDecoration: true, part: master || undefined })
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
        if (type && (type.toLowerCase().includes("title") || type.toLowerCase().includes("ctrtitle"))) return getValue(txStyles, "p:titleStyle")
        if (type && (type.toLowerCase().includes("body") || type.toLowerCase().includes("subtitle"))) return getValue(txStyles, "p:bodyStyle")
        return getValue(txStyles, "p:otherStyle")
    }
}

function findMatchingPlaceholder(source: TempShape | null, targetShapes: TempShape[]): TempShape | null {
    if (!source?.isPlaceholder) return null

    const type = source.phType || (source.phIdx === "0" ? "title" : source.phIdx === "1" ? "body" : "")
    const isTitle = type === "title" || type === "ctrTitle"
    const isBody = type === "body" || type === "subTitle"

    return (source.phIdx ? targetShapes.find((t) => t.isPlaceholder && t.phIdx === source.phIdx) : null) || (source.phType ? targetShapes.find((t) => t.isPlaceholder && t.phType === source.phType) : null) || (isTitle ? targetShapes.find((t) => t.isPlaceholder && (t.phType === "title" || t.phType === "ctrTitle" || t.phIdx === "0")) : null) || (isBody ? targetShapes.find((t) => t.isPlaceholder && (t.phType === "body" || t.phType === "subTitle" || t.phIdx === "1")) : null) || null
}

function resolveColor(solidFill: any[], colors: { [key: string]: any }[], { lumMod, lumOff }: { lumMod?: string; lumOff?: string } = {}) {
    if (!solidFill?.length) return null

    const srgb = getAttribute(solidFill, "val", "a:srgbClr") || getAttribute(solidFill, "lastClr", "a:sysClr")

    if (srgb) {
        // luminance modifications
        if (!lumMod) lumMod = getAttribute(getValue(solidFill, "a:srgbClr"), "val", "a:lumMod")
        if (!lumOff) lumOff = getAttribute(getValue(solidFill, "a:srgbClr"), "val", "a:lumOff")
        if (lumMod) {
            // parse from percentages of 100,000
            let mod = lumMod ? parseInt(lumMod, 10) / 100000 : 1
            let off = lumOff ? parseInt(lumOff, 10) / 100000 : 0

            const hsl = hexToHSL("#" + srgb)
            let { h, s, l } = hsl

            // HSL functions scale by 100
            off *= 100

            // apply the transformation to the Luminance channel
            // NewL = (OldL * mod) + off
            l = l * mod + off

            // clamp between 0 and 100
            l = Math.max(0, Math.min(100, l))

            return hslToHex(h, s, l)
        }

        const alpha = getAttribute(getValue(solidFill, "a:srgbClr"), "val", "a:alpha")
        if (alpha) {
            const opacity = parseInt(alpha, 10) / 100000
            const rgb = hexToRgb("#" + srgb)
            return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
        }

        // if (!srgb.startsWith("#")) return "#" + srgb
        return "#" + srgb
    }

    const prst = getAttribute(solidFill, "val", "a:prstClr")
    if (prst) {
        return prst
    }

    let scheme = getAttribute(solidFill, "val", "a:schemeClr")
    if (scheme) {
        if (!scheme.startsWith("a:")) scheme = "a:" + scheme
        let themeClr = getValue(colors, scheme)
        if (!themeClr.length) {
            if (scheme === "a:tx1") themeClr = getValue(colors, "a:dk1")
            else if (scheme === "a:tx2") themeClr = getValue(colors, "a:dk2")
            else if (scheme === "a:bg1") themeClr = getValue(colors, "a:lt1")
            else if (scheme === "a:bg2") themeClr = getValue(colors, "a:lt2")
        }

        const lumMod = getAttribute(getValue(solidFill, "a:schemeClr"), "val", "a:lumMod")
        const lumOff = getAttribute(getValue(solidFill, "a:schemeClr"), "val", "a:lumOff")
        const color = resolveColor(themeClr, colors, { lumMod, lumOff })

        const alpha = getAttribute(getValue(solidFill, "a:schemeClr"), "val", "a:alpha")
        if (alpha && color) {
            const opacity = parseInt(alpha, 10) / 100000
            const rgb = hexToRgb(color)
            if (rgb) return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`
        }
        return color
    }

    return ""
}

function resolveGradient(gradFill: any[], colors: { [key: string]: any }[]) {
    if (!gradFill?.length) return null

    const stops = getValue(gradFill, "a:gsLst")
    let gradientStops: string[] = []

    for (const stop of stops) {
        const color = resolveColor(stop["a:gs"], colors) || "#000"
        const rawPos = parseInt(getAttribute(stop, "pos", "a:gs") || "0")
        const pos = rawPos / 1000
        gradientStops.push(`${color} ${pos}%`)
    }

    const type = getAttribute(gradFill, "path", "a:path")
    if (type === "circle") {
        return `radial-gradient(circle at center, ${gradientStops.join(", ")})`
    }

    const rawAngle = parseInt(getAttribute(gradFill, "ang", "a:lin") || "0")
    const angle = rawAngle / 60000 + 90

    return `linear-gradient(${angle}deg, ${gradientStops.join(", ")})`
}

function resolveImageEffects(blipFill: any[], colors: { [key: string]: any }[] = []): string {
    const blip = getValue(blipFill, "a:blip")
    if (!blip.length) return ""

    const filters: string[] = []
    const toPct = (val?: string) => (val != null && val !== "" ? Number(val) / 100000 : null)

    // DrawingML direct effects
    const lum = getValue(blip, "a:lum")
    const lumB = toPct(getAttribute(lum, "bright"))
    const lumC = toPct(getAttribute(lum, "contrast"))
    if (lumB != null) filters.push(`brightness(${round(Math.max(0, 1 + lumB))})`)
    if (lumC != null) filters.push(`contrast(${round(Math.max(0, 1 + lumC))})`)
    if (getValue(blip, "a:grayscl").length) filters.push("grayscale(1)")

    // a:duotone effect
    const duotone = getValue(blip, "duotone")
    if (duotone.length) {
        let tintColor: string | null = null
        for (const clrNode of duotone) {
            const clr = resolveColor([clrNode], colors)
            if (clr && clr.toLowerCase() !== "#000000" && clr.toLowerCase() !== "#000" && clr.toLowerCase() !== "black") {
                tintColor = clr
                break
            }
        }

        if (tintColor) {
            const hsl = hexToHSL(tintColor)
            if (hsl && hsl.s > 5) {
                const hueDiff = Math.round(hsl.h - 38)
                const satBoost = Math.max(1, Math.round(hsl.s / 35))
                filters.push(`grayscale(1) sepia(1) hue-rotate(${hueDiff}deg) saturate(${satBoost})`)
            } else {
                filters.push("grayscale(1)")
            }
        } else {
            filters.push("grayscale(1)")
        }
    }

    // Extension image effects (a14 / a15 / a16 / any namespace)
    const effects = getValues(blip, "extLst", "ext", "imgProps", "imgLayer", "imgEffect").flat()
    for (const effect of effects) {
        const attrs = effect?.[":@"] || {}
        const tag = Object.keys(effect || {}).find((k) => k !== ":@") || ""
        const name = tag.includes(":") ? tag.split(":")[1] : tag

        if (name === "brightnessContrast") {
            const b = toPct(attrs.bright)
            const c = toPct(attrs.contrast)
            if (b != null) filters.push(`brightness(${round(Math.max(0, 1 + b))})`)
            if (c != null) filters.push(`contrast(${round(Math.max(0, 1 + c))})`)
        } else if (name === "saturation") {
            const s = toPct(attrs.sat)
            if (s != null) filters.push(`saturate(${round(Math.max(0, s))})`)
        } else if (name === "colorTemperature") {
            const temp = Number(attrs.colorTemp)
            if (temp > 0 && temp !== 6500) {
                const diff = (6500 - temp) / 6500
                filters.push(diff > 0 ? `sepia(${round(diff * 0.4)})` : `hue-rotate(${round(diff * 20)}deg)`)
            }
        } else if (name === "sharpenSoften") {
            const amount = Number(attrs.amount || 0)
            if (amount < 0) filters.push(`blur(${round(Math.abs(amount) / 20000, 1)}px)`)
        }
    }

    return filters.join(" ")
}

///// XML

function getNodeChild(n: any, key: string): any[] | undefined {
    if (!n || typeof n !== "object") return undefined
    if (n.hasOwnProperty(key)) return n[key]
    const local = key.includes(":") ? key.split(":")[1] : key
    const matchKey = Object.keys(n).find((k) => k !== ":@" && (k === local || k.endsWith(":" + local)))
    return matchKey ? n[matchKey] : undefined
}

function getValue(data: any[], ...path: string[]): any[] {
    if (!Array.isArray(data)) return []

    let current = data
    for (const key of path) {
        let next: any[] | undefined
        for (const n of current) {
            next = getNodeChild(n, key)
            if (Array.isArray(next)) break
        }
        if (!Array.isArray(next)) return []
        current = next
    }

    return current
}

function getValues(data: any[], ...path: string[]): any[][] {
    if (!Array.isArray(data)) return []

    let lastPath = path.pop()!

    let current = data
    for (const key of path) {
        let next: any[] | undefined
        for (const n of current) {
            next = getNodeChild(n, key)
            if (Array.isArray(next)) break
        }
        if (!Array.isArray(next)) return []
        current = next
    }

    return current.map((n: any) => getNodeChild(n, lastPath)).filter((child): child is any[] => Array.isArray(child))
}

// [slide, layout, master]
function getFirstAvailable(datas: any[][], ...paths: string[][]): any[] {
    for (const data of datas) {
        for (const path of paths) {
            const d = getValue(data, ...path)
            if (d.length) return d
        }
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
