import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Line, Show, Slide } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { checkName } from "../components/helpers/show"
import { activePopup, alertMessage, dictionary, drawerTabsData } from "../stores"
import { createCategory, setTempShows } from "./importHelpers"

export function convertPowerpoint(files: any[]) {
    activePopup.set("alert")
    alertMessage.set("popup.importing")

    // use selected category (or Presentation if no specific is selected)
    let categoryId = get(drawerTabsData).shows?.activeSubTab
    if (categoryId === "all" || categoryId === "unlabeled") categoryId = createCategory("presentation", "presentation", { isDefault: true })

    const tempShows: any[] = []

    setTimeout(() => {
        files.forEach(({ name, content }: any) => {
            console.log(content)

            const presentationData = content["ppt/presentation.xml"]?.["p:presentation"] || {}
            const relations = content["ppt/_rels/presentation.xml.rels"]?.["Relationships"]?.["Relationship"] || []
            const slideOrder = presentationData["p:sldIdLst"]?.[0]["p:sldId"]?.map(a => relations.find(r => r.$.Id === a.$?.["r:id"])?.$?.Target)

            // sort by number in name to ensure correct slide order (ppt/slides/slide1.xml)
            // const slideKeys = sortByNameNumber(Object.keys(content).filter((a) => a.includes("ppt/slides/slide")))

            // load font faces
            const contentPaths = content["contentPaths"] || {}
            // loadAllFonts(contentPaths)
            const fonts = getAllFontNames(contentPaths)

            const slides = slideOrder.map((key) => convertSlide("ppt/" + key, content))
            if (!slides.length) {
                alertMessage.set('This format is unsupported, try using an online "PPT to TXT converter".')
                return
            }

            // create show
            const layoutID = uid()
            const show: Show = new ShowObj(false, categoryId, layoutID, 0, false)
            show.name = checkName(name)
            show.origin = "powerpoint"
            show.settings.customFonts = fonts

            const meta: any = content["docProps/core.xml"]?.["cp:coreProperties"]
            if (meta) {
                show.meta = {
                    title: meta["dc:title"]?.[0] || show.name,
                    artist: meta["dc:creator"]?.[0] || ""
                }
                show.timestamps = {
                    created: new Date(meta["dcterms:created"]?.[0]?._ || 0).getTime(),
                    modified: new Date(meta["dcterms:modified"]?.[0]?._ || 0).getTime(),
                    used: null
                }
            }

            const { slidesObj, layouts } = createSlides(slides)
            show.slides = slidesObj
            show.layouts = { [layoutID]: { name: get(dictionary).example?.default || "", notes: "", slides: layouts } }

            tempShows.push({ id: uid(), show })
        })

        setTempShows(tempShows)
    }, 10)
}

function getAllFontNames(contentPaths: Record<string, string>) {
    const fontNames: { name: string; path: string }[] = []
    Object.keys(contentPaths).forEach(key => {
        if (key.startsWith("ppt/fonts/") && key.endsWith(".fntdata")) {
            const fileName = key.slice(key.lastIndexOf("/") + 1)
            const match = fileName.match(/^(.+?)-?(regular|bold|italic|boldItalic)?\.fntdata$/i)
            if (match) {
                fontNames.push({ name: match[1], path: contentPaths[key] })
            }
        }
    })
    return fontNames
}

function createSlides(slides: { items: Item[]; bg: string }[]) {
    const slidesObj: { [key: string]: Slide } = {}
    const layouts: any[] = []

    const parentId: string = uid()
    layouts.push({ id: parentId })
    slidesObj[parentId] = {
        group: ".",
        color: null,
        settings: { color: slides[0].bg || "" },
        notes: "",
        items: slides[0].items
    }

    slidesObj[parentId].children = slides.slice(1).map(({ items, bg }: { items: Item[]; bg: string }) => {
        const id: string = uid()
        slidesObj[id] = { group: null, color: null, settings: { color: bg || "" }, notes: "", items }
        return id
    })

    return { slidesObj, layouts }
}

// extract number from ppt/slides/slide1.xml
export function sortByNameNumber(array: string[]) {
    return array.sort((a, b) => {
        // get numbers in name
        const matchA = a.match(/\d+/)
        const matchB = b.match(/\d+/)
        const numA = matchA ? parseInt(matchA[0], 10) : Infinity
        const numB = matchB ? parseInt(matchB[0], 10) : Infinity

        if (numA !== numB) return numA - numB

        return a.localeCompare(b)
    })
}

// TODO:
// font size/family
// videos/audio
// themes
// shapes
// notes

type PlaceholderItem = (Item & { placeholder?: { type: string; idx?: string } })

function convertSlide(key: string, content: any) {
    const slideContent = content[key]

    const slideNumber = key.slice(key.lastIndexOf("slide"))
    const slideRelations = getRelations(content, `ppt/slides/_rels/${slideNumber}.rels`)

    let clrSchemes = {}

    let layoutItems: PlaceholderItem[] = []
    let masterItems: PlaceholderItem[] = []
    let layoutItemsRaw: any = []
    let masterItemsRaw: any = []
    let bgColorValue = ""

    // slide layout
    const slideLayouts = slideRelations.filter(a => a.$.Target.includes("slideLayout")).map(a => a.$.Target)
    for (const layoutId of slideLayouts) {
        const layout = content[layoutId.replace("..", "ppt")]

        const layoutNumber = layoutId.slice(layoutId.lastIndexOf("slideLayout"))
        const layoutRelations = getRelations(content, `ppt/slideLayouts/_rels/${layoutNumber}.rels`)

        // master
        const slideMasterId = layoutRelations.filter(a => a.$.Target.includes("slideMaster")).map(a => a.$.Target)[0] || ""
        const master = content[slideMasterId.replace("..", "ppt")]?.["p:sldMaster"] || {}

        const masterNumber = slideMasterId.slice(slideMasterId.lastIndexOf("slideMaster"))
        const masterRelations = getRelations(content, `ppt/slideMasters/_rels/${masterNumber}.rels`)

        // ---- theme bg ----
        const bgSchemeId = master["p:cSld"]?.[0]?.["p:bg"]?.[0]?.["p:bgPr"]?.[0]?.["a:solidFill"]?.[0]?.["a:schemeClr"]?.[0]?.$?.val
        const themeTarget = masterRelations.find(r => r.$.Target.includes("/theme/"))?.$.Target
        if (themeTarget) {
            const theme = content[themeTarget.replace("..", "ppt")]?.["a:theme"]?.["a:themeElements"]?.[0] || {}
            clrSchemes = theme["a:clrScheme"]?.[0]
            bgColorValue = resolveColor(bgSchemeId, clrSchemes) || ""
        }

        layoutItemsRaw = layout?.["p:cSld"]?.[0]?.["p:spTree"]?.[0]?.["p:sp"] || []
        masterItemsRaw = master?.["p:cSld"]?.[0]?.["p:spTree"]?.[0]?.["p:sp"] || []
        layoutItems = convertItems(layout?.["p:sldLayout"], layoutRelations, content, clrSchemes)
        // masterItems = convertItems(master, [], content, clrSchemes)
    }

    const slideItems: PlaceholderItem[] = convertItems(slideContent?.["p:sld"], slideRelations, content, clrSchemes, layoutItemsRaw, masterItemsRaw)

    const mergedItems = mergeItems(slideItems, layoutItems, masterItems)

    return { items: mergedItems, bg: bgColorValue }
}

function getRelations(content: any, path: string) {
    return content[path]?.Relationships?.Relationship || []
}

function mergeItems(slideItems: PlaceholderItem[], layoutItems: PlaceholderItem[], masterItems: PlaceholderItem[]) {
    const items: Item[] = []

    // decorative shapes
    const decorativeCandidates = [...layoutItems, ...masterItems].filter(i => !i.placeholder)
    items.push(...decorativeCandidates)

    // slide items
    items.push(...slideItems)

    // inherit placeholders from layout/master if not overridden
    // const usedPlaceholders = new Set(slideItems.filter(i => i.placeholder).map(i => i.placeholder!.type + ":" + (i.placeholder!.idx || "")))
    // const placeholderCandidates = [...layoutItems, ...masterItems].filter(i => i.placeholder)
    // for (const item of placeholderCandidates) {
    //     const key = item.placeholder!.type + ":" + (item.placeholder!.idx || "")
    //     if (!usedPlaceholders.has(key)) items.push(item)
    // }

    return items
}

function resolveColor(colorNode, clrSchemes) {
    if (!colorNode) return null
    const scheme = typeof colorNode === "string" ? colorNode : colorNode["a:schemeClr"]?.[0].$.val
    let hex = ""
    if (scheme) {
        hex = "#" + clrSchemes["a:" + scheme]?.[0]["a:srgbClr"]?.[0].$?.val
    }
    if (colorNode["a:srgbClr"]) {
        hex = "#" + colorNode["a:srgbClr"][0].$.val
    }

    // const alpha = colorNode["a:schemeClr"]?.[0]["a:alpha"]?.[0].$.val
    // if (alpha) {
    //     const rgb = hexToRgb(hex)
    //     console.log(parseInt(alpha, 10) / 100000)
    //     return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${parseInt(alpha, 10) / 100000})`
    // }

    return hex
}

function convertItems(slideContent, relations, content, clrSchemes, layoutItems = {}, masterItems = {}) {
    const slideTree = slideContent?.["p:cSld"]?.[0]["p:spTree"]?.[0] || {}
    return extractItemsFromTree(slideTree, relations, content, clrSchemes, layoutItems, masterItems)
}

function extractItemsFromTree(slideTree, relations, content, clrSchemes, layoutItems, masterItems) {
    const convertedItems: PlaceholderItem[] = []

    const contentPaths = content["contentPaths"] || {}

    const textItems = slideTree["p:sp"] || []
    const imageItems = slideTree["p:pic"] || []
    // const tableItems = slideTree["p:graphicFrame"] || [] // often contains tables/charts
    const lineItems = slideTree["p:cxnSp"] || [] // connectors/lines
    const groupItems = slideTree["p:grpSp"] || []

    // ---------- TEXT ----------
    for (const textItem of textItems) {
        const body = textItem["p:txBody"]?.[0]
        const placeholder = textItem["p:nvSpPr"]?.[0]["p:nvPr"]?.[0]["p:ph"]?.[0].$

        const svg = pptShapeToNormalizedSvg(textItem, clrSchemes)

        if (svg) {
            // console.log(textItem, svg)

            let item: PlaceholderItem = { placeholder, style: getItemStyle(textItem), align: getItemAlign(body), type: "icon", decoration: true, customSvg: svg }
            convertedItems.push(item)
            continue
        }

        if (body) {
            const paragraphs = body["a:p"] || []

            let lines: Line[] = []
            for (const paragraph of paragraphs) {
                let line = paragraphToLine(paragraph, placeholder, layoutItems, masterItems, clrSchemes)

                // split each text[] into line[] if there are line breaks
                const lineBreaks = paragraph["a:br"] || []
                if (lineBreaks.length) {
                    line.text.forEach(a => {
                        lines.push({ ...line, text: [a] })
                    })
                }

                lines.push(line)
            }

            let item: PlaceholderItem = { placeholder, style: getItemStyle(textItem) + "padding: 20px;", align: getItemAlign(body), type: "text", lines }

            // const bulletStyle = paragraphs[0]?.["a:pPr"]?.[0]["a:buChar"]?.[0].$?.char || ""
            // if (bulletStyle) {
            //     item.list = {enabled: true}
            // }

            convertedItems.push(item)
        } else {
            // shape without text → treat as a shape (freeform line shape / boxes without text)
            convertedItems.push({
                style: getItemStyle(textItem),
                type: "text",
                placeholder
            })
        }
    }

    // ---------- IMAGES ----------
    for (const imageItem of imageItems) {
        const relationId: string = imageItem["p:blipFill"]?.[0]["a:blip"]?.[0].$?.["r:embed"] || ""
        const imageId = relations.find(a => a.$.Id === relationId)?.$?.Target || ""
        const filePath = contentPaths[imageId.replace("..", "ppt")] || ""

        // const imageTitle: string = imageItem["p:nvPicPr"]?.[0]["p:cNvPr"]?.[0].$?.title || ""

        const placeholder = imageItem["p:nvSpPr"]?.[0]["p:nvPr"]?.[0]["p:ph"]?.[0]?.$
        convertedItems.push({ placeholder, style: getItemStyle(imageItem), type: "media", src: filePath })
    }

    // ---------- TABLES ----------
    // for (const tableItem of tableItems) {
    //     const graphicData = tableItem["a:graphic"]?.[0]["a:graphicData"]?.[0] || {}
    //     if (graphicData["a:tbl"]) {
    //         const rows = graphicData["a:tbl"][0]["a:tr"] || []
    //         const table: string[][] = rows.map(row => {
    //             const cells = row["a:tc"] || []
    //             return cells.map(cell => {
    //                 const paragraphs = cell["a:txBody"]?.[0]["a:p"] || []
    //                 return paragraphs.map(p => {
    //                     return (p["a:r"] || []).map(r => r["a:t"]?.[0] || "").join("")
    //                 }).join("\n")
    //             })
    //         })

    //         convertedItems.push({ 
    //             style: getItemStyle(tableItem), 
    //             type: "table", 
    //             table 
    //         })
    //     }
    // }

    // ---------- LINES ----------
    for (const lineItem of lineItems) {
        convertedItems.push({
            style: getItemStyle(lineItem),
            type: "text"
        })
    }

    // ---------- GROUP SHAPES ----------
    for (const grp of groupItems) {
        // recursively extract shapes
        const childTree = {
            "p:sp": grp["p:sp"] || [],
            "p:pic": grp["p:pic"] || [],
            "p:cxnSp": grp["p:cxnSp"] || [],
            "p:grpSp": grp["p:grpSp"] || []
        }
        convertedItems.push(...extractItemsFromTree(childTree, relations, content, clrSchemes, layoutItems, masterItems))
    }

    return convertedItems
}

function getItemStyle(item: any) {
    const pos = item["p:spPr"]?.[0]["a:xfrm"]?.[0]
    if (!pos) return DEFAULT_ITEM_STYLE

    const ext = pos["a:ext"]?.[0].$
    const off = pos["a:off"]?.[0].$
    const rot = parseFloat(pos.$?.rot || "0") / 60000 // convert 60,000ths of a degree to degrees
    const flipH = pos.$?.flipH === "1" ? "scaleX(-1)" : ""
    const flipV = pos.$?.flipV === "1" ? "scaleY(-1)" : ""

    const { left, top, width, height } = emuToPixels({ x: off.x, y: off.y, cx: ext.cx, cy: ext.cy })

    let rotate = rot === 0 ? "" : `rotate(${rot}deg)`

    let transform = ""
    if (flipH || flipV || rotate) transform = `transform: ${flipH} ${flipV} ${rotate};`

    return `inset-inline-start:${left}px;top:${top}px;width:${width}px;height:${height}px;${transform}`
}

function getItemAlign(itemBody: any) {
    const style = itemBody["a:bodyPr"]?.[0].$ || {}
    if (style.anchor === "t") return "align-items: flex-start;"
    if (style.anchor === "b") return "align-items: flex-end;"
    return ""
}

function emuToPixels({ x = 0, y = 0, cx = 0, cy = 0 }, slideWidth = 1920, slideHeight = 1080) {
    // PowerPoint default slide size in EMUs (10in × 5.625in at 914400 EMU/inch)
    // ppt/presentation.xml / p:presentation / p:sldSz / cx/cy
    const EMU_WIDTH = 9144000
    const EMU_HEIGHT = 5143500

    return {
        left: Math.round((x / EMU_WIDTH) * slideWidth),
        top: Math.round((y / EMU_HEIGHT) * slideHeight),
        width: Math.round((cx / EMU_WIDTH) * slideWidth),
        height: Math.round((cy / EMU_HEIGHT) * slideHeight),
    }
}

function paragraphToLine(paragraph, placeholder, layoutItems, masterItems, clrSchemes) {
    const lineStyle = paragraph["a:pPr"]?.[0] || {}
    const align = getAlignment(lineStyle.$?.algn || "")

    const line: Line = { align, text: [] }

    const bulletStyle = lineStyle["a:buChar"]?.[0].$?.char || ""
    const bulletSize = parseInt(lineStyle["a:buSzPts"]?.[0].$?.val || "1000", 10) / 100

    const textRuns = paragraph["a:r"] || []
    textRuns.forEach((textRun: any) => {
        let style = textRun["a:rPr"]?.[0] || {}
        let value = (textRun["a:t"]?.[0] || "")
        // if (bulletStyle) value = `${bulletStyle} ${value}`
        const textStyle = getTextStyle(style, placeholder, layoutItems, masterItems, clrSchemes)
        if (bulletStyle) line.text.push({ style: `${textStyle}font-size: ${ptToPx(bulletSize)}px;`, value: `&nbsp;&nbsp;${bulletStyle}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;` })
        line.text.push({ style: textStyle, value })
    })

    return line
}

function normalizePlaceholderType(type?: string): string | undefined {
    if (!type) return undefined
    if (type === "ctrTitle") return "title"
    if (type === "subTitle" || type === "obj") return "body"
    return type
}
function getTextStyle(rPr: any, placeholder: any, layoutItems: any[], masterItems: any[], clrSchemes: any) {
    placeholder = { ...placeholder, type: normalizePlaceholderType(placeholder?.type) }

    let style = "text-shadow: 0px 0px 0px #000000;line-height: 1.35em;"

    // ---------- Bold / Italic / Underline ----------
    if (rPr?.$?.b === "1") style += "font-weight: bold;"
    if (rPr?.$?.i === "1") style += "font-style: italic;"
    if (rPr?.$?.u === "sng") style += "text-decoration: underline;"

    // ---------- Font size ----------
    let fontSize = rPr?.$?.sz || getInheritedProperty("sz", placeholder, layoutItems, masterItems)
    if (fontSize) {
        let fontSizePt = parseInt(fontSize, 10) / 100 // PowerPoint stores sz in 1/100th pt
        let fontSizePx = ptToPx(fontSizePt)
        style += `font-size: ${fontSizePx}px;`
        // style += `font-size: ${parseInt(fontSize, 10) / 100}pt;`
    }

    // ---------- Font family ----------
    let fontFamily = rPr?.$?.latin || getInheritedProperty("latin", placeholder, layoutItems, masterItems)
    if (fontFamily) {
        style += `font-family: '${fontFamily}';`
    }

    // ---------- Color ----------
    let color = resolveColor(rPr?.["a:solidFill"]?.[0] || getInheritedProperty("color", placeholder, layoutItems, masterItems), clrSchemes)
    if (color) style += `color: ${color};`

    return style
}

// Helper to walk the hierarchy for a property
function getInheritedProperty(prop: string, placeholder: any, layoutItemsRaw: any[], masterItemsRaw: any[]) {
    // 1. Check placeholder overrides
    if (placeholder?.[prop]) return placeholder[prop]

    // Helper to check a single item
    const getFromItem = (item: any) => {
        const body = item["p:txBody"]?.[0]
        // Check paragraph properties
        const pPr = body?.["a:p"]?.[0]?.["a:pPr"]?.[0]
        if (pPr?.$?.[prop]) return pPr.$[prop]

        // Check bullet/level default properties
        const lstStyle = body?.["a:lstStyle"]?.[0]
        if (lstStyle) {
            for (const lvl of Object.values<any>(lstStyle)) { // a:lvl1pPr, a:lvl2pPr, etc
                const defRPr = lvl[0]?.["a:defRPr"]?.[0]
                if (defRPr) {
                    if (prop === "sz" && defRPr.$?.sz) return defRPr.$.sz
                    if (prop === "latin" && defRPr["a:latin"]?.[0]?.$?.typeface) return defRPr["a:latin"][0].$.typeface
                    if (prop === "color" && defRPr["a:solidFill"]?.[0]) return defRPr["a:solidFill"][0]
                }
            }
        }
        return null
    }

    // 2. Check layout items
    for (const item of layoutItemsRaw) {
        const itemPlaceholder = item["p:nvSpPr"]?.[0]["p:nvPr"]?.[0]["p:ph"]?.[0]?.$
        if (itemPlaceholder?.type === placeholder?.type) {
            const val = getFromItem(item)
            if (val) return val
        }
    }

    // 3. Check master items
    for (const item of masterItemsRaw) {
        const itemPlaceholder = item["p:nvSpPr"]?.[0]["p:nvPr"]?.[0]["p:ph"]?.[0]?.$
        if (itemPlaceholder?.type === placeholder?.type) {
            const val = getFromItem(item)
            if (val) return val
        }
    }

    return null
}

function ptToPx(pt: number): number {
    const px = Math.round(pt * 96 / 72) // 1pt = 1.333px
    return px * 2 // convert to FS size
}

function getAlignment(algn: string) {
    if (algn === "l") return "text-align: left;"
    if (algn === "r") return "text-align: right;"
    return ""
}

// SVG

function pptShapeToNormalizedSvg(shape, clrSchemes) {
    const spPr = shape['p:spPr'][0]
    const prstGeom = spPr["a:prstGeom"]?.[0]?.$?.prst
    if (!prstGeom || prstGeom === "rect") return null

    const xfrm = spPr['a:xfrm'][0]
    const off = xfrm['a:off'][0].$
    const ext = xfrm['a:ext'][0].$

    // Fill color and opacity
    let fill = resolveColor(spPr['a:solidFill']?.[0], clrSchemes) || "#000"
    let fillOpacity = 1
    const schemeClr = spPr['a:solidFill']?.[0]?.['a:schemeClr']?.[0]
    if (schemeClr?.['a:alpha']?.[0]?.$?.val) {
        fillOpacity = parseInt(schemeClr['a:alpha'][0].$.val, 10) / 100000
    }

    // Bounding box
    const x1 = parseFloat(off.x)
    const y1 = parseFloat(off.y)
    const width = parseFloat(ext.cx)
    const height = parseFloat(ext.cy)

    const normalizeX = (x) => (x - x1) / width
    const normalizeY = (y) => (y - y1) / height

    // Get adjustment value (default 50000 if missing)
    let adj = 50000
    const avLst = spPr['a:prstGeom'][0]['a:avLst']?.[0]
    if (avLst && avLst['a:gd']) {
        const valStr = avLst['a:gd'][0]?.$?.fmla
        if (valStr && valStr.startsWith("val")) {
            adj = parseFloat(valStr.split(" ")[1])
        }
    }

    let points: any[] = []

    // diagStripe formula (example)
    if (prstGeom === "diagStripe") {
        const a = adj / 100000
        points = [
            { x: x1 + width * a, y: y1 },       // top middle
            { x: x1 + width, y: y1 },             // top right
            { x: x1, y: y1 + height },            // bottom left
            { x: x1, y: y1 + height * a }         // bottom left adjusted
        ]
    }

    // Add more shapes here later (diamond, trapezoid, star, etc.)
    else {
        // fallback: rectangle corners
        points = [
            { x: x1, y: y1 },
            { x: x1 + width, y: y1 },
            { x: x1 + width, y: y1 + height },
            { x: x1, y: y1 + height }
        ]
    }

    // Normalize points
    const path = points.map((p, i) => {
        const cmd = i === 0 ? "M" : "L"
        return `${cmd} ${normalizeX(p.x)} ${normalizeY(p.y)}`
    }).join(' ') + ' Z'

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">
    <path fill="${fill}" fill-opacity="${fillOpacity}" d="${path}"></path>
</svg>`
}



///

// // --- Parse preset shapes into path data ---
// function parsePrstGeom(prst: string, avLst: any[]): { d: string; w: number; h: number } {
//     const W = 100000, H = 100000
//     switch (prst) {
//         case "rect":
//             return { d: `M0,0 L${W},0 L${W},${H} L0,${H} Z`, w: W, h: H }
//         case "ellipse":
//             return { d: `M${W / 2},0 A${W / 2},${H / 2} 0 1,0 ${W / 2},${H} A${W / 2},${H / 2} 0 1,0 ${W / 2},0 Z`, w: W, h: H }
//         case "triangle":
//             return { d: `M${W / 2},0 L${W},${H} L0,${H} Z`, w: W, h: H }
//         case "diamond":
//             return { d: `M${W / 2},0 L${W},${H / 2} L${W / 2},${H} L0,${H / 2} Z`, w: W, h: H }
//         case "diagStripe": {
//             const adj = avLst?.find(g => g["a:gd"]?.[0]?.$?.name === "adj")?.["a:gd"]?.[0]?.$?.fmla || "val 50000"
//             const val = parseInt(adj.replace("val ", "")) || 50000
//             const y = (val / 100000) * H
//             return { d: `M0,0 L${W},${y} L${W},${H} L0,${H} Z`, w: W, h: H }
//         }
//         default:
//             return { d: "", w: W, h: H }
//     }
// }