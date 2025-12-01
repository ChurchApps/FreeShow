import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Line, Show, Slide } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { checkName } from "../components/helpers/show"
import { activePopup, alertMessage, drawerTabsData } from "../stores"
import { translateText } from "../utils/language"
import { createCategory, setTempShows } from "./importHelpers"
import { getCustomShapePath, getPresetShapePath } from "./powerpointShapes"

// missing shapes/tables/graphs
// item/line background, some text color incorrect
// extract embedded videos/audio

export function convertPowerpoint(files: any[]) {
    activePopup.set("alert")
    alertMessage.set("popup.importing")

    // use selected category (or Presentation if no specific is selected)
    let categoryId = get(drawerTabsData).shows?.activeSubTab
    if (categoryId === "all" || categoryId === "unlabeled") categoryId = createCategory("presentation", "presentation", { isDefault: true })

    const tempShows: any[] = []

    setTimeout(() => {
        files.forEach(({ name, content }: any) => {
            // console.log("PPT", content)

            const presentationData = content["ppt/presentation.xml"]?.["p:presentation"] || {}
            const relations = content["ppt/_rels/presentation.xml.rels"]?.Relationships?.Relationship || []
            const slideOrder = (presentationData["p:sldIdLst"]?.[0]["p:sldId"] || []).map(a => relations.find(r => r.$.Id === a.$?.["r:id"])?.$?.Target)

            // sort by number in name to ensure correct slide order (ppt/slides/slide1.xml)
            // const slideKeys = sortByNameNumber(Object.keys(content).filter((a) => a.includes("ppt/slides/slide")))

            const size = presentationData["p:sldSz"]?.[0]?.$ || {}
            currentSlideSize = { width: Number(size.cx) || EMU_WIDTH, height: Number(size.cy) || EMU_HEIGHT }

            // load font faces
            const contentPaths = content.contentPaths || {}
            // loadAllFonts(contentPaths)
            const fonts = getAllFontNames(contentPaths)

            const slides = slideOrder.map(key => convertSlide("ppt/" + key, content))
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
            show.layouts = { [layoutID]: { name: translateText("example.default"), notes: "", slides: layouts } }

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
                const name = spaceOnUppercase(match[1])
                fontNames.push({ name, path: contentPaths[key] })
            }
        }
    })
    return fontNames
}

function spaceOnUppercase(str: string) {
    // should not have space if there are multiple uppercase in a row (e.g., "PT Sans" not "P T Sans")
    return str.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
}

function createSlides(slides: { items: Item[]; bg: string; notes: string }[]) {
    if (!slides.length) return { slidesObj: {}, layouts: [] }

    const slidesObj: { [key: string]: Slide } = {}
    const layouts: any[] = []

    const parentId: string = uid()
    layouts.push({ id: parentId })
    slidesObj[parentId] = {
        group: ".",
        color: null,
        settings: { color: slides[0].bg || "" },
        notes: slides[0].notes,
        items: slides[0].items
    }

    slidesObj[parentId].children = slides.slice(1).map(({ items, bg, notes }: { items: Item[]; bg: string; notes: string }) => {
        const id: string = uid()
        slidesObj[id] = { group: null, color: null, settings: { color: bg || "" }, notes, items }
        return id
    })

    return { slidesObj, layouts }
}

type PlaceholderItem = Item & { placeholder?: { type: string; idx?: string } }

function convertSlide(key: string, content: any) {
    const slideContent = content[key]

    const slideNumber = key.slice(key.lastIndexOf("slide"))
    const slideRelations = getRelations(content, `ppt/slides/_rels/${slideNumber}.rels`)

    let clrSchemes = {}

    let layoutItems: PlaceholderItem[] = []
    const masterItems: PlaceholderItem[] = []
    let layoutItemsRaw: any = []
    let masterItemsRaw: any = []
    let bgColorValue = ""

    // slide layout
    const slideLayouts = slideRelations.filter(a => a.$.Target.includes("slideLayout")).map(a => a.$.Target)
    for (const layoutId of slideLayouts) {
        const layout = content[layoutId.replace("..", "ppt")]?.["p:sldLayout"] || {}

        const layoutNumber = layoutId.slice(layoutId.lastIndexOf("slideLayout"))
        const layoutRelations = getRelations(content, `ppt/slideLayouts/_rels/${layoutNumber}.rels`)

        // master
        const slideMasterId = layoutRelations.filter(a => a.$.Target.includes("slideMaster")).map(a => a.$.Target)[0] || ""
        const master = content[slideMasterId.replace("..", "ppt")]?.["p:sldMaster"] || {}

        const masterNumber = slideMasterId.slice(slideMasterId.lastIndexOf("slideMaster"))
        const masterRelations = getRelations(content, `ppt/slideMasters/_rels/${masterNumber}.rels`)

        // ---- theme bg ----
        const masterBgScheme = master["p:cSld"]?.[0]?.["p:bg"]?.[0]?.["p:bgPr"]?.[0]?.["a:solidFill"]?.[0]
        const themeTarget = masterRelations.find(r => r.$.Target.includes("/theme/"))?.$.Target
        if (themeTarget) {
            const theme = content[themeTarget.replace("..", "ppt")]?.["a:theme"]?.["a:themeElements"]?.[0] || {}
            clrSchemes = theme["a:clrScheme"]?.[0]
            bgColorValue = resolveColor(masterBgScheme, clrSchemes) || ""
        }
        const layoutBgScheme = layout["p:cSld"]?.[0]?.["p:bg"]?.[0]?.["p:bgPr"]?.[0]?.["a:solidFill"]?.[0]
        if (layoutBgScheme) {
            bgColorValue = resolveColor(layoutBgScheme, clrSchemes) || bgColorValue
        }

        layoutItemsRaw = layout["p:cSld"]?.[0]?.["p:spTree"]?.[0]?.["p:sp"] || []
        masterItemsRaw = master["p:cSld"]?.[0]?.["p:spTree"]?.[0]?.["p:sp"] || []
        layoutItems = convertItems(layout, layoutRelations, content, clrSchemes)
        // masterItems = convertItems(master, [], content, clrSchemes)
    }

    const slideItems: PlaceholderItem[] = convertItems(slideContent?.["p:sld"], slideRelations, content, clrSchemes, layoutItemsRaw, masterItemsRaw)

    const mergedItems = mergeItems(slideItems, layoutItems, masterItems)

    return { items: mergedItems, bg: bgColorValue, notes: getNotes(slideRelations, content) }
}

function getRelations(content: any, path: string) {
    return content[path]?.Relationships?.Relationship || []
}

function getNotes(relations: any, content: any): string {
    const slideNotesRelationId = relations.find(a => a.$.Target.includes("notesSlide"))?.$.Target || ""
    const slideNotesRelation = content[slideNotesRelationId.replace("..", "ppt")]
    return (
        slideNotesRelation?.["p:notes"]?.["p:cSld"]?.[0]["p:spTree"]?.[0]["p:sp"]
            ?.map(sp => {
                const body = sp["p:txBody"]?.[0]
                if (!body) return null
                return (
                    body["a:p"]
                        ?.map(p => {
                            return (p["a:r"] || []).map(r => r["a:t"]?.[0] || "").join("")
                        })
                        .join("\n") || ""
                )
            })
            .filter(a => a !== null)
            .join("\n") || ""
    )
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
    // typeof colorNode === "string" ? colorNode :
    const scheme = colorNode["a:schemeClr"]?.[0].$.val
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

function convertItems(slideContent, relations, content, clrSchemes, layoutItems = [], masterItems = []) {
    const slideTree = slideContent?.["p:cSld"]?.[0]["p:spTree"]?.[0] || {}
    return extractItemsFromTree(slideTree, relations, content, clrSchemes, layoutItems, masterItems).reverse()
}

function extractItemsFromTree(slideTree, relations, content, clrSchemes, layoutItems, masterItems) {
    const convertedItems: PlaceholderItem[] = []

    // track image shapes and their bounding boxes so we can remove thumbnails later
    const imageShapes: { src: string; bbox: { left: number; top: number; width: number; height: number } }[] = []

    const contentPaths = content.contentPaths || {}

    const textItems = slideTree["p:sp"] || []
    const imageItems = slideTree["p:pic"] || []
    // const tableItems = slideTree["p:graphicFrame"] || [] // often contains tables/charts
    const lineItems = slideTree["p:cxnSp"] || [] // connectors/lines
    const groupItems = slideTree["p:grpSp"] || []

    // ---------- TEXT ----------
    for (const textItem of textItems) {
        const body = textItem["p:txBody"]?.[0]
        const placeholder = textItem["p:nvSpPr"]?.[0]["p:nvPr"]?.[0]["p:ph"]?.[0].$

        // const svg = pptShapeToNormalizedSvg(textItem, clrSchemes)

        // if (svg) {
        //     // console.log(textItem, svg)

        //     let item: PlaceholderItem = { placeholder, style: getItemStyle(textItem), align: getItemAlign(body), type: "icon", decoration: true, customSvg: svg }
        //     convertedItems.push(item)
        //     continue
        // }

        if (body) {
            const paragraphs = body["a:p"] || []

            let bulletNumberIndex = 0
            const lines: Line[] = []
            for (const paragraph of paragraphs) {
                // const lstStyle = getListStyles(body["a:lstStyle"]?.[0] || {}, bulletNumberIndex)
                const paragraphOutput = paragraphToLine(paragraph, placeholder, layoutItems, masterItems, clrSchemes, bulletNumberIndex)
                const line = paragraphOutput.line
                bulletNumberIndex = paragraphOutput.bulletNumberIndex

                // split each text[] into line[] if there are line breaks
                const lineBreaks = paragraph["a:br"] || []
                if (lineBreaks.length) {
                    line.text?.forEach(a => {
                        lines.push({ ...line, text: [a] })
                    })
                }

                lines.push(line)
            }

            if (!lines.filter(line => line.text?.filter(a => a.value.length).length).length) {
                const svg = pptShapeToNormalizedSvg(textItem, clrSchemes)

                if (svg) {
                    // console.log(textItem, svg)

                    const iconItem: PlaceholderItem = { placeholder, style: getItemStyle(textItem, clrSchemes, true), align: getItemAlign(body), type: "icon", decoration: masterItems.length ? false : true, customSvg: svg }
                    convertedItems.push(iconItem)
                    continue
                }
            }

            let itemStyle = getItemStyle(textItem, clrSchemes)
            if (JSON.stringify(lines).includes("text-align:")) itemStyle += "padding: 20px;"
            const item: PlaceholderItem = { placeholder, style: itemStyle, align: getItemAlign(body), type: "text", lines }

            convertedItems.push(item)
        } else {
            // shape without text → treat as a shape (freeform line shape / boxes without text)
            const svg = pptShapeToNormalizedSvg(textItem, clrSchemes)
            if (svg) {
                const item: PlaceholderItem = { placeholder, style: getItemStyle(textItem, clrSchemes, true), type: "icon", decoration: masterItems.length ? false : true, customSvg: svg }
                convertedItems.push(item)
                continue
            }

            convertedItems.push({
                placeholder,
                style: getItemStyle(textItem, clrSchemes),
                type: "text",
                decoration: masterItems.length ? false : true
            })
        }
    }

    // ---------- IMAGES ----------
    for (const imageItem of imageItems) {
        const relationId: string = imageItem["p:blipFill"]?.[0]["a:blip"]?.[0].$?.["r:embed"] || ""
        let imageId = relations.find(a => a.$.Id === relationId)?.$?.Target || ""
        if (!imageId && relationId) imageId = findRelationTargetById(content, relationId) || ""
        const filePath = contentPaths[imageId.replace("..", "ppt")] || ""

        // const imageTitle: string = imageItem["p:nvPicPr"]?.[0]["p:cNvPr"]?.[0].$?.title || ""

        const placeholder = imageItem["p:nvSpPr"]?.[0]["p:nvPr"]?.[0]["p:ph"]?.[0]?.$
        convertedItems.push({ placeholder, style: getItemStyle(imageItem, clrSchemes), type: "media", src: filePath })

        // store bbox for this image so we can detect thumbnails for embedded videos
        const imgBox = getNodeBBox(imageItem)
        if (filePath && imgBox) imageShapes.push({ src: filePath, bbox: imgBox })

        // video/audio
        const videoLinkId = imageItem["p:nvPicPr"]?.[0]["p:cNvPr"]?.[0]?.["a:hlinkClick"]?.[0]?.$?.["r:id"]
        const videoUrl = relations.find(a => a.$.Id === videoLinkId)?.$?.Target
        if (videoUrl) convertedItems.push({ placeholder, style: getItemStyle(imageItem, clrSchemes), type: "web", web: { src: videoUrl, noNavigation: true }, clickReveal: true })
    }

    // ---------- EMBEDDED MEDIA (videos/audio) ----------
    // Only treat embedded nodes as media when they point to an actual video/audio file.
    // Many video shapes contain a thumbnail image (png/jpg) which was previously added
    // as an image; skip those thumbnails and remove them if they exist so we don't show
    // duplicate image + video items.
    const embeddedNodes = findEmbeddedMediaNodes(slideTree)
    const videoOrAudioExt = /\.(mp4|webm|ogv|m4v|mov|wmv|avi|aac|mp3|m4a|wav)$/i
    const imageExt = /\.(png|jpe?g|gif|webp|bmp|svg)$/i
    const addedMedia = new Set<string>()

    for (const node of embeddedNodes) {
        const relationId: string = node.embedId || ""
        let mediaTarget = relations.find(a => a.$.Id === relationId)?.$?.Target || ""
        if (!mediaTarget && relationId) mediaTarget = findRelationTargetById(content, relationId) || ""
        const filePath = contentPaths[mediaTarget.replace("..", "ppt")] || ""
        if (!filePath) continue

        // If this embed points to an image (thumbnail), skip it here. The image was already
        // handled in the imageItems loop; we aim to remove those thumbnail images when the
        // corresponding video is added below.
        if (imageExt.test(filePath) && !videoOrAudioExt.test(filePath)) continue

        // Only proceed if filePath looks like a video or audio file or if the mediaTarget filename
        // contains a media/ path (defensive fallback)
        if (!videoOrAudioExt.test(filePath) && !/media\//i.test(mediaTarget)) continue

        const placeholder = node.node["p:nvSpPr"]?.[0]["p:nvPr"]?.[0]["p:ph"]?.[0]?.$
        const styleSource = node.node

        // compute bbox for this embedded media node
        let mediaBox = getNodeBBox(node.node)

        // If the node is a group (no spPr), try to find a descendant shape/pic and use its bbox
        if (!mediaBox) {
            const desc = findDescendantShape(node.node)
            if (desc) mediaBox = getNodeBBox(desc)
        }

        // Skip if we've already added this media file (dedupe)
        if (addedMedia.has(filePath)) continue

        // Remove any previously added thumbnail image items that spatially overlap the media bbox.
        // Use bbox parsed from each item's style to be robust against differing src formats.
        for (let i = convertedItems.length - 1; i >= 0; i--) {
            const it: any = convertedItems[i]
            if (it.type !== "media") continue

            // if this is already the same media file, skip removal but treat as existing
            if (it.src && it.src === filePath) {
                // already present — mark and skip adding another
                addedMedia.add(filePath)
                // remove any overlapping image thumbnails (other entries) and then break
                continue
            }

            const itBox = parseStyleBox(it.style)
            if (itBox && mediaBox && boxesOverlap(mediaBox, itBox)) {
                // remove the overlapping item (likely a thumbnail image)
                convertedItems.splice(i, 1)
            }
        }

        // If not already added, add the embedded media item (mark as embedded so downstream can treat specially)
        if (!addedMedia.has(filePath)) {
            convertedItems.push({ placeholder, style: getItemStyle(styleSource, clrSchemes), type: "media", src: filePath })
            addedMedia.add(filePath)
        }
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
            style: getItemStyle(lineItem, clrSchemes),
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

// MEDIA (VIDEOS)
// Walk slide tree to find nodes that contain embedded media references (r:embed)
function findEmbeddedMediaNodes(slideTree: any) {
    const nodes: { node: any; embedId?: string }[] = []
    // Walk with parent tracking so we can return the nearest shape/pic parent
    function walk(obj: any, parent?: any) {
        if (!obj || typeof obj !== "object") return
        // Inspect any attributes on this node for rId-like values (rId<number>)
        if (obj.$ && typeof obj.$ === "object") {
            for (const [_k, v] of Object.entries<any>(obj.$)) {
                if (typeof v === "string" && /^rId\d+/i.test(v)) {
                    // prefer the parent if it looks like a shape/pic (has p:spPr or p:pic)
                    const chosen = parent && (parent["p:spPr"] || parent["p:pic"] || parent["p:nvSpPr"]) ? parent : obj
                    nodes.push({ node: chosen, embedId: v })
                    break
                }
            }
        }

        // check for some common nested places too (backwards compatible)
        const videoFile = obj["p:videoFile"]?.[0]?.$?.["r:embed"]
        if (videoFile) nodes.push({ node: parent || obj, embedId: videoFile })
        const blip = obj["p:blipFill"]?.[0]?.["a:blip"]?.[0]?.$?.["r:embed"]
        if (blip) nodes.push({ node: parent || obj, embedId: blip })

        for (const k of Object.keys(obj)) {
            const v = obj[k]
            if (Array.isArray(v)) v.forEach((w: any) => walk(w, obj))
            else if (typeof v === "object") walk(v, obj)
        }
    }

    walk(slideTree)
    return nodes
}
// Find the first descendant that looks like a shape/picture (has p:spPr or p:pic)
function findDescendantShape(obj: any): any | null {
    if (!obj || typeof obj !== "object") return null
    if (obj["p:spPr"] || obj["p:pic"]) return obj
    for (const k of Object.keys(obj)) {
        const v = obj[k]
        if (Array.isArray(v)) {
            for (const child of v) {
                const found = findDescendantShape(child)
                if (found) return found
            }
        } else if (typeof v === "object") {
            const found = findDescendantShape(v)
            if (found) return found
        }
    }
    return null
}

// function getListStyles(lstStyle: any, bulletNumberIndex: number) {
//     const lvl = `a:lvl${bulletNumberIndex + 1}pPr`
//     const lvlStyle = lstStyle[lvl]?.[0] || {}
//     return lvlStyle
// }

function getItemStyle(item: any, clrSchemes: any, svgStyled = false) {
    const spPr = item["p:spPr"]?.[0]
    const pos = spPr?.["a:xfrm"]?.[0]
    if (!pos) return DEFAULT_ITEM_STYLE

    // Defensive defaults: some PPTX shapes may omit a:ext or a:off
    const ext = pos["a:ext"]?.[0]?.$ || {}
    const off = pos["a:off"]?.[0]?.$ || {}
    const rot = parseFloat(pos.$?.rot || "0") / 60000 // convert 60,000ths of a degree to degrees
    const flipH = pos.$?.flipH === "1" ? "scaleX(-1)" : ""
    const flipV = pos.$?.flipV === "1" ? "scaleY(-1)" : ""

    const { left, top, width, height } = emuToPixels({ x: parseFloat(off.x || "0"), y: parseFloat(off.y || "0"), cx: parseFloat(ext.cx || "1000") || 1000, cy: parseFloat(ext.cy || "1000") || 1000 })

    const rotate = rot === 0 ? "" : `rotate(${rot}deg)`

    let transform = ""
    if (flipH || flipV || rotate) transform = `transform: ${flipH} ${flipV} ${rotate};`

    let color = ""
    const bgFill = spPr["a:solidFill"]?.[0] // || inheritColor(rawLayoutItems) || inheritColor(rawMasterItems)
    if (!svgStyled && bgFill) {
        color = resolveColor(bgFill, clrSchemes) || ""
        if (color) color = `background-color: ${color};`
    }

    let border = ""
    if (!svgStyled && spPr["a:ln"]?.[0]?.["a:solidFill"]) {
        let stroke = "none"
        let strokeWidth = 0
        let strokeDasharray = ""
        // let strokeLinecap = ""

        const ln = spPr["a:ln"][0]
        stroke = resolveColor(ln["a:solidFill"]?.[0], clrSchemes) || "#000"
        strokeWidth = ln.$?.w ? (parseInt(ln.$.w, 10) / 12700) * 0.02 : 1 // EMUs → pt → px-ish

        // Dash style
        const dashVal = ln["a:prstDash"]?.[0]?.$?.val
        if (dashVal && dashVal !== "solid") {
            if (dashVal === "dash") strokeDasharray = "4,2"
            else if (dashVal === "dot") strokeDasharray = "1,2"
            else if (dashVal === "dashDot") strokeDasharray = "4,2,1,2"
            // add more mappings if needed
        }

        // Line cap
        // if (ln.$?.cap === "round" || ln['a:round']) strokeLinecap = "round"
        // else if (ln.$?.cap === "square") strokeLinecap = "square"

        border = `border:${strokeWidth}px ${strokeDasharray ? "dashed" : "solid"} ${stroke};`
    }

    return `left:${left}px;top:${top}px;width:${width}px;height:${height}px;${transform}${color}${border}`
}

// function inheritColor(rawLayoutItems) {
//     for (const item of rawLayoutItems) {
//         const ph = item["p:nvSpPr"]?.[0]["p:nvPr"]?.[0]["p:ph"]?.[0]?.$
//         if (ph?.type === "bg") {
//             return item["p:spPr"]?.[0]?.["a:solidFill"]?.[0] || null
//         }
//     }
//     return null
// }

function getItemAlign(itemBody: any) {
    const style = itemBody["a:bodyPr"]?.[0].$ || {}
    if (style.anchor === "t") return "align-items: flex-start;"
    if (style.anchor === "b") return "align-items: flex-end;"
    return ""
}

// PowerPoint default slide size in EMUs (10in × 5.625in at 914400 EMU/inch)
const EMU_WIDTH = 9144000
const EMU_HEIGHT = 5143500
let currentSlideSize = { width: EMU_WIDTH, height: EMU_HEIGHT }
function emuToPixels({ x = 0, y = 0, cx = 0, cy = 0 }, slideWidth = 1920, slideHeight = 1080) {
    return {
        left: Math.round((x / currentSlideSize.width) * slideWidth),
        top: Math.round((y / currentSlideSize.height) * slideHeight),
        width: Math.round((cx / currentSlideSize.width) * slideWidth),
        height: Math.round((cy / currentSlideSize.height) * slideHeight)
    }
}

function paragraphToLine(paragraph, placeholder, layoutItems, masterItems, clrSchemes, bulletNumberIndex) {
    const lineStyle = paragraph["a:pPr"]?.[0] || {}
    const align = getAlignment(lineStyle.$?.algn || "")

    const line: Line = { align, text: [] }

    const bulletChar = getBullet(lineStyle, bulletNumberIndex)
    const bulletSize = parseInt(lineStyle["a:buSzPts"]?.[0].$?.val || "1000", 10) / 100
    if (bulletChar) bulletNumberIndex += 1

    const textRuns = paragraph["a:r"] || []
    textRuns.forEach((textRun: any) => {
        const style = textRun["a:rPr"]?.[0] || {}
        // let listStyle = lstStyle["a:defRPr"]?.[0] || {}
        const value = textRun["a:t"]?.[0] || ""
        // if (bulletStyle) value = `${bulletStyle} ${value}`
        const textStyle = getTextStyle(style, placeholder, layoutItems, masterItems, clrSchemes)
        if (bulletChar) line.text.push({ style: `${textStyle}font-size: ${ptToPx(bulletSize)}px;padding-left: 28px;padding-right: 47px;`, value: bulletChar })
        line.text.push({ style: textStyle, value })
    })

    return { line, bulletNumberIndex }
}

function getBullet(lineStyle: any, lineIndex: number) {
    const bulletChar = lineStyle["a:buChar"]?.[0].$?.char
    if (bulletChar) return bulletChar

    const bulletAutoNum = lineStyle["a:buAutoNum"]?.[0].$?.type
    if (bulletAutoNum) {
        if (bulletAutoNum === "arabicPeriod") return lineIndex + 1 + "."
        if (bulletAutoNum === "alphaLcPeriod") return String.fromCharCode(97 + lineIndex) + "."
        if (bulletAutoNum === "alphaUcPeriod") return String.fromCharCode(65 + lineIndex) + "."
        if (bulletAutoNum === "romanLcPeriod") return toRoman(lineIndex + 1).toLowerCase() + "."
        if (bulletAutoNum === "romanUcPeriod") return toRoman(lineIndex + 1).toUpperCase() + "."
        return "•"
    }

    return ""
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

const DEFAULT_FONT = "Arial"
function normalizePlaceholderType(type?: string): string | undefined {
    if (!type) return undefined
    if (type === "ctrTitle") return "title"
    if (type === "subTitle" || type === "obj") return "body"
    return type
}
function getTextStyle(rPr: any, placeholder: any, layoutItems: any[], masterItems: any[], clrSchemes: any) {
    placeholder = { ...placeholder, type: normalizePlaceholderType(placeholder?.type) }

    let style = "text-shadow: 0px 0px 0px #000000;line-height: calc(1.08em + 10px);" // 1.36em / 47px

    // ---------- Bold / Italic / Underline ----------
    const bold = (rPr?.$?.b || getInheritedProperty("b", placeholder, layoutItems, masterItems)) === "1"
    const italic = (rPr?.$?.i || getInheritedProperty("i", placeholder, layoutItems, masterItems)) === "1"
    const underline = (rPr?.$?.u || getInheritedProperty("u", placeholder, layoutItems, masterItems)) === "sng"
    if (bold) style += "font-weight: bold;"
    if (italic) style += "font-style: italic;"
    if (underline) style += "text-decoration: underline;"

    // ---------- Font size ----------
    const fontSize = rPr?.$?.sz || getInheritedProperty("sz", placeholder, layoutItems, masterItems)
    if (fontSize) {
        const fontSizePt = parseInt(fontSize, 10) / 100 // PowerPoint stores sz in 1/100th pt
        const fontSizePx = ptToPx(fontSizePt)
        style += `font-size: ${fontSizePx}px;`
        // style += `font-size: ${parseInt(fontSize, 10) / 100}pt;`
    }

    // ---------- Font family ----------
    const fontFamily = rPr?.$?.latin || getInheritedProperty("latin", placeholder, layoutItems, masterItems) || DEFAULT_FONT
    if (fontFamily) {
        style += `font-family: '${fontFamily}';`
    }

    // ---------- Color ----------
    //  || listStyle?.["a:solidFill"]?.[0]
    const color = resolveColor(rPr?.["a:solidFill"]?.[0] || getInheritedProperty("color", placeholder, layoutItems, masterItems), clrSchemes)
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
            for (const lvl of Object.values<any>(lstStyle)) {
                // a:lvl1pPr, a:lvl2pPr, etc
                const defRPr = lvl[0]?.["a:defRPr"]?.[0]
                if (defRPr) {
                    if (prop === "b" && defRPr.$?.b) return defRPr.$.b
                    if (prop === "i" && defRPr.$?.i) return defRPr.$.i
                    if (prop === "u" && defRPr.$?.u) return defRPr.$.u
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
    const px = Math.round((pt * 96) / 72) // 1pt = 1.333px
    return px * 2.01 // convert to FS size
}

function getAlignment(algn: string) {
    if (algn === "l") return "text-align: left;"
    if (algn === "r") return "text-align: right;"
    return ""
}

// SVG

function pptShapeToNormalizedSvg(shape, clrSchemes) {
    const spPr = shape["p:spPr"]?.[0]
    if (!spPr) return null
    const prstGeom = spPr["a:prstGeom"]?.[0].$?.prst
    // if (!prstGeom || prstGeom === "rect") return null

    const xfrm = spPr["a:xfrm"]?.[0]
    const off = xfrm?.["a:off"]?.[0]?.$ || {}
    const ext = xfrm?.["a:ext"]?.[0]?.$ || {}
    if (!off || !ext) return null

    // Fill color and opacity
    const fill = resolveColor(spPr["a:solidFill"]?.[0], clrSchemes) || "none"
    let fillOpacity = 1
    const schemeClr = spPr["a:solidFill"]?.[0]?.["a:schemeClr"]?.[0]
    if (schemeClr?.["a:alpha"]?.[0]?.$?.val) {
        fillOpacity = parseInt(schemeClr["a:alpha"][0].$.val, 10) / 100000
    }

    // ---- LINE SUPPORT ----
    let stroke = "none"
    let strokeWidth = 0
    let strokeDasharray = ""
    let strokeLinecap = ""
    let strokeLinejoin = ""
    let strokeMiterlimit = 0

    if (spPr["a:ln"]?.[0]?.["a:solidFill"]) {
        const ln = spPr["a:ln"][0]
        stroke = resolveColor(ln["a:solidFill"]?.[0], clrSchemes) || ""
        strokeWidth = ln.$?.w ? (parseInt(ln.$.w, 10) / 12700) * 0.02 : 1 // EMUs → pt → px-ish

        // Dash style
        const dashVal = ln["a:prstDash"]?.[0]?.$?.val
        if (dashVal && dashVal !== "solid") {
            if (dashVal === "dash") strokeDasharray = "4,2"
            else if (dashVal === "dot") strokeDasharray = "1,2"
            else if (dashVal === "dashDot") strokeDasharray = "4,2,1,2"
            // add more mappings if needed
        }

        // Line cap
        if (ln.$?.cap === "round" || ln["a:round"]) strokeLinecap = "round"
        else if (ln.$?.cap === "square") strokeLinecap = "square"

        // Line join
        if (ln.$?.join === "round" || ln["a:round"]) strokeLinejoin = "round"
        else if (ln.$?.join === "bevel" || ln["a:bevel"]) strokeLinejoin = "bevel"
        else if (ln.$?.join === "miter" || ln["a:miter"]) {
            strokeLinejoin = "miter"
            strokeMiterlimit = ln.$?.miterLim ? parseFloat(ln.$.miterLim) : 4
        }
    }

    // Bounding box
    const x1 = parseFloat(off.x || "0")
    const y1 = parseFloat(off.y || "0")
    const width = parseFloat(ext.cx || "1000") || 1000
    const height = parseFloat(ext.cy || "1000") || 1000

    let svgAttributes = `fill="${fill}"`
    if (fillOpacity < 1) svgAttributes += ` fill-opacity="${fillOpacity}"`
    if (stroke !== "none") svgAttributes += ` stroke="${stroke}"`
    if (strokeWidth) svgAttributes += ` stroke-width="${strokeWidth}"`
    if (strokeDasharray) svgAttributes += ` stroke-dasharray="${strokeDasharray}"`
    if (strokeLinecap) svgAttributes += ` stroke-linecap="${strokeLinecap}"`
    if (strokeLinejoin) svgAttributes += ` stroke-linejoin="${strokeLinejoin}"`
    if (strokeMiterlimit) svgAttributes += ` stroke-miterlimit="${strokeMiterlimit}"`

    // Compute aspect ratio
    const aspect = width / height
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
        const customPath = spPr["a:custGeom"]?.[0]?.["a:pathLst"]?.[0]?.["a:path"]?.[0]
        if (customPath) {
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
    const avLst = spPr["a:prstGeom"]?.[0]["a:avLst"]?.[0]
    if (avLst?.["a:gd"]) {
        const valStr = avLst["a:gd"][0]?.$?.fmla
        if (valStr && valStr.startsWith("val")) {
            adj = parseFloat(valStr.split(" ")[1])
        }
    }

    const path = getPresetShapePath(prstGeom, x1, y1, width, height, adj)

    // viewBox="0 0 1 1"
    return `<svg data-shape="${prstGeom}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbWidth} ${vbHeight}" style="position: absolute;">
        <path ${svgAttributes} d="${path}"></path>
    </svg>`
}

// MEDIA (VIDEOS)

// Get bounding box (left/top/width/height in pixel space) for a shape-like node that has p:spPr
function getNodeBBox(node: any) {
    try {
        const spPr = node["p:spPr"]?.[0]
        const pos = spPr?.["a:xfrm"]?.[0]
        if (!pos) return null

        const ext = pos["a:ext"]?.[0].$
        const off = pos["a:off"]?.[0].$
        if (!ext || !off) return null

        const { left, top, width, height } = emuToPixels({ x: parseFloat(off.x), y: parseFloat(off.y), cx: parseFloat(ext.cx) || 1000, cy: parseFloat(ext.cy) || 1000 })
        return { left, top, width, height }
    } catch (e) {
        return null
    }
}

function boxesOverlap(a: { left: number; top: number; width: number; height: number }, b: { left: number; top: number; width: number; height: number }) {
    const ax2 = a.left + a.width
    const ay2 = a.top + a.height
    const bx2 = b.left + b.width
    const by2 = b.top + b.height

    return !(ax2 < b.left || bx2 < a.left || ay2 < b.top || by2 < a.top)
}

// Search all .rels entries in the content object for a relationship with the given Id
function findRelationTargetById(content: any, relationId: string) {
    if (!relationId) return null
    for (const key of Object.keys(content)) {
        const entry = content[key]
        if (!entry) continue
        const rels = entry?.Relationships?.Relationship || []
        for (const r of rels) {
            if (r.$?.Id === relationId) return r.$?.Target
        }
    }
    return null
}

// Parse inline style left/top/width/height into a bbox object, returns null if missing
function parseStyleBox(style: string | undefined) {
    if (!style || typeof style !== "string") return null
    const leftMatch = style.match(/left:\s*([0-9]+)px/)
    const topMatch = style.match(/top:\s*([0-9]+)px/)
    const widthMatch = style.match(/width:\s*([0-9]+)px/)
    const heightMatch = style.match(/height:\s*([0-9]+)px/)
    if (!leftMatch || !topMatch || !widthMatch || !heightMatch) return null
    return { left: parseInt(leftMatch[1], 10), top: parseInt(topMatch[1], 10), width: parseInt(widthMatch[1], 10), height: parseInt(heightMatch[1], 10) }
}
