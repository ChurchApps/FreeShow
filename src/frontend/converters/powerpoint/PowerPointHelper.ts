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
import { getCustomShapePath, getPresetShapePath, getPresetShapePaths, scalePath, type ShapePath } from "./powerpointShapes"

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

        const slides: ReturnType<PowerPointPackage["getSlide"]>[] = []

        presentation.slideOrder.forEach((target, i) => {
            const slide = this.getSlide(presentation, target, i + 1)
            if (slide) slides.push(slide)
        })

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
    getSlide(presentation: PresentationPart, target: string, slideNumber = 0) {
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

        let items = slideTree.map((n, i) => this.shapeToItem(n, { presentation, slide, layout, master, theme, colors, scale, slideNumber }, i)).filter(Boolean) as Item[]

        // add SVG textboxes
        this.extraItems
            .sort((a, b) => b.index - a.index)
            .forEach(({ index, item }) => {
                if (item) items.splice(index + 1, 0, item)
            })
        this.extraItems = []

        // slide background (the first part that defines a background is used)
        const sldSlide = getValue(slide?.json, "p:sld")
        const sldLayout = getValue(layout?.json, "p:sldLayout")
        const sldMaster = getValue(master?.json, "p:sldMaster")
        const bgParts: [any[], SlidePart | SlideLayoutPart | SlideMasterPart | null][] = [
            [sldSlide, slide],
            [sldLayout, layout],
            [sldMaster, master]
        ]
        const [bgSld, bgPart] = bgParts.find(([sld]) => getValue(sld, "p:cSld", "p:bg").length) || [[], null]
        const bgPr = getValue(bgSld, "p:cSld", "p:bg", "p:bgPr")
        const bgRef = getValue(bgSld, "p:cSld", "p:bg", "p:bgRef")

        // PowerPoint default background is white (also shown behind transparent background images)
        let bgColor = resolveColor(getValue(bgPr, "a:solidFill"), colors) || resolveGradient(getValue(bgPr, "a:gradFill"), colors) || resolveColor(getValue(bgPr, "a:pattFill", "a:bgClr"), colors) || resolveColor(bgRef, colors) || "#FFFFFF"

        // slide background image
        const bgFill = getValue(bgPr, "a:blipFill")

        const bgImgId = getAttribute(bgFill, "r:embed", "a:blip") || getAttribute(bgFill, "r:link", "a:blip")
        const bgImage = bgImgId ? this.getMediaPath(bgImgId, bgPart || { slide, layout, master }) : null
        if (bgImage) {
            // image can be stretched into a smaller rectangle
            const fillRect = getAttributes(getValue(bgFill, "a:stretch"), "a:fillRect")
            const inset = (key: string) => Number(fillRect[key] || 0) / 100000
            const imgPos = { left: round(inset("l") * 1920), top: round(inset("t") * 1080), width: round((1 - inset("l") - inset("r")) * 1920), height: round((1 - inset("t") - inset("b")) * 1080) }
            let imageItem: Item = { type: "media", style: `width:${imgPos.width}px;height:${imgPos.height}px;top:${imgPos.top}px;left:${imgPos.left}px;`, src: bgImage, fit: "fill" }

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
            notes,
            hidden: getAttribute(slide?.json, "show", "p:sld") === "0"
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
                    for (const n of p) {
                        if (n["a:r"]) text += String(getValue(n["a:r"], "a:t")[0]?.["#text"] ?? "")
                        else if (n["a:br"]) text += "\n"
                    }

                    text += "\n"
                }
            }
        }

        return text.trim()
    }

    private shapeToItem(
        shape: RenderShape,
        ctx: {
            presentation: PresentationPart
            slide: SlidePart
            layout: SlideLayoutPart | null
            master: SlideMasterPart | null
            theme: ThemePart | null
            colors: { [key: string]: any }[]
            scale: { x: number; y: number; factor: number }
            slideNumber?: number
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

        // text properties are inherited: paragraph -> shape list style -> layout placeholder -> master placeholder -> master text styles -> presentation defaults
        const defaultTextStyle = getValue(ctx.presentation?.json, "p:presentation", "p:defaultTextStyle")
        const shapeStyle = getValue(shape.shape, "p:style")
        const fontRef = getValue(shapeStyle, "a:fontRef")
        const fontRefIdx = getAttribute(shapeStyle, "idx", "a:fontRef")

        function getParagraphLevels(line: any[], lvl: number): PropLevel[] {
            const lists = [getValue(shape.shape, "p:txBody", "a:lstStyle"), getValue(shape.layoutShape, "p:txBody", "a:lstStyle"), getValue(shape.masterShape, "p:txBody", "a:lstStyle")]
            const levels = [
                toLevel(
                    line.find((n) => n?.["a:pPr"]),
                    "a:pPr"
                ),
                ...lists.map((list) => getListLevel(list, lvl))
            ].filter(Boolean) as PropLevel[]
            // master text styles & presentation defaults
            const inherited = [getListLevel(shape.txStyles, lvl), getListLevel(defaultTextStyle, lvl)].filter(Boolean) as PropLevel[]
            return [...levels, ...inherited.map((l) => ({ ...l, inherited: true }))]
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

        function getShadowStyle(effects: any[]) {
            let shadowVal = "text-shadow: 0 0 0 rgb(0 0 0 / 0);"

            const glow = getValue(effects, "a:glow")
            const outerShadow = getValue(effects, "a:outerShdw")
            if (outerShadow.length) {
                const color = resolveColor(outerShadow, ctx.colors)
                const rgb = hexToRgb(color || "#000000")
                const shadowColor = color?.startsWith("rgba") ? color : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`
                const blur = round((emuToPixels(getAttribute(effects, "blurRad", "a:outerShdw")) || 0) * 1.5 * ctx.scale.factor)
                const dist = (emuToPixels(getAttribute(effects, "dist", "a:outerShdw")) || 0) * ctx.scale.factor
                const angle = ((Number(getAttribute(effects, "dir", "a:outerShdw") || "0") / 60000) * Math.PI) / 180
                const x = round(Math.cos(angle) * dist)
                const y = round(Math.sin(angle) * dist)
                shadowVal = `text-shadow: ${x}px ${y}px ${blur}px ${shadowColor};`
            } else if (glow.length) {
                const glowColor = resolveColor(glow, ctx.colors) || "rgb(255 255 255)"
                const glowSize = round((emuToPixels(getAttribute(effects, "rad", "a:glow")) || 0) * ctx.scale.factor)
                shadowVal = `text-shadow: 0 0 ${glowSize}px ${glowColor};`
            }

            return shadowVal
        }

        function getTextFit() {
            for (const node of [shape.shape, shape.layoutShape, shape.masterShape]) {
                const bodyPr = getValue(node, "p:txBody", "a:bodyPr")
                if (hasChild(bodyPr, "a:normAutofit")) {
                    const attrs = getAttributes(bodyPr, "a:normAutofit")
                    return { fontScale: Number(attrs.fontScale || 100000) / 100000, lnSpcReduction: Number(attrs.lnSpcReduction || 0) / 100000 }
                }
                if (hasChild(bodyPr, "a:noAutofit") || hasChild(bodyPr, "a:spAutoFit")) break
            }
            return { fontScale: 1, lnSpcReduction: 0 }
        }
        const textFit = getTextFit()

        function getRunInfo(rPr: PropLevel | null, levels: PropLevel[], parentRuns: any[] = []) {
            const rLevels = [
                rPr,
                ...levels.map((l) =>
                    l.children.find((n) => n?.["a:defRPr"])
                        ? {
                              ...toLevel(
                                  l.children.find((n) => n?.["a:defRPr"]),
                                  "a:defRPr"
                              )!,
                              inherited: l.inherited
                          }
                        : null
                )
            ].filter(Boolean) as PropLevel[]
            const own = rLevels.filter((l) => !l.inherited)
            const inherited = rLevels.filter((l) => l.inherited)
            const attr = (key: string) => getLevelAttr(rLevels, key)

            const fontRefTypeface = fontRefIdx === "major" ? "+mj-lt" : fontRefIdx === "minor" ? "+mn-lt" : ""
            const typeface = getTypeface(getLevelChildAttr(own, "a:latin", "typeface") || fontRefTypeface || getLevelChildAttr(inherited, "a:latin", "typeface"))
            const fontSizePx = ptsToPx(Number(attr("sz") || "1800") * textFit.fontScale) || 24

            const getFill = (level: PropLevel) => {
                const solid = getValue(level.children, "a:solidFill")
                if (solid.length) return solid
                // use first gradient stop for text with gradient fill
                return getValue(level.children, "a:gradFill", "a:gsLst")[0]?.["a:gs"] || []
            }
            const colorFills = [...own.map(getFill), ...parentRuns, fontRef, ...inherited.map(getFill), getValue(ctx.colors, "a:tx1")].filter((f) => f?.length)
            const color = colorFills.map((f) => resolveColor(f, ctx.colors)).find(Boolean) || ""

            const effects = rLevels.map((l) => getValue(l.children, "a:effectLst")).find((e) => e.length) || []

            return { rLevels, attr, typeface, fontSizePx, color, effects }
        }

        function getRStyle(rPr: PropLevel | null, levels: PropLevel[], parentRuns: any[] = []) {
            const { rLevels, attr, typeface, fontSizePx, color, effects } = getRunInfo(rPr, levels, parentRuns)

            // a:hlinkClick

            const letterSpacing = ptsToPx(attr("spc"))
            const cap = attr("cap") || "none"
            const isBold = attr("b") === "1"
            const isItalic = attr("i") === "1"
            const underline = attr("u")
            const isStrikethrough = attr("strike") && attr("strike") !== "noStrike"

            // outline
            const ln = rLevels.map((l) => l.children.find((n) => n?.["a:ln"])).find(Boolean)
            const lnFill = ln ? getValue(ln["a:ln"], "a:solidFill") : []
            const lnColor = ln ? resolveColor(lnFill.length ? lnFill : getValue(ln["a:ln"], "a:gradFill", "a:gsLst")[0]?.["a:gs"], ctx.colors) : ""
            // PowerPoint default outline is 0.75pt
            const lnWPx = lnColor ? Math.max(1, round(emuToPixels(ln[":@"]?.w || 9525) * ctx.scale.factor)) : 0

            const highlight = resolveColor(getValue(rPr?.children || [], "a:highlight"), ctx.colors)

            // raised text
            const baseline = attr("baseline") || "0"
            let blEm = Number(baseline) / 100000

            let style = ""
            style += `font-family: ${typeface ? typeface + ", " : ""}Calibri;`
            style += `font-size: ${round(fontSizePx * (blEm ? 0.6 : 1))}px;`
            if (letterSpacing) style += `letter-spacing: ${letterSpacing}px;`
            if (isBold) style += "font-weight: bold;"
            if (isItalic) style += "font-style: italic;"
            if (underline && underline !== "none") style += "text-decoration: underline;"
            if (underline === "dbl") style += "text-decoration-style: double;"
            if (isStrikethrough) style += "text-decoration: line-through;"
            style += `color: ${color || "#000000"};`
            if (highlight) style += `background-color: ${highlight};`
            style += getShadowStyle(effects)
            if (blEm) style += `vertical-align: calc(${blEm}em + 10px);`
            // PowerPoint draws the outline centered on top of the fill (FreeShow default is behind)
            if (lnWPx) style += `-webkit-text-stroke-width: ${lnWPx}px;paint-order: normal;-webkit-text-stroke-color: ${lnColor};`
            if (cap === "all") style += "text-transform: uppercase;"
            if (cap === "small") style += "font-variant: small-caps;"

            return style
        }

        function getSharedStyle(levels: PropLevel[]) {
            // line
            // default line spacing is typically set to 1.0, this usually corresponds to roughly 1.2 times the font size
            const lnSpc = getLevelChild(levels, "a:lnSpc")

            let style = ""

            const spcPct = getAttribute(lnSpc, "val", "a:spcPct")
            const spcPts = getAttribute(lnSpc, "val", "a:spcPts")
            if (spcPts) {
                const lnPx = ptsToPx(spcPts)
                if (lnPx > 0) style += `line-height: ${lnPx}px;`
            } else if (spcPct || textFit.lnSpcReduction) {
                // 100000 = 100% = apprx 1.2em
                const lnEm = (Number(spcPct || "100000") / 100000 - textFit.lnSpcReduction) * 1.2
                if (lnEm > 0) style += `line-height: ${round(lnEm)}em;`
            }

            // paragraph space before / after
            function getSpace(tag: "a:spcBef" | "a:spcAft") {
                const spc = getLevelChild(levels, tag)
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

        function getBullet(levels: PropLevel[], firstRun: ReturnType<typeof getRunInfo>) {
            let bulletLevel: PropLevel | null = null
            for (const level of levels) {
                if (hasChild(level.children, "a:buNone")) return null
                if (["a:buChar", "a:buAutoNum", "a:buBlip"].some((tag) => hasChild(level.children, tag))) {
                    bulletLevel = level
                    break
                }
            }
            if (!bulletLevel) return null

            const autoNum = getAttribute(bulletLevel.children, "type", "a:buAutoNum")
            let buChar = getAttribute(bulletLevel.children, "char", "a:buChar") || (autoNum ? "" : "•")

            const customBuFont = getLevelChildAttr(levels, "a:buFont", "typeface")
            // symbol fonts are usually not available, use similar unicode characters
            if (/wingdings|symbol/i.test(customBuFont)) {
                // private use area characters (U+F0xx) map to the font's ASCII range
                const code = buChar.charCodeAt(0)
                if (code >= 0xf000 && code <= 0xf0ff) buChar = String.fromCharCode(code - 0xf000)
                buChar = symbolBullets[buChar] || "•"
            }
            const buFont = customBuFont && !/wingdings|symbol/i.test(customBuFont) ? getTypeface(customBuFont) : firstRun.typeface

            const buClr = resolveColor(getLevelChild(levels, "a:buClr"), ctx.colors) || firstRun.color || "#000000"

            const buSzPts = getLevelChildAttr(levels, "a:buSzPts", "val")
            const buSzPct = getLevelChildAttr(levels, "a:buSzPct", "val")
            let buFontSizePx = firstRun.fontSizePx
            if (buSzPts) buFontSizePx = ptsToPx(Number(buSzPts) * textFit.fontScale) || buFontSizePx
            else if (buSzPct) buFontSizePx = round(buFontSizePx * (Number(buSzPct) / 100000))

            const marL = Number(getLevelAttr(levels, "marL") || "0")
            const indent = Number(getLevelAttr(levels, "indent") || "0")
            const padLeft = marL ? round(emuToPixels(Math.max(0, marL + indent)) * (ctx.scale.x ?? 1)) : 0
            const rawPadRight = indent < 0 ? round(emuToPixels(Math.abs(indent)) * (ctx.scale.x ?? 1)) : 16
            const padRight = !rawPadRight || rawPadRight < 8 ? 16 : rawPadRight

            let style = `font-family: ${buFont ? buFont + ", " : ""}Calibri;font-size: ${buFontSizePx}px;color: ${buClr};padding-left: ${padLeft}px;padding-right: ${padRight}px;`
            style += getShadowStyle(firstRun.effects)
            if (firstRun.attr("b") === "1") style += "font-weight: bold;"
            if (firstRun.attr("i") === "1") style += "font-style: italic;"

            const startAt = Number(getAttribute(bulletLevel.children, "startAt", "a:buAutoNum") || "1")

            return { value: buChar, style, autoNum, startAt }
        }

        const getRunText = (run: any[]) => {
            const text = getValue(run, "a:t")[0]?.["#text"]
            return escapeHtml(text == null ? "" : String(text)).replaceAll("\t", "&nbsp;&nbsp;&nbsp;&nbsp;")
        }

        const getText = (n: any) => {
            const p = getValues(n, "p:txBody", "a:p")
            if (!p) return []

            let bulletNum = 0
            let hasText = false
            return p
                .map((line, i) => {
                    const lvl = Number(getAttribute(line, "lvl", "a:pPr") || "0") + 1
                    const levels = getParagraphLevels(line, lvl)

                    const parentRuns = [
                        getValue(shape.layoutShape, "p:txBody", "a:p", "a:r", "a:rPr", "a:solidFill"),
                        getValue(shape.layoutShape, "p:txBody", "a:p", "a:pPr", "a:defRPr", "a:solidFill"),
                        getValue(shape.layoutShape, "p:txBody", "a:p", "a:endParaRPr", "a:solidFill"),
                        getValue(shape.masterShape, "p:txBody", "a:p", "a:r", "a:rPr", "a:solidFill"),
                        getValue(shape.masterShape, "p:txBody", "a:p", "a:pPr", "a:defRPr", "a:solidFill"),
                        getValue(shape.masterShape, "p:txBody", "a:p", "a:endParaRPr", "a:solidFill")
                    ].filter((f) => f.length)

                    const sharedStyle = getSharedStyle(levels)

                    const rs: { rPr: PropLevel | null; value: string }[] = []
                    line.forEach((l) => {
                        if (l["a:r"])
                            rs.push({
                                rPr: toLevel(
                                    l["a:r"].find((a: any) => a?.["a:rPr"]),
                                    "a:rPr"
                                ),
                                value: getRunText(l["a:r"])
                            })
                        else if (l["a:fld"]) {
                            const value = l[":@"]?.type === "slidenum" && ctx.slideNumber ? String(ctx.slideNumber) : getRunText(l["a:fld"])
                            rs.push({
                                rPr: toLevel(
                                    l["a:fld"].find((a: any) => a?.["a:rPr"]),
                                    "a:rPr"
                                ),
                                value
                            })
                        } else if (l["a:br"])
                            rs.push({
                                rPr: toLevel(
                                    l["a:br"].find((a: any) => a?.["a:rPr"]),
                                    "a:rPr"
                                ),
                                value: "<br>"
                            })
                    })
                    const endParaRPr = toLevel(
                        line.find((a) => a?.["a:endParaRPr"]),
                        "a:endParaRPr"
                    )
                    const firstRun = getRunInfo(rs.length ? rs[0].rPr : endParaRPr, levels, parentRuns)
                    const bullet = getBullet(levels, firstRun)

                    const algn = getLevelAttr(levels, "algn") || (svgText ? "ctr" : "")

                    if (i === 0) hasText = false
                    if (rs.length) hasText = true

                    function getAlignment(algn: string) {
                        if (algn === "ctr") return "" // FreeShow default is center
                        if (algn === "r") return "text-align: right;"
                        if (algn === "just" || algn === "dist") return "text-align: justify;"
                        if (algn === "l") return "text-align: left;"
                        return svgText ? "" : "text-align: left;" // PPT default is left
                    }

                    let text = rs.length
                        ? rs.map(({ rPr, value }) => ({ value, style: sharedStyle + getRStyle(rPr, levels, parentRuns) }))
                        : hasText
                          ? [{ value: "&nbsp;", style: sharedStyle + getRStyle(endParaRPr, levels, parentRuns) }] // space so style (font size) applies
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

        // placeholders inherit shape properties from the layout/master placeholder
        const spPr = mergeShapeProperties([shape.shape, shape.layoutShape, shape.masterShape].map((s) => getValue(s, "p:spPr")))
        const flipH = getAttribute(spPr, "flipH", "a:xfrm") === "1"
        const flipV = getAttribute(spPr, "flipV", "a:xfrm") === "1"
        const rot = getAttribute(spPr, "rot", "a:xfrm") || "0"
        const rotate = parseFloat(rot) / 60000 // convert 60,000ths of a degree to degrees

        // shapes are flipped before they are rotated
        const transforms: string[] = []
        if (rotate) transforms.push(`rotate(${rotate}deg)`)
        if (flipH) transforms.push("scaleX(-1)")
        if (flipV) transforms.push("scaleY(-1)")
        if (transforms.length) style += `transform: ${transforms.join(" ")};`

        let item: Item = {
            type: type2,
            style
        }

        // placeholders without their own transform use the layout/master position
        let basePos = shape.pos
        if (basePos.width + basePos.height + basePos.left + basePos.top === 0) basePos = getPosition(shape.layoutShape)
        if (basePos.width + basePos.height + basePos.left + basePos.top === 0) basePos = getPosition(shape.masterShape)

        const bodyPrs = [shape.shape, shape.layoutShape, shape.masterShape].map((s) => getAttributes(getValue(s, "p:txBody"), "a:bodyPr"))

        // shape fill: explicit fill, otherwise the theme style reference
        const getShapeFill = (): { color?: string; gradient?: any[] } => {
            if (shape.attrs?.useBgFill === "1" || hasChild(spPr, "a:noFill")) return {}
            const solid = getValue(spPr, "a:solidFill")
            if (solid.length) return { color: resolveColor(solid, ctx.colors) || "" }
            const gradient = getValue(spPr, "a:gradFill")
            if (gradient.length) return { gradient }
            const pattern = getValue(spPr, "a:pattFill", "a:fgClr")
            if (pattern.length) return { color: resolveColor(pattern, ctx.colors) || "" }
            if (hasChild(spPr, "a:blipFill") || hasChild(spPr, "a:grpFill")) return {}

            const fillRefIdx = Number(getAttribute(shapeStyle, "idx", "a:fillRef") || "0")
            if (fillRefIdx > 0) return { color: resolveColor(getValue(shapeStyle, "a:fillRef"), ctx.colors) || "" }
            return {}
        }

        // shape outline: explicit line, otherwise the theme style reference
        const getShapeStroke = (): { color: string; width: number; ln: any[] } | null => {
            const ln = getValue(spPr, "a:ln")
            if (hasChild(ln, "a:noFill")) return null

            let color = resolveColor(getValue(ln, "a:solidFill"), ctx.colors) || resolveColor(getValue(ln, "a:gradFill", "a:gsLst")[0]?.["a:gs"], ctx.colors)
            let width = getAttribute(spPr, "w", "a:ln")

            const lnRefIdx = Number(getAttribute(shapeStyle, "idx", "a:lnRef") || "0")
            if (!color && lnRefIdx > 0) {
                color = resolveColor(getValue(shapeStyle, "a:lnRef"), ctx.colors)
                if (!width) width = getValue(ctx.theme?.formatScheme || [], "a:lnStyleLst")[lnRefIdx - 1]?.[":@"]?.w || ""
            }
            if (!color) return null

            return { color, width: emuToPixels(width || 12700), ln }
        }

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

        const pptShapeToNormalizedSvg = (image?: string): string | null => {
            let prstGeom = getAttribute(spPr, "prst", "a:prstGeom")
            if (!prstGeom && shape.name === "p:cxnSp") prstGeom = "line"
            // const prstGeom = spPr["a:prstGeom"]?.[0].$?.prst
            // if (!prstGeom || prstGeom === "rect") return null

            const pos = basePos
            // const xfrm = getValue(spPr, "a:xfrm")
            // const ox = getAttribute(xfrm, "x", "a:off")
            // const oy = getAttribute(xfrm, "y", "a:off")
            // const cx = getAttribute(xfrm, "cx", "a:ext")
            // const cy = getAttribute(xfrm, "cy", "a:ext")
            // if (ox == null || oy == null || cx == null || cy == null) return null

            // Fill color (alpha is included in the resolved color)
            const shapeFill = getShapeFill()
            let fill = shapeFill.color || "none"
            let gradientDefs = ""
            if (shapeFill.gradient) {
                const gradientId = `grad_${uid(5)}`
                gradientDefs = getSvgGradient(shapeFill.gradient, ctx.colors, gradientId)
                if (gradientDefs) fill = `url(#${gradientId})`
            }

            // ---- LINE SUPPORT ----
            let stroke = "none"
            let strokeWidth = 0
            let strokeDasharray = ""
            let strokeLinecap = ""
            let strokeLinejoin = ""
            let strokeMiterlimit = 0

            const outline = getShapeStroke()
            if (outline) {
                stroke = outline.color
                strokeWidth = Math.max(1, round((outline.width || 1) * (ctx.scale?.factor ?? 1)))
                const ln = outline.ln
                // Dash style
                const dashVal = getAttribute(ln, "val", "a:prstDash")
                if (dashVal && dashVal !== "solid") {
                    if (dashVal.toLowerCase().includes("dashdot")) strokeDasharray = `${strokeWidth * 4},${strokeWidth * 2},${strokeWidth},${strokeWidth * 2}`
                    else if (dashVal.toLowerCase().includes("dash")) strokeDasharray = `${strokeWidth * 4},${strokeWidth * 2}`
                    else if (dashVal.toLowerCase().includes("dot")) strokeDasharray = `${strokeWidth},${strokeWidth * 2}`
                }

                const cap = getAttribute(spPr, "cap", "a:ln")
                // Line cap
                if (cap === "rnd") strokeLinecap = "round"
                else if (cap === "sq") strokeLinecap = "square"

                // Line join
                if (hasChild(ln, "a:round")) strokeLinejoin = "round"
                else if (hasChild(ln, "a:bevel")) strokeLinejoin = "bevel"
                else if (hasChild(ln, "a:miter")) {
                    strokeLinejoin = "miter"
                    const miterLim = getAttribute(ln, "lim", "a:miter")
                    strokeMiterlimit = miterLim ? Math.max(1, parseFloat(miterLim) / 100000) : 4
                }
            } else if (shape.name === "p:cxnSp" && !hasChild(getValue(spPr, "a:ln"), "a:noFill")) {
                stroke = "#ffffff"
                strokeWidth = 1
            }
            // WIP stroke is overflowing outside of item

            if (fill === "none" && stroke === "none" && !image) return null

            let svgAttributes = `fill="${fill}"`
            if (stroke !== "none") svgAttributes += ` stroke="${stroke}"`
            if (strokeWidth && stroke !== "none") svgAttributes += ` stroke-width="${strokeWidth}"`
            if (strokeDasharray) svgAttributes += ` stroke-dasharray="${strokeDasharray}"`
            if (strokeLinecap) svgAttributes += ` stroke-linecap="${strokeLinecap}"`
            if (strokeLinejoin) svgAttributes += ` stroke-linejoin="${strokeLinejoin}"`
            if (strokeMiterlimit) svgAttributes += ` stroke-miterlimit="${strokeMiterlimit}"`

            // the svg is drawn in slide pixels, so the stroke scales with the slide like in PowerPoint
            // (lines with zero width/height get a minimum item size later)
            const minSize = Math.max(strokeWidth, 4)
            const svgWidth = round(pos.width * ctx.scale.x) || minSize
            const svgHeight = round(pos.height * ctx.scale.y) || minSize

            const wrapSvg = (shapeName: string, shapeViewBox: string, shapePaths: ShapePath[], fillRule = "") => {
                const ruleAttr = fillRule ? ` fill-rule="${fillRule}"` : ""

                const [, , shapeW, shapeH] = shapeViewBox.split(" ").map(Number)
                const paths = shapePaths.map((p) => ({ ...p, d: scalePath(p.d, svgWidth / (shapeW || 1), svgHeight / (shapeH || 1)) }))
                const viewBox = `0 0 ${svgWidth} ${svgHeight}`
                const svgStyle = "position: absolute; width: 100%; height: 100%; overflow: visible;"

                if (!image) {
                    const pathElems = paths.map((p) => {
                        let attrs = svgAttributes
                        if (p.noFill) attrs = attrs.replace(/^fill="[^"]*"/, 'fill="none"')
                        if (p.noStroke) attrs = attrs.replace(/ stroke="[^"]*"/, "")
                        // darker/lighter parts of the shape (e.g. the folds of a ribbon)
                        const shade = p.shade && fill !== "none" && !p.noFill ? `<path fill="${p.shade.color}" fill-opacity="${p.shade.opacity}"${ruleAttr} d="${p.d}"></path>` : ""
                        return `<path ${attrs}${ruleAttr} d="${p.d}"></path>${shade}`
                    })
                    return `<svg data-shape="${shapeName}" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="none" style="${svgStyle}">${gradientDefs}${pathElems.join("")}</svg>`
                }

                // image clipped to the shape
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

                    // cropped image is scaled so the visible part fills the frame
                    const visibleW = 1 - srcL - srcR || 1
                    const visibleH = 1 - srcT - srcB || 1
                    imgW = 100 / visibleW
                    imgH = 100 / visibleH
                    imgX = -srcL * imgW
                    imgY = -srcT * imgH
                }

                const [vbX, vbY, vbW, vbH] = [0, 0, svgWidth, svgHeight]
                const uniqueId = `clip_${uid(5)}`
                const pathData = paths.map((p) => p.d).join(" ")
                const outline = stroke !== "none" ? `<path ${svgAttributes.replace(/^fill="[^"]*"/, 'fill="none"')} d="${pathData}"></path>` : ""

                return `<svg data-shape="${shapeName}" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="none" style="${svgStyle}">
                        <defs>
                            <clipPath id="${uniqueId}">
                                <path${ruleAttr} d="${pathData}"></path>
                            </clipPath>
                        </defs>
                        <image href="${image}" clip-path="url(#${uniqueId})" x="${vbX + (vbW * imgX) / 100}" y="${vbY + (vbH * imgY) / 100}" width="${(vbW * imgW) / 100}" height="${(vbH * imgH) / 100}" preserveAspectRatio="none" />
                        ${outline}
                    </svg>`
            }

            if (!prstGeom) {
                // custom shape
                const customPaths = getValue(spPr, "a:custGeom", "a:pathLst")
                if (customPaths.length) {
                    const customShape = getCustomShapePath(customPaths, { w: pos.width, h: pos.height })
                    if (customShape?.paths.length) return wrapSvg("custom", `0 0 ${customShape.vbWidth} ${customShape.vbHeight}`, customShape.paths, "evenodd")
                }
                return null
            }

            // rectangle pictures are regular media items
            if (prstGeom === "rect" && image) return null

            // adjustment values (e.g. <a:gd name="adj" fmla="val 50000"/>)
            const adjustments: { [key: string]: number } = {}
            getValue(spPr, "a:prstGeom", "a:avLst").forEach((gd) => {
                const { name, fmla } = gd?.[":@"] || {}
                if (name && typeof fmla === "string" && fmla.startsWith("val ")) adjustments[name] = parseFloat(fmla.slice(4))
            })

            // shape definitions from the spec, with the older approximations as fallback
            const presetFillRule = ["frame", "donut", "noSmoking"].includes(prstGeom) ? "evenodd" : ""
            const presetPaths = getPresetShapePaths(prstGeom, pos.width, pos.height, adjustments)
            if (presetPaths) return wrapSvg(prstGeom, "0 0 1 1", presetPaths, presetFillRule)

            const path = getPresetShapePath(prstGeom, pos.left, pos.top, pos.width, pos.height, adjustments)
            if (!path) return null

            return wrapSvg(prstGeom, "0 0 1 1", [{ d: path }], presetFillRule)
        }

        let blipFill = getValue(shape.shape, "p:blipFill")
        if (!blipFill.length) blipFill = getValue(spPr, "a:blipFill")

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

                const svg = pptShapeToNormalizedSvg(image)
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

            const svg = pptShapeToNormalizedSvg(image)
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
            const svg = pptShapeToNormalizedSvg()
            if (svg) {
                delete item.lines
                item.type = "icon"
                item.customSvg = svg
                svgShape = true
            }
        } else if (type2 === "chart") {
            // charts/SmartArt are not supported
            const tbl = getValue(shape.shape, "a:graphic", "a:graphicData", "a:tbl")
            if (!tbl.length) return null

            item.type = "table"
            item.table = this.getTable(tbl, ctx)

            // the table grid defines the actual size
            const gridWidth = getValues(tbl, "a:tblGrid", "a:gridCol").length ? getValue(tbl, "a:tblGrid").reduce((sum, col) => sum + emuToPixels(col?.[":@"]?.w || 0), 0) : 0
            const gridHeight = tbl.filter((n: any) => n?.["a:tr"]).reduce((sum, row) => sum + emuToPixels(row[":@"]?.h || 0), 0)
            if (gridWidth) basePos = { ...basePos, width: round(gridWidth) }
            if (gridHeight > basePos.height) basePos = { ...basePos, height: round(gridHeight) }
        }

        if (shape.isDecoration) item.decoration = true

        // padding: default 91440 EMU (0.1 in) left/right, 45720 EMU (0.05 in) top/bottom for text shapes
        const isText = (shape.name === "p:sp" || svgText) && !svgShape
        const getPad = (key: string, defEmu: number, scale = 1) => {
            // text insets don't apply to shapes/media (the svg/image fills the item box)
            if (!isText) return 0
            const raw = bodyPrs.map((b) => b[key]).find((v) => v != null && v !== "")
            const emu = raw != null && !isNaN(Number(raw)) ? Number(raw) : isText ? (svgText && (key === "tIns" || key === "bIns") ? 0 : defEmu) : 0
            return round(emuToPixels(emu) * scale)
        }
        item.style += `padding: ${getPad("tIns", 45720, ctx.scale.y)}px ${getPad("rIns", 91440, ctx.scale.x)}px ${getPad("bIns", 45720, ctx.scale.y)}px ${getPad("lIns", 91440, ctx.scale.x)}px;`

        if (!svgShape && !svgText && shape.name === "p:sp") {
            const fill = getShapeFill()
            if (fill.color) item.style += `background-color: ${fill.color};`
            else if (fill.gradient) item.style += `background: ${resolveGradient(fill.gradient, ctx.colors)};`
        }

        // border
        const shapeStroke = !svgShape && !svgText && shape.name !== "p:cxnSp" ? getShapeStroke() : null
        if (shapeStroke) {
            const strokeWidth = round(shapeStroke.width * ctx.scale.factor)

            // Dash style
            const dashVal = getAttribute(shapeStroke.ln, "val", "a:prstDash")
            let dashStyle = "solid"
            if (dashVal && dashVal !== "solid") {
                if (dashVal.toLowerCase().includes("dot") && !dashVal.toLowerCase().includes("dash")) dashStyle = "dotted"
                else dashStyle = "dashed" // no direct CSS equivalent, using dashed as fallback
            }

            if (strokeWidth) item.style += `border: ${strokeWidth}px ${dashStyle} ${shapeStroke.color};`
        }

        // position

        let pos = { ...basePos }
        pos.left *= ctx.scale.x ?? 1
        pos.top *= ctx.scale.y ?? 1
        pos.width *= ctx.scale.x ?? 1
        pos.height *= ctx.scale.y ?? 1
        if (pos.width === 0 && pos.height === 0) pos = { left: 80, top: 200, width: 1760, height: 680 } // set default pos

        // some PPT shapes have width or height of 0, which will cause them to not be visible in CSS rendering, set minimum size
        if (svgShape) {
            const strokeWidth = (getShapeStroke()?.width || 0) * ctx.scale.factor
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
            .map(([k, v]) => (v != null ? `${k}: ${round(v)}px;` : ""))
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

    private getTable(tbl: any[], ctx: { colors: { [key: string]: any }[]; scale: { x: number; y: number; factor: number } }): NonNullable<Item["table"]> {
        const tblPrAttrs = getAttributes(tbl, "a:tblPr")
        const styleId = String(getValue(tbl, "a:tblPr", "a:tableStyleId")[0]?.["#text"] || "")
        const tableStyles = getValue(this.parts.get("ppt/tableStyles.xml"), "a:tblStyleLst")
        const tableStyle = tableStyles.find((n: any) => n?.["a:tblStyle"] && n[":@"]?.styleId === styleId)?.["a:tblStyle"] || []

        const rows = getValues(tbl, "a:tr")
        const rowCount = rows.length

        // table style parts that apply to a cell (later parts override earlier ones)
        const getStyleParts = (r: number, c: number, colCount: number) => {
            const parts = ["wholeTbl"]
            const bodyRow = tblPrAttrs.firstRow === "1" ? r - 1 : r
            if (tblPrAttrs.bandRow === "1" && bodyRow >= 0) parts.push(bodyRow % 2 === 0 ? "band1H" : "band2H")
            if (tblPrAttrs.bandCol === "1") parts.push(c % 2 === 0 ? "band1V" : "band2V")
            if (tblPrAttrs.firstCol === "1" && c === 0) parts.push("firstCol")
            if (tblPrAttrs.lastCol === "1" && c === colCount - 1) parts.push("lastCol")
            if (tblPrAttrs.lastRow === "1" && r === rowCount - 1) parts.push("lastRow")
            if (tblPrAttrs.firstRow === "1" && r === 0) parts.push("firstRow")
            return parts.map((key) => getValue(tableStyle, "a:" + key)).filter((a) => a.length)
        }

        const insideH = getValue(tableStyle, "a:wholeTbl", "a:tcStyle", "a:tcBdr", "a:insideH")
        const borderColor = resolveColor(getValue(insideH, "a:ln", "a:solidFill"), ctx.colors) || "#000000"
        const borderWidth = Math.max(1, round(emuToPixels(getAttribute(insideH, "w", "a:ln") || 12700) * ctx.scale.factor))

        const tableRows = rows.map((row, r) => {
            const cells = getValues(row, "a:tc")
            return {
                cells: cells.map((cell, c) => {
                    const cellAttrs = row.filter((n: any) => n?.["a:tc"])[c]?.[":@"] || {}
                    if (cellAttrs.hMerge === "1" || cellAttrs.vMerge === "1") return { text: "" }

                    const styleParts = getStyleParts(r, c, cells.length)
                    const paragraphs = getValues(cell, "a:txBody", "a:p")
                    const text = paragraphs.map((p) => p.map((n: any) => (n["a:r"] || n["a:fld"] ? String(getValue(n["a:r"] || n["a:fld"], "a:t")[0]?.["#text"] ?? "") : n["a:br"] ? "\n" : "")).join("")).join("\n")

                    const firstRPr = getValues(cell, "a:txBody", "a:p").flatMap((p) => p.filter((n: any) => n["a:r"]).map((n: any) => n["a:r"].find((a: any) => a?.["a:rPr"])))[0]
                    const rPrAttrs = firstRPr?.[":@"] || {}
                    const rPr = firstRPr?.["a:rPr"] || []

                    // fill
                    const tcPr = getValue(cell, "a:tcPr")
                    let background = ""
                    if (!hasChild(tcPr, "a:noFill")) {
                        background = resolveColor(getValue(tcPr, "a:solidFill"), ctx.colors) || ""
                        if (!background) {
                            const styleFills = styleParts.map((part) => (getValue(part, "a:tcStyle", "a:fill", "a:solidFill").length ? getValue(part, "a:tcStyle", "a:fill", "a:solidFill") : getValue(part, "a:tcStyle", "a:fillRef"))).filter((f) => f.length)
                            background = resolveColor(styleFills[styleFills.length - 1], ctx.colors) || ""
                        }
                    }

                    // text color
                    const styleColors = styleParts.map((part) => getValue(part, "a:tcTxStyle")).filter((t) => t.some((n: any) => colorTypes.some((type) => n?.hasOwnProperty(type))))
                    const color = resolveColor(getValue(rPr, "a:solidFill"), ctx.colors) || resolveColor(styleColors[styleColors.length - 1], ctx.colors) || resolveColor(getValue(ctx.colors, "a:tx1"), ctx.colors) || "#000000"

                    const isBold = rPrAttrs.b === "1" || styleParts.some((part) => getAttributes(part, "a:tcTxStyle").b === "on")
                    const fontSize = round((Number(rPrAttrs.sz || 1800) / 100) * (96 / 72) * ctx.scale.factor)
                    const algn = getAttribute(paragraphs[0] || [], "algn", "a:pPr")

                    const typeface =
                        getAttribute(rPr, "typeface", "a:latin") ||
                        styleParts
                            .map((part) => getAttribute(getValue(part, "a:tcTxStyle", "a:font"), "typeface", "a:latin"))
                            .filter(Boolean)
                            .pop() ||
                        ""

                    let style = `color: ${color};font-size: ${fontSize}px;`
                    if (typeface && !typeface.startsWith("+")) style += `font-family: ${typeface}, Calibri;`
                    if (background) style += `background-color: ${background};`
                    if (isBold) style += "font-weight: bold;"
                    if (algn === "l") style += "text-align: left;"
                    else if (algn === "r") style += "text-align: right;"
                    else if (algn === "ctr") style += "text-align: center;"

                    return { text, style }
                })
            }
        })

        return { borderColor, borderWidth, rows: tableRows }
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
    // graphic frames (tables/charts) have their transform directly as p:xfrm
    const xfrm = spPr.length ? getValue(spPr, "a:xfrm") : getValue(psp, "p:xfrm")

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
    const name = Object.keys(node).find((k) => k !== ":@") || ""
    return { name, node: node[name] as Shape, attrs: (node[":@"] || {}) as { [key: string]: string } }
}

type Shape = any[]
type TempShape = {
    id: string
    name: string
    //   tree: 'master' | 'layout' | 'slide'
    node: Shape
    attrs: { [key: string]: string }

    isPlaceholder: boolean
    phType?: string
    phIdx?: string // probably rarely used

    hidden?: boolean

    pos: Position
}
const nvPropKeys = ["p:nvSpPr", "p:nvPicPr", "p:nvCxnSpPr", "p:nvGraphicFramePr", "p:nvGrpSpPr"]
function getTempShape(data: { shape: Shape; transform: GroupTransform | null }): TempShape {
    const shape = getShape(data.shape)
    const nvProps = nvPropKeys.map((key) => getValue(shape.node, key)).find((a) => a.length) || []
    const nvPr = getValue(nvProps, "p:nvPr")
    const isPlaceholder = nvPr.some((n: any) => n?.hasOwnProperty("p:ph"))
    const phType = getAttribute(nvPr, "type", "p:ph")
    const phIdx = getAttribute(nvPr, "idx", "p:ph")

    const pos = getPosition(shape.node)
    if (data.transform) {
        const t = data.transform
        pos.left = round(pos.left * t.sx + t.tx)
        pos.top = round(pos.top * t.sy + t.ty)
        pos.width = round(pos.width * t.sx)
        pos.height = round(pos.height * t.sy)
    }

    return {
        id: findShapeId(shape) || "",
        name: shape.name,
        node: shape.node,
        attrs: shape.attrs,
        isPlaceholder,
        phType,
        phIdx,
        hidden: getAttribute(nvProps, "hidden", "p:cNvPr") === "1",
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

// maps group child coordinates to slide coordinates: x' = x * sx + tx
type GroupTransform = { sx: number; sy: number; tx: number; ty: number }

const validShapes = ["p:sp", "p:pic", "p:cxnSp", "p:graphicFrame"]
function unpackGroups(shapes: Shape[], transform: GroupTransform | null = null): { shape: Shape; transform: GroupTransform | null }[] {
    const out: { shape: Shape; transform: GroupTransform | null }[] = []

    for (const node of shapes) {
        const shape = getShape(node)
        if (shape.name === "p:grpSp") {
            const xfrm = getValue(shape.node, "p:grpSpPr", "a:xfrm")
            const off = getAttributes(xfrm, "a:off")
            const ext = getAttributes(xfrm, "a:ext")
            const chOff = getAttributes(xfrm, "a:chOff")
            const chExt = getAttributes(xfrm, "a:chExt")

            const sx = Number(chExt.cx) ? Number(ext.cx) / Number(chExt.cx) : 1
            const sy = Number(chExt.cy) ? Number(ext.cy) / Number(chExt.cy) : 1
            const tx = emuToPixels(off.x || 0) - emuToPixels(chOff.x || 0) * sx
            const ty = emuToPixels(off.y || 0) - emuToPixels(chOff.y || 0) * sy

            // combine with parent group transform
            const groupTransform = transform ? { sx: sx * transform.sx, sy: sy * transform.sy, tx: tx * transform.sx + transform.tx, ty: ty * transform.sy + transform.ty } : { sx, sy, tx, ty }

            out.push(...unpackGroups(shape.node, groupTransform))
        } else if (validShapes.includes(shape.name)) {
            out.push({ shape: node, transform })
        }
    }

    return out
}

type RenderShape = { name: string; shape: Shape; attrs: { [key: string]: string }; pos: Position; layoutShape: Shape; masterShape: Shape; txStyles: any[]; isDecoration?: boolean; part?: OpcPart }

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

    const slideRender: RenderShape[] = []
    const layoutRender: RenderShape[] = []
    const masterRender: RenderShape[] = []

    for (const s of tempSlideShapes) {
        if (!s.hidden) {
            const matchedLayout = findMatchingPlaceholder(s, tempLayoutShapes)
            const matchedMaster = findMatchingPlaceholder(s, tempMasterShapes) || (matchedLayout ? findMatchingPlaceholder(matchedLayout, tempMasterShapes) : null)
            const effectivePhType = s.phType || matchedLayout?.phType || matchedMaster?.phType || (s.phIdx === "0" ? "title" : s.phIdx === "1" ? "body" : "")

            slideRender.push({
                name: s.name,
                shape: s.node,
                attrs: s.attrs,
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
            layoutRender.push({
                name: s.name,
                shape: s.node,
                attrs: s.attrs,
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
                masterRender.push({ name: s.name, shape: s.node, attrs: s.attrs, pos: s.pos, layoutShape: [], masterShape: [], txStyles: [], isDecoration: true, part: master || undefined })
            }
        }
    }

    // z-order: master (back) -> layout -> slide (front)
    const render = [...masterRender, ...layoutRender, ...slideRender]

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

// shape properties not defined on the shape are taken from the next level
const shapePropertyGroups = [["a:xfrm"], ["a:noFill", "a:solidFill", "a:gradFill", "a:blipFill", "a:pattFill", "a:grpFill"], ["a:ln"], ["a:prstGeom", "a:custGeom"], ["a:effectLst"]]
function mergeShapeProperties(levels: any[][]): any[] {
    const merged = [...(levels[0] || [])]
    for (const level of levels.slice(1)) {
        for (const group of shapePropertyGroups) {
            if (merged.some((n) => group.some((tag) => n?.hasOwnProperty(tag)))) continue
            const node = level.find((n) => group.some((tag) => n?.hasOwnProperty(tag)))
            if (node) merged.push(node)
        }
    }
    return merged
}

// text property levels (paragraph properties / run properties)
type PropLevel = { attrs: { [key: string]: string }; children: any[]; inherited?: boolean }
function toLevel(node: any, key: string): PropLevel | null {
    if (!node?.[key]) return null
    return { attrs: node[":@"] || {}, children: node[key] || [] }
}
function getListLevel(list: any[], lvl: number) {
    if (!Array.isArray(list)) return null
    return toLevel(
        list.find((n: any) => n?.[`a:lvl${lvl}pPr`]),
        `a:lvl${lvl}pPr`
    )
}
function hasChild(children: any[], tag: string) {
    return Array.isArray(children) && children.some((n: any) => n?.hasOwnProperty(tag))
}
function getLevelAttr(levels: PropLevel[], key: string): string {
    const value = levels.map((l) => l.attrs[key]).find((v) => v != null && v !== "")
    return value == null ? "" : String(value)
}
function getLevelChild(levels: PropLevel[], tag: string): any[] {
    return levels.map((l) => getValue(l.children, tag)).find((v) => v.length) || []
}
function getLevelChildAttr(levels: PropLevel[], tag: string, key: string): string {
    return levels.map((l) => getAttribute(l.children, key, tag)).find(Boolean) || ""
}

// common Wingdings/Symbol bullet characters
const symbolBullets: { [key: string]: string } = { "§": "▪", Ø: "➢", ü: "✓", q: "❑", v: "❖", n: "■", l: "●", o: "□", p: "◆", w: "◆", u: "◆", è: "➔", à: "➔", Ö: "➢", "·": "•" }

function getBulletValue(type: string, index: number) {
    if (type.startsWith("arabic")) return formatNumber(type, `${index + 1}`)
    if (type.startsWith("alphaLc")) return formatNumber(type, String.fromCharCode(97 + (index % 26)))
    if (type.startsWith("alphaUc")) return formatNumber(type, String.fromCharCode(65 + (index % 26)))
    if (type.startsWith("romanLc")) return formatNumber(type, toRoman(index + 1).toLowerCase())
    if (type.startsWith("romanUc")) return formatNumber(type, toRoman(index + 1))
    return "•"

    function formatNumber(numType: string, value: string) {
        if (numType.endsWith("ParenBoth")) return `(${value})`
        if (numType.endsWith("ParenR")) return `${value})`
        if (numType.endsWith("Plain")) return value
        return `${value}.`
    }

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

function escapeHtml(text: string) {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

const colorTypes = ["a:srgbClr", "a:schemeClr", "a:sysClr", "a:prstClr", "a:scrgbClr", "a:hslClr"]
const presetColors: { [key: string]: string } = { black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF", yellow: "FFFF00", gray: "808080", ltGray: "D3D3D3", dkGray: "A9A9A9", orange: "FFA500", purple: "800080", cyan: "00FFFF", magenta: "FF00FF" }

// resolve a DrawingML color (any color type + modifiers) to a CSS color
function resolveColor(solidFill: any[], colors: { [key: string]: any }[]): string | null {
    if (!solidFill?.length) return null

    const color = getBaseColor(solidFill, colors)
    if (!color) return ""

    let { r, g, b } = hexToRgb(color.hex)
    let alpha = color.alpha

    for (const mod of color.modifiers) {
        const key = Object.keys(mod || {}).find((k) => k !== ":@")
        const val = Number(mod?.[":@"]?.val || 0) / 100000
        if (!key) continue

        if (key === "a:alpha") alpha = val
        else if (key === "a:alphaMod") alpha *= val
        else if (key === "a:alphaOff") alpha += val
        else if (key === "a:tint") [r, g, b] = [r, g, b].map((c) => c * val + 255 * (1 - val))
        else if (key === "a:shade") [r, g, b] = [r, g, b].map((c) => c * val)
        else if (key === "a:inv") [r, g, b] = [255 - r, 255 - g, 255 - b]
        else if (key === "a:gray") r = g = b = 0.3 * r + 0.59 * g + 0.11 * b
        else if (["a:lumMod", "a:lumOff", "a:satMod", "a:satOff", "a:hueOff", "a:hueMod"].includes(key)) {
            let { h, s, l } = hexToHSL(rgbToHex(r, g, b))
            if (key === "a:lumMod") l *= val
            else if (key === "a:lumOff") l += val * 100
            else if (key === "a:satMod") s *= val
            else if (key === "a:satOff") s += val * 100
            else if (key === "a:hueOff") h += Number(mod[":@"].val) / 60000
            else if (key === "a:hueMod") h *= val
            ;({ r, g, b } = hexToRgb(hslToHex(((h % 360) + 360) % 360, clamp(s, 0, 100), clamp(l, 0, 100))))
        }
    }

    const hex = rgbToHex(r, g, b)
    alpha = clamp(alpha, 0, 1)
    if (alpha >= 1) return hex

    const rgb = hexToRgb(hex)
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${round(alpha)})`
}

function getBaseColor(fill: any[], colors: { [key: string]: any }[], depth = 0): { hex: string; alpha: number; modifiers: any[] } | null {
    const node = fill.find((n) => colorTypes.some((t) => n?.hasOwnProperty(t)))
    if (!node || depth > 5) return null

    const type = colorTypes.find((t) => node.hasOwnProperty(t))!
    const attrs = node[":@"] || {}
    const modifiers: any[] = node[type] || []

    if (type === "a:srgbClr") return { hex: "#" + attrs.val, alpha: 1, modifiers }
    if (type === "a:sysClr") return { hex: "#" + (attrs.lastClr || (attrs.val === "window" ? "FFFFFF" : "000000")), alpha: 1, modifiers }
    if (type === "a:prstClr") return { hex: "#" + (presetColors[attrs.val] || "000000"), alpha: 1, modifiers }
    if (type === "a:scrgbClr") {
        const c = (v: string) => Math.round(Math.min(1, Math.max(0, Number(v || 0) / 100000)) * 255)
        return { hex: rgbToHex(c(attrs.r), c(attrs.g), c(attrs.b)), alpha: 1, modifiers }
    }
    if (type === "a:hslClr") return { hex: hslToHex(Number(attrs.hue || 0) / 60000, Number(attrs.sat || 0) / 1000, Number(attrs.lum || 0) / 1000), alpha: 1, modifiers }

    // scheme color
    let scheme = String(attrs.val || "")
    if (!scheme) return null
    if (!scheme.startsWith("a:")) scheme = "a:" + scheme
    let themeClr = getValue(colors, scheme)
    if (!themeClr.length) {
        const fallback = { "a:tx1": "a:dk1", "a:tx2": "a:dk2", "a:bg1": "a:lt1", "a:bg2": "a:lt2" }[scheme]
        if (fallback) themeClr = getValue(colors, fallback)
    }

    const base = getBaseColor(themeClr, colors, depth + 1)
    if (!base) return null
    return { hex: base.hex, alpha: base.alpha, modifiers: [...base.modifiers, ...modifiers] }
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const rgbToHex = (r: number, g: number, b: number) =>
    "#" +
    [r, g, b]
        .map((c) =>
            Math.round(clamp(c, 0, 255))
                .toString(16)
                .padStart(2, "0")
        )
        .join("")
        .toUpperCase()

function getGradient(gradFill: any[], colors: { [key: string]: any }[]) {
    if (!gradFill?.length) return null
    const stops = getValue(gradFill, "a:gsLst")
        .map((s) => ({ color: resolveColor(s["a:gs"], colors) || "#000", pos: Number(s[":@"]?.pos || 0) / 1000 }))
        .sort((a, b) => a.pos - b.pos)
    return stops.length ? { stops, radial: !!getAttribute(gradFill, "path", "a:path"), angle: Number(getAttribute(gradFill, "ang", "a:lin") || 0) / 60000 } : null
}

function resolveGradient(gradFill: any[], colors: { [key: string]: any }[]) {
    const g = getGradient(gradFill, colors)
    if (!g) return null
    const stops = g.stops.map((s) => `${s.color} ${s.pos}%`).join(", ")
    return g.radial ? `radial-gradient(circle at center, ${stops})` : `linear-gradient(${g.angle + 90}deg, ${stops})`
}

function getSvgGradient(gradFill: any[], colors: { [key: string]: any }[], id: string) {
    const g = getGradient(gradFill, colors)
    if (!g) return ""
    const stops = g.stops.map((s) => `<stop offset="${s.pos}%" stop-color="${s.color}"></stop>`).join("")
    return `<defs><${g.radial ? "radialGradient" : `linearGradient gradientTransform="rotate(${g.angle} 0.5 0.5)"`} id="${id}">${stops}</${g.radial ? "radialGradient" : "linearGradient"}></defs>`
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
