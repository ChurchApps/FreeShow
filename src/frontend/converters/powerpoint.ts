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
            const slideOrder = presentationData["p:sldIdLst"]?.[0]["p:sldId"]?.map(a => relations.find(r => r["$"].Id === a["$"]?.["r:id"])?.["$"]?.Target)

            // sort by number in name to ensure correct slide order (ppt/slides/slide1.xml)
            // const slideKeys = sortByNameNumber(Object.keys(content).filter((a) => a.includes("ppt/slides/slide")))

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
    let bgColorValue = ""

    // slide layout
    const slideLayouts = slideRelations.filter(a => a["$"].Target.includes("slideLayout")).map(a => a["$"].Target)
    for (const layoutId of slideLayouts) {
        const layout = content[layoutId.replace("..", "ppt")]

        const layoutNumber = layoutId.slice(layoutId.lastIndexOf("slideLayout"))
        const layoutRelations = getRelations(content, `ppt/slideLayouts/_rels/${layoutNumber}.rels`)

        // master
        const slideMasterId = layoutRelations.filter(a => a["$"].Target.includes("slideMaster")).map(a => a["$"].Target)[0] || ""
        const master = content[slideMasterId.replace("..", "ppt")]?.["p:sldMaster"] || {}

        const masterNumber = slideMasterId.slice(slideMasterId.lastIndexOf("slideMaster"))
        const masterRelations = getRelations(content, `ppt/slideMasters/_rels/${masterNumber}.rels`)

        // ---- theme bg ----
        const bgSchemeId = master["p:cSld"]?.[0]?.["p:bg"]?.[0]?.["p:bgPr"]?.[0]?.["a:solidFill"]?.[0]?.["a:schemeClr"]?.[0]?.["$"]?.val
        const themeTarget = masterRelations.find(r => r["$"].Target.includes("/theme/"))?.["$"].Target
        if (themeTarget) {
            const theme = content[themeTarget.replace("..", "ppt")]?.["a:theme"]?.["a:themeElements"]?.[0] || {}
            clrSchemes = theme["a:clrScheme"]?.[0]
            bgColorValue = resolveColor(bgSchemeId, clrSchemes) || ""
        }

        layoutItems = convertItems(layout?.["p:sldLayout"], layoutRelations, content, clrSchemes)
        // masterItems = convertItems(master, [], content, clrSchemes)
    }

    const slideItems: PlaceholderItem[] = convertItems(slideContent?.["p:sld"], slideRelations, content, clrSchemes)

    const mergedItems = mergeItems(slideItems, layoutItems, masterItems)

    return { items: mergedItems, bg: bgColorValue }
}

function getRelations(content: any, path: string) {
    return content[path]?.Relationships?.Relationship || []
}

function mergeItems(slideItems: PlaceholderItem[], layoutItems: PlaceholderItem[], masterItems: PlaceholderItem[]) {
    const items: Item[] = []

    const usedPlaceholders = new Set(
        slideItems.filter(i => i.placeholder).map(i => i.placeholder!.type + ":" + (i.placeholder!.idx || ""))
    )

    // 1. Always use slide items
    items.push(...slideItems)

    // 2. Inherit placeholders from layout/master if not overridden
    const placeholderCandidates = [...layoutItems, ...masterItems].filter(i => i.placeholder)
    for (const item of placeholderCandidates) {
        const key = item.placeholder!.type + ":" + (item.placeholder!.idx || "")
        if (!usedPlaceholders.has(key)) items.push(item)
    }

    // optionally include decorative shapes
    // WIP
    const decorativeCandidates = [...layoutItems, ...masterItems].filter(i => !i.placeholder)
    items.push(...decorativeCandidates)

    return items
}

function resolveColor(colorNode, clrSchemes) {
    if (!colorNode) return null
    const scheme = typeof colorNode === "string" ? colorNode : colorNode["a:schemeClr"]?.[0]["$"].val
    if (scheme) {
        return "#" + clrSchemes["a:" + scheme]?.[0]["a:srgbClr"]?.[0]["$"]?.val
    }
    if (colorNode["a:srgbClr"]) {
        return "#" + colorNode["a:srgbClr"][0]["$"].val
    }
    return null
}

function convertItems(slideContent, relations, content, clrSchemes) {
    const slideTree = slideContent?.["p:cSld"]?.[0]["p:spTree"]?.[0] || {}
    return extractItemsFromTree(slideTree, relations, content, clrSchemes)
}

function extractItemsFromTree(slideTree, relations, content, clrSchemes) {
    const convertedItems: PlaceholderItem[] = []

    const textItems = slideTree["p:sp"] || []
    const imageItems = slideTree["p:pic"] || []
    // const tableItems = slideTree["p:graphicFrame"] || [] // often contains tables/charts
    const shapeItems = slideTree["p:cxnSp"] || [] // connectors/lines
    const groupItems = slideTree["p:grpSp"] || []

    // ---------- TEXT ----------
    for (const textItem of textItems) {
        const body = textItem["p:txBody"][0]
        const placeholder = textItem["p:nvSpPr"]?.[0]["p:nvPr"]?.[0]["p:ph"]?.[0]["$"]

        const spPr = textItem["p:spPr"]?.[0]
        const { type, svg } = extractShapePath(spPr, clrSchemes)

        if (type === "svg") {
            let item: PlaceholderItem = { placeholder, style: getItemStyle(textItem), align: getItemAlign(body), type: "icon", customSvg: svg }
            convertedItems.push(item)
            continue
        }

        if (body) {
            const paragraphs = body["a:p"] || []

            let lines: Line[] = []
            for (const paragraph of paragraphs) {
                let line = paragraphToLine(paragraph, clrSchemes)

                // split each text[] into line[] if there are line breaks
                const lineBreaks = paragraph["a:br"] || []
                if (lineBreaks.length) {
                    line.text.forEach(a => {
                        lines.push({ ...line, text: [a] })
                    })
                }

                lines.push(line)
            }

            let item: PlaceholderItem = { placeholder, style: getItemStyle(textItem), align: getItemAlign(body), type: "text", lines }

            // const bulletStyle = paragraphs[0]?.["a:pPr"]?.[0]["a:buChar"]?.[0]["$"]?.char || ""
            // if (bulletStyle) {
            //     item.list = {enabled: true}
            // }

            convertedItems.push(item)
        } else {
            // WIP unused?
            // shape without text → treat as a shape
            convertedItems.push({
                style: getItemStyle(textItem),
                type: "text",
                placeholder
            })
        }
    }

    // ---------- IMAGES ----------
    for (const imageItem of imageItems) {
        const relationId: string = imageItem["p:blipFill"]?.[0]["a:blip"]?.[0]["$"]?.["r:embed"] || ""
        const imageId = relations.find(a => a["$"].Id === relationId)?.["$"]?.Target || ""
        const filePath = content["mediaPaths"]?.[imageId.replace("..", "ppt")] || ""

        // const imageTitle: string = imageItem["p:nvPicPr"]?.[0]["p:cNvPr"]?.[0]["$"]?.title || ""

        const placeholder = imageItem["p:nvSpPr"]?.[0]["p:nvPr"]?.[0]["p:ph"]?.[0]?.["$"]
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

    // ---------- SHAPES / LINES ----------
    // WIP
    for (const shapeItem of shapeItems) {
        convertedItems.push({
            style: getItemStyle(shapeItem),
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
        convertedItems.push(...extractItemsFromTree(childTree, relations, content, clrSchemes))
    }

    return convertedItems
}

function getItemStyle(item: any) {
    const pos = item["p:spPr"]?.[0]["a:xfrm"]?.[0]
    if (!pos) return DEFAULT_ITEM_STYLE

    const ext = pos["a:ext"]?.[0]["$"]
    const off = pos["a:off"]?.[0]["$"]
    const rot = parseFloat(pos["$"]?.rot || "0") / 60000 // convert 60,000ths of a degree to degrees

    const { left, top, width, height } = emuToPixels({ x: off.x, y: off.y, cx: ext.cx, cy: ext.cy })


    // CSS transform for rotation
    let transform = ""
    if (rot !== 0) {
        // rotate around the center of the shape
        const cx = left + width / 2
        const cy = top + height / 2
        transform = `transform-origin: ${cx}px ${cy}px; transform: rotate(${rot}deg);`
    }

    return `inset-inline-start:${left}px;top:${top}px;width:${width}px;height:${height}px;${transform}`
}

function getItemAlign(itemBody: any) {
    const style = itemBody["a:bodyPr"]?.[0]["$"] || {}
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

function paragraphToLine(paragraph, clrSchemes) {
    const lineStyle = paragraph["a:pPr"]?.[0] || {}
    const align = getAlignment(lineStyle["$"]?.algn || "")

    const line: Line = { align, text: [] }

    const bulletStyle = lineStyle["a:buChar"]?.[0]["$"]?.char || ""

    const textRuns = paragraph["a:r"] || []
    textRuns.forEach((textRun: any) => {
        let style = textRun["a:rPr"]?.[0] || {}
        let value = (textRun["a:t"]?.[0] || "")
        if (bulletStyle) value = `${bulletStyle} ${value}`
        line.text.push({ style: getTextStyle(style, clrSchemes), value })
    })

    return line
}

function getTextStyle(rPr: any, clrSchemes) {
    let style = ""
    if (rPr["$"]?.b === "1") style += "font-weight: bold;"
    if (rPr["$"]?.i === "1") style += "font-style: italic;"
    if (rPr["$"]?.u === "sng") style += "text-decoration: underline;"

    const color = resolveColor(rPr["a:solidFill"]?.[0], clrSchemes)
    if (color) style += `color: ${color};`
    return style
}

function getAlignment(algn: string) {
    if (algn === "l") return "text-align: left;"
    if (algn === "r") return "text-align: right;"
    return ""
}

// SVG (not tested)

function pathToHTMLSvg(pathStr: string, fillColor?: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">
    <path d="${pathStr}" fill="${fillColor}" />
  </svg>`
}

function extractShapePath(spPr: any, clrSchemes): { type: string; svg?: string } {
    if (!spPr) return { type: "shape" }

    // --- Custom geometry ---
    const custGeom = spPr["a:custGeom"]?.[0]
    if (custGeom) {
        const svgPath = extractCustGeomPath(custGeom)
        return { type: "svg", svg: pathToHTMLSvg(svgPath) }
    }

    // --- Preset geometry ---
    const prstGeom = spPr["a:prstGeom"]?.[0]?.["$"]?.prst
    if (prstGeom) {
        if (prstGeom === "diagStripe") {
            const pathStr = prstGeomToPath(prstGeom, spPr["a:prstGeom"]?.[0]?.["a:avLst"])
            const fill = spPr["a:solidFill"]?.[0]
            const color = resolveColor(fill, clrSchemes) || "#000"
            return { type: "svg", svg: pathToHTMLSvg(pathStr, color) }
        }
        // Map common prstGeom names to simple SVG paths
        const presetMap: Record<string, string> = {
            rect: "M0,0 L100,0 L100,100 L0,100 Z",
            roundRect: "M10,0 L90,0 Q100,0 100,10 L100,90 Q100,100 90,100 L10,100 Q0,100 0,90 L0,10 Q0,0 10,0 Z",
            ellipse: "M50,0 A50,50 0 1,0 50,100 A50,50 0 1,0 50,0 Z",
            triangle: "M50,0 L100,100 L0,100 Z",
            diamond: "M50,0 L100,50 L50,100 L0,50 Z",
            // add more mappings as needed
        }
        const svgPath = presetMap[prstGeom] || ""
        if (prstGeom === "rect") return { type: "shape" }
        return svgPath ? { type: "svg", svg: pathToHTMLSvg(svgPath) } : { type: "shape" }
    }

    return { type: "shape" }
}

function prstGeomToPath(prst: string, avLst: any[]): string {
    switch (prst) {
        case "rect": return "M0,0 L1,0 L1,1 L0,1 Z"
        case "ellipse": return "M0.5,0 A0.5,0.5 0 1,0 0.5,1 A0.5,0.5 0 1,0 0.5,0 Z"
        case "diagStripe":
            const adj = avLst?.find(g => g["a:gd"]?.[0]?.["$"]?.name === "adj")?.["a:gd"]?.[0]?.["$"]?.fmla || "val 50000"
            const val = parseInt(adj.replace("val ", "")) || 50000
            const y = val / 100000 // 0–1
            return `M0,0 L1,${y} L1,1 L0,1 Z`
        // add other presets
    }
    return ""
}

// helper for extracting custom geometry paths
function extractCustGeomPath(custGeom: any): string {
    if (!custGeom) return ""

    //   const avLst = custGeom["a:avLst"]?.[0] || {}
    const pathElems = custGeom["a:pathLst"]?.[0]?.["a:path"] || []

    const commands: string[] = []

    for (const path of pathElems) {
        const pathSteps = path["a:moveTo"] || []
        // moveTo is usually the first element
        for (const step of pathSteps) {
            const pt = step["a:pt"]?.[0]?.["$"]
            if (pt) commands.push(`M${pt.x},${pt.y}`)
        }

        const lnTo = path["a:lnTo"] || []
        for (const step of lnTo) {
            const pt = step["a:pt"]?.[0]?.["$"]
            if (pt) commands.push(`L${pt.x},${pt.y}`)
        }

        const cubicBezTo = path["a:cubicBezTo"] || []
        for (const step of cubicBezTo) {
            const pts = step["a:pt"] || []
            if (pts.length === 3) {
                const p1 = pts[0]["$"]
                const p2 = pts[1]["$"]
                const p3 = pts[2]["$"]
                commands.push(`C${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`)
            }
        }

        if (path["a:close"]?.length) {
            commands.push("Z")
        }
    }

    return commands.join(" ")
}