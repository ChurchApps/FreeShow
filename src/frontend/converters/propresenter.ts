import { get } from "svelte/store"
import { uid } from "uid"
import type { Item, Layout, Line, Slide, SlideData, Timeline } from "../../types/Show"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { getExtension, getFileName, getMediaType } from "../components/helpers/media"
import { checkName, getGlobalGroup, initializeMetadata, newSlide } from "../components/helpers/show"
import { translateText } from "../utils/language"
import { ShowObj } from "./../classes/Show"
import { activePopup, alertMessage, groups, shows } from "./../stores"
import { createCategory, setTempShows } from "./importHelpers"
import { xml2json } from "./xml"

type ImportFile = { content: any; name: string; extension: string }
type ConvertedShow = { slides: Record<string, Slide>; layouts: any[]; media?: Record<string, any> }

const DEFAULT_GROUP = "verse"
const PLACEHOLDER_TEXT = "Double-click to edit"

export function convertProPresenter(data: ImportFile[]) {
    alertMessage.set("popup.importing")
    activePopup.set("alert")

    const categoryId = createCategory("ProPresenter")
    const files = expandJsonBundles(data)
    const tempShows: any[] = []

    setTimeout(() => {
        files?.forEach((file) => {
            const show = importFile(file, categoryId, tempShows)
            if (show) tempShows.push(show)
        })

        setTempShows(tempShows)
    }, 50)
}

// A single .json input may hold multiple songs bundled together — expand each one
// into its own file entry so downstream code handles them uniformly.
function expandJsonBundles(data: ImportFile[]): ImportFile[] {
    const expanded: ImportFile[] = []
    data?.forEach(({ content, name, extension }) => {
        if (extension !== "json") return

        const song = safeParseJson(content)
        if (!Array.isArray(song?.data)) return

        song.data.forEach((songData: any) => {
            expanded.push({ content: songData, name, extension: "jsonbundle" })
        })
    })
    return expanded.length ? expanded : data
}

function importFile({ content, name, extension }: ImportFile, categoryId: string, tempShows: any[]) {
    if (!content) {
        console.error("File missing content!")
        return null
    }

    const song = parseSong(content, extension)
    if (!song) return null

    const layoutId = uid()
    const show = new ShowObj(false, categoryId, layoutId, Date.now(), false)
    show.origin = "propresenter"

    const showId = resolveShowId(song, name, tempShows)
    show.name = checkName(resolveShowName(song, name), showId)

    const converted = runConverter(song, extension)
    if (!Object.keys(converted.slides).length) return null

    show.slides = converted.slides
    show.layouts = {}
    show.media = converted.media || {}
    show.meta = buildMetadata(song)

    applyLayouts(show, converted.layouts, layoutId, song["@notes"] || "")

    return { id: showId, show }
}

function parseSong(content: any, extension: string): any | null {
    if (extension === "json" || extension === "pro") return safeParseJson(content)
    if (extension === "jsonbundle") return content
    return xml2json(content)?.RVPresentationDocument
}

function safeParseJson(content: string): any {
    try {
        return JSON.parse(content)
    } catch (err) {
        console.error(err)
        return {}
    }
}

function resolveShowName(song: any, fallback: string): string {
    if (song.name === "Untitled") return fallback
    return song.name || song.title || fallback
}

// ProPresenter often reuses the same id for duplicated songs — generate a fresh id
// when we detect a name collision so the existing show is not overwritten.
function resolveShowId(song: any, name: string, tempShows: any[]): string {
    const originalId = song["@uuid"] || song.uuid?.string || song._id || uid()
    const existingShow = get(shows)[originalId] || tempShows.find((a) => a.id === originalId)?.show
    if (existingShow && existingShow.name !== (song.name || name)) return uid()
    return originalId
}

function runConverter(song: any, extension: string): ConvertedShow {
    if (extension === "pro") return convertProToSlides(song)
    if (extension === "json") return convertJSONToSlides(song)
    if (extension === "jsonbundle") return convertJSONBundleToSlides(song)
    return convertToSlides(song, extension)
}

function buildMetadata(song: any) {
    return initializeMetadata({
        title: song["@CCLISongTitle"] || song.ccli?.songTitle,
        artist: song["@CCLIArtistCredits"],
        author: song["@CCLIAuthor"] || song.ccli?.author || song.author,
        publisher: song["@CCLIPublisher"] || song.ccli?.publisher,
        copyright: song.copyrights_info,
        CCLI: song["@CCLISongNumber"] || song.ccli?.songNumber,
        year: song["@CCLICopyrightYear"] || song.ccli?.copyrightYear
    })
}

function applyLayouts(show: any, layouts: any[], defaultLayoutId: string, notes: string) {
    layouts.forEach((layout, i) => {
        const layoutId = i === 0 ? defaultLayoutId : layout.id
        show.layouts[layoutId] = {
            name: layout.name || translateText("example.default"),
            notes: i === 0 ? notes : "",
            slides: layout.slides
        }
        if (layout.timeline) show.layouts[layoutId].timeline = layout.timeline
    })
}

// ----- JSON bundle -----

function convertJSONBundleToSlides(song: any): ConvertedShow {
    const slides: Record<string, Slide> = {}
    const layoutSlides: any[] = []
    const parentId = uid()
    const children: string[] = []

    song.lyrics.forEach(({ lyrics }: any) => {
        if (!lyrics) return

        const isParent = !Object.keys(slides).length
        const id = isParent ? parentId : uid()

        if (isParent) layoutSlides.push({ id })

        const cleaned = lyrics.replaceAll("<p>", "").replaceAll("</p>", "")
        const items: Item[] = [
            {
                style: DEFAULT_ITEM_STYLE,
                lines: cleaned.split("<br>").map((line: string) => ({ align: "", text: [{ style: "", value: line }] }))
            }
        ]

        slides[id] = newSlide({ items })

        if (isParent) {
            slides[id].group = ""
            if (get(groups).verse) slides[id].globalGroup = DEFAULT_GROUP
        } else {
            children.push(id)
        }
    })

    slides[parentId].children = children

    const layouts = [{ id: uid(), name: "", notes: "", slides: layoutSlides }]
    return { slides, layouts }
}

// ----- JSON (OpenLP/other) -----

const JSON_GROUPS: Record<string, string> = { V: "verse", C: "chorus", B: "bridge", T: "tag", O: "outro" }

function convertJSONToSlides(song: any): ConvertedShow {
    const slides: Record<string, Slide> = {}
    let layoutSlides: any[] = []
    const slidesRef: Record<string, string> = {}
    let slidesList: string[] = []

    song.verses?.forEach(([text, label]: [string, string]) => {
        if (!text) return

        const id = uid()
        slidesList.push(label)
        slidesRef[label] = id

        layoutSlides.push({ id })

        const items: Item[] = [
            {
                style: DEFAULT_ITEM_STYLE,
                lines: text.split("\n").map((line: string) => ({ align: "", text: [{ style: "", value: line }] }))
            }
        ]

        slides[id] = newSlide({ items })

        const globalGroup = label ? JSON_GROUPS[label.replace(/[0-9]/g, "").toUpperCase()] : DEFAULT_GROUP
        if (get(groups)[globalGroup]) slides[id].globalGroup = globalGroup
    })

    const initialSlidesList: string[] = song.verse_order_list || []
    if (initialSlidesList.length) slidesList = initialSlidesList
    if (slidesList.length) {
        layoutSlides = []
        slidesList.forEach((label) => {
            if (slidesRef[label]) layoutSlides.push({ id: slidesRef[label] })
        })
    }

    const layouts = [{ id: uid(), name: "", notes: "", slides: layoutSlides }]
    return { slides, layouts }
}

// ----- Pro4 / Pro5 / Pro6 (XML) -----

function convertToSlides(song: any, extension: string): ConvertedShow {
    const slideGroups = getSlideGroups(song, extension)
    const arrangements = song.arrangements || song.array?.[1]?.RVSongArrangement || []

    const slides: Record<string, Slide> = {}
    const layouts: any[] = [{ id: null, name: "", slides: [] }]
    const media: Record<string, any> = {}
    const sequences: Record<string, string> = {}
    const backgrounds: any[] = []

    slideGroups.forEach((group: any) => {
        const groupSlides = getGroupSlides(group, extension)
        if (!groupSlides.length) return

        let slideIndex = -1
        groupSlides.forEach((slide: any) => {
            const items = getSlideItems(slide)
            if (!items.length) return
            slideIndex++

            const slideId = uid()
            const isDisabled = slide["@enabled"] === "false"
            slides[slideId] = newSlide({ notes: slide["@notes"] || "", items })

            const background = extractSlideBackground(slide)
            if (background) backgrounds[slideIndex] = background

            if (slideIndex === 0) {
                const parent: any = slides[slideId]
                slides[slideId] = makeParentSlide(parent, {
                    label: group["@name"] || parent["@label"] || "",
                    color: group["@color"] || parent["@highlightColor"]
                })

                sequences[group["@uuid"]] = slideId

                const layoutSlide: any = { id: slideId }
                if (isDisabled) layoutSlide.disabled = true
                layouts[0].slides.push(layoutSlide)
            } else {
                addChildSlide(slides, layouts[0], slideId, isDisabled)
            }
        })
    })

    if (arrangements.length) {
        const arranged = arrangeLayouts(arrangements, sequences)
        if (arranged.length) layouts.push(...arranged)
    }

    attachBackgrounds(layouts, backgrounds, media)

    return { slides, layouts, media }
}

function getSlideGroups(song: any, extension: string): any[] {
    let slideGroups: any = []
    if (extension === "pro4") slideGroups = song.slides?.RVDisplaySlide || []
    if (extension === "pro5") slideGroups = song.groups?.RVSlideGrouping || []
    if (extension === "pro6") slideGroups = song.array?.[0]?.RVSlideGrouping || []
    if (!Array.isArray(slideGroups)) slideGroups = slideGroups ? [slideGroups] : []
    return slideGroups
}

function getGroupSlides(group: any, extension: string): any[] {
    let groupSlides = group
    if (extension === "pro4") groupSlides = [groupSlides]
    if (extension === "pro5") groupSlides = groupSlides.slides.RVDisplaySlide
    if (extension === "pro6" && groupSlides.array) groupSlides = groupSlides.array.RVDisplaySlide
    if (!Array.isArray(groupSlides)) groupSlides = groupSlides ? [groupSlides] : []
    return groupSlides
}

function extractSlideBackground(slide: any) {
    const mediaCue = slide.RVMediaCue
    const path: string = mediaCue?.RVVideoElement?.["@source"] || ""
    if (!path) return null
    return { path, name: mediaCue["@displayName"] || "" }
}

function addChildSlide(slides: Record<string, Slide>, layout: any, childId: string, isDisabled: boolean) {
    const parentLayout = layout.slides[layout.slides.length - 1]
    const parentSlide = slides[parentLayout.id]
    if (!parentSlide.children) parentSlide.children = []
    parentSlide.children.push(childId)

    if (isDisabled) {
        if (!parentLayout.children) parentLayout.children = {}
        parentLayout.children[childId] = { disabled: true }
    }
}

function attachBackgrounds(layouts: any[], backgrounds: any[], media: Record<string, any>) {
    backgrounds.forEach((background, i) => {
        if (!background || !layouts[i]) return
        if (!layouts[0].slides[i]) return

        const id = uid()
        layouts[0].slides[i].background = id
        media[id] = background
    })
}

function getSlideItems(slide: any): Item[] {
    if (!slide) return []

    const elements = getDisplayElements(slide)
    if (!elements?.RVTextElement) return []

    const items: Item[] = []
    const textElements = Array.isArray(elements.RVTextElement) ? elements.RVTextElement : [elements.RVTextElement]

    textElements.forEach((textElement: any) => {
        if (!textElement) return

        collectItemTexts(textElement).forEach((text) => {
            items.push({ style: DEFAULT_ITEM_STYLE, lines: splitTextToLines(text) })
        })
    })

    return items
}

function getDisplayElements(slide: any) {
    if (slide.displayElements) return slide.displayElements
    if (Array.isArray(slide.array)) return slide.array.find((a: any) => a["@rvXMLIvarName"] === "displayElements")
    return null
}

function collectItemTexts(textElement: any): string[] {
    let itemStrings = textElement.NSString
    if (!itemStrings) itemStrings = [textElement["@RTFData"]]
    else if (itemStrings["#text"]) itemStrings = [itemStrings]

    itemStrings = itemStrings.filter(Boolean)

    // Prefer RTF (which preserves line breaks); fall back to PlainText.
    const rtf = itemStrings.find((a: any) => a["@rvXMLIvarName"] === "RTFData")
    const plain = itemStrings.find((a: any) => a["@rvXMLIvarName"] === "PlainText")
    if (rtf) itemStrings = [rtf]
    else if (plain) itemStrings = [plain]

    const texts: string[] = []
    itemStrings.forEach((content: any) => {
        if (!content) return
        if (Array.isArray(content)) content = content[0]

        const type = content["@rvXMLIvarName"]
        if (type && type !== "RTFData" && type !== "PlainText") return

        let text = decodeBase64(content["#text"] || content)
        text = decodeHex(text)
        if (text === PLACEHOLDER_TEXT) text = ""
        texts.push(text)
    })

    return texts
}

function makeParentSlide(slide: Slide, { label, color = "" }: { label: string; color?: string }): Slide {
    slide.group = label
    if (color) slide.color = rgbStringToHex(color)
    // Black on black is invisible in the group label — fall back to white.
    if (color === "#000000") slide.color = "#ffffff"

    if (label.toLowerCase() === "group") label = DEFAULT_GROUP
    slide.globalGroup = getGlobalGroup(label) || DEFAULT_GROUP

    return slide
}

function arrangeLayouts(arrangements: any[], sequences: Record<string, string>): Layout[] {
    const layouts: Layout[] = []
    arrangements.forEach((arrangement) => {
        let groupIds = arrangement.array?.NSString || []
        if (!Array.isArray(groupIds)) groupIds = [groupIds]
        if (!groupIds.length) return

        const slides = groupIds.map((groupID: string) => ({ id: sequences[groupID] }))
        layouts.push({ id: arrangement["@uuid"], name: arrangement["@name"], notes: "", slides })
    })

    return layouts
}

// ----- Text / RTF decoding -----

function splitTextToLines(text: string): Line[] {
    if (typeof text !== "string") return []
    return text
        .replaceAll("\n\n", "<br>")
        .split("<br>")
        .map((lineText) => ({
            align: "",
            text: [{ style: "", value: lineText.trim() }]
        }))
}

const CHARSET_TO_ENCODING: Record<number, string> = {
    128: "shift_jis",
    129: "windows-949",
    134: "gbk",
    136: "big5",
    161: "windows-1253",
    162: "windows-1254",
    177: "windows-1255",
    178: "windows-1256",
    186: "windows-1257",
    204: "windows-1251",
    238: "windows-1250"
}
const LANG_TO_ENCODING: Record<number, string> = {
    1028: "big5", // Traditional Chinese (Taiwan)
    1041: "shift_jis", // Japanese
    1042: "windows-949", // Korean
    1049: "windows-1251", // Russian
    2052: "gbk", // Simplified Chinese (PRC)
    3076: "big5", // Traditional Chinese (Hong Kong)
    4100: "gbk", // Simplified Chinese (Singapore)
    5124: "big5" // Traditional Chinese (Macau)
}

function getRTFEncoding(input: string): string {
    // Check for explicit non-default codepages first
    const cpgMatch = input.match(/\\ansicpg(\d+)/)
    if (cpgMatch) {
        const cpg = parseInt(cpgMatch[1], 10)
        if (cpg === 65001) return "utf-8"
        if (cpg === 949) return "windows-949"
        if (cpg === 936 || cpg === 54936 || cpg === 20936) return "gbk"
        if (cpg === 932) return "shift_jis"
        if (cpg === 950) return "big5"
        if (cpg >= 1250 && cpg <= 1258 && cpg !== 1252) return `windows-${cpg}`
    }

    // Check font charsets in the font table (e.g., \fcharset134 for GBK, \fcharset136 for Big5)
    const charsetMatches = input.matchAll(/\\fcharset(\d+)/g)
    for (const match of charsetMatches) {
        const charset = parseInt(match[1], 10)
        if (CHARSET_TO_ENCODING[charset]) return CHARSET_TO_ENCODING[charset]
    }

    // Check language tags (\deflang / \lang)
    const langMatch = input.match(/\\(?:def)?lang(\d+)/)
    if (langMatch) {
        const lang = parseInt(langMatch[1], 10)
        if (LANG_TO_ENCODING[lang]) return LANG_TO_ENCODING[lang]
    }

    if (input.includes("\\mac")) return "macintosh"

    return "windows-1252"
}

function isDBCSLeadByte(byte: number, encoding: string): boolean {
    const enc = encoding.toLowerCase()
    if (enc === "gbk" || enc === "windows-936" || enc === "gb2312" || enc === "gb18030") return byte >= 0x81 && byte <= 0xfe
    if (enc === "big5" || enc === "windows-950") return byte >= 0x81 && byte <= 0xfe
    if (enc === "shift_jis" || enc === "windows-31j" || enc === "cp932") return (byte >= 0x81 && byte <= 0x9f) || (byte >= 0xe0 && byte <= 0xfc)
    if (enc === "windows-949" || enc === "euc-kr") return byte >= 0x81 && byte <= 0xfe
    return false
}

// Replace RTF hex codes (e.g., \'e5 or multi-byte sequences like \'b0\'c5 or \'d3H) using the document encoding.
function decodeHexRTF(input: string, encoding = "windows-1252"): string {
    let decoder: TextDecoder
    try {
        decoder = new TextDecoder(encoding)
    } catch {
        decoder = new TextDecoder("windows-1252")
    }

    const isDBCS = ["gbk", "windows-936", "gb2312", "gb18030", "big5", "windows-950", "shift_jis", "windows-31j", "cp932", "windows-949", "euc-kr"].includes(encoding.toLowerCase())
    if (isDBCS) {
        // First handle lead bytes followed by ASCII trail characters (e.g. \'d3H in GBK/Big5)
        input = input.replace(/\\\'([0-9a-fA-F]{2})([A-Za-z0-9_@#$%^&*()\-+=[\]|;:,.<>?/~`])/g, (match, hex, trailChar) => {
            const byte1 = parseInt(hex, 16)
            if (isDBCSLeadByte(byte1, encoding)) {
                const byte2 = trailChar.charCodeAt(0)
                if (byte2 >= 0x40 && byte2 <= 0x7e && byte2 !== 0x5c) {
                    try {
                        return decoder.decode(new Uint8Array([byte1, byte2]))
                    } catch {
                        return match
                    }
                }
            }
            return match
        })
    }

    return input.replace(/(?:\\'([0-9a-fA-F]{2}))+/g, (match) => {
        const hexes = match.match(/[0-9a-fA-F]{2}/g) || []
        const bytes = new Uint8Array(hexes.map((hex) => parseInt(hex, 16)))
        try {
            return decoder.decode(bytes)
        } catch {
            return match
        }
    })
}

function decodeBase64(text: string): string {
    if (typeof text !== "string") return ""

    let r = decodeBase64Chars(text)

    // https://www.oreilly.com/library/view/rtf-pocket-guide/9781449302047/ch04.html
    // https://github.com/ChurchApps/FreeShow/issues/1200
    r = r.replaceAll("\\u8217 ?", "'")

    // Normalize curly quotes to a straight apostrophe.
    r = r.replaceAll("‘", "'").replaceAll("’", "'")

    const encoding = getRTFEncoding(r)
    r = decodeHexRTF(r, encoding)
    r = decodeUnicodeEscapes(r)
    return r
}

function decodeBase64Chars(text: string): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    let bits = 0
    let bitLength = 0
    let result = ""

    text.split("").forEach((char) => {
        bits = (bits << 6) + alphabet.indexOf(char)
        bitLength += 6
        if (bitLength >= 8) result += String.fromCharCode((bits >>> (bitLength -= 8)) & 0xff)
    })

    return result
}

// https://unicodelookup.com/ — decode \uNNNN ? sequences into their character.
function decodeUnicodeEscapes(input: string): string {
    return input.replace(/\\u(-?\d+)(?:[ ](?:\\[\''][0-9a-fA-F]{2}|\?)|\?|(?:\\[\''][0-9a-fA-F]{2})|[ ])?/g, (_match, num) => {
        const code = parseInt(num, 10)
        const charCode = code < 0 ? code + 65536 : code
        if (charCode === 8232) return "\n"
        return String.fromCharCode(charCode)
    })
}

function RTFToText(input: string): string {
    // Handle the binary ending characters that sometimes appear
    const binaryEndPos = input.search(/[\x00-\x08\x0B\x0C\x0E-\x1F]+$/)
    if (binaryEndPos > -1) input = input.slice(0, binaryEndPos)

    // Remove the last } if it exists
    input = input.slice(0, input.lastIndexOf("}") > 0 ? input.lastIndexOf("}") : input.length)

    // Convert common RTF commands to line breaks.
    input = input.replaceAll("\\pard", "\\remove")
    input = input.replaceAll("\\part", "\\remove")
    input = input.replaceAll("\\par", "__BREAK__")
    input = input.replaceAll("\\\n", "__BREAK__")
    input = input.replaceAll("\n", "__BREAK__")
    input = input.replaceAll("\\u8232", "__BREAK__")

    // https://stackoverflow.com/a/188877
    const regex = /\{\*?\\[^{}]+}|[{}]|\\\n?[A-Za-z]+\n?(?:-?\d+)?[ ]?/gm
    let cleaned = input.replace(regex, "").replaceAll("\\*", "")

    // Some files wrap the text in {} — strip and try again if nothing survived.
    if (!cleaned.replaceAll("__BREAK__", "").trim().length) {
        input = input.replaceAll("}", "").replaceAll("{", "")
        cleaned = input.replace(regex, "").replaceAll("\\*", "")

        const formatting = cleaned.lastIndexOf(";;;;")
        if (formatting >= 0) cleaned = cleaned.slice(formatting + 4)

        cleaned = cleaned.replaceAll(";;", "")
    }

    cleaned = cleaned.replace(/\s+/g, " ").trim()

    return cleaned
        .split("__BREAK__")
        .filter((a) => a.trim())
        .join("\n")
        .trim()
}

function decodeHex(input: string): string {
    // If input looks like RTF, use RTF parser.
    if (input.includes("\\rtf")) return RTFToText(input)

    input = stripRTFHeader(input)
    input = input.replaceAll("\\\n", "<br>")

    let str = decodeHexBody(input)
    return cleanDecodedText(str)
}

function stripRTFHeader(input: string): string {
    const textStart = input.indexOf("\\ltrch")
    if (textStart > -1) return input.slice(input.indexOf(" ", textStart), input.length)

    // Remove main RTF styles at the top of the document.
    let paragraphs = input.split("\n\n")
    if (paragraphs[0].includes("rtf")) {
        paragraphs = paragraphs.slice(1)
        input = paragraphs.join("\n\n")
        input = input.slice(0, input.length - 1)
    }
    return input
}

function decodeHexBody(input: string): string {
    const hex = input.split("\\'")
    let str = ""
    hex.forEach((txt, i) => {
        txt = txt.replaceAll("\r\n", "")

        // Fix skipping first word: if a line break precedes the paragraph formatting,
        // discard everything before the break.
        const breakPos = txt.indexOf("\n")
        const lineFormattingPos = txt.indexOf("\\f0")
        if (breakPos >= 0 && lineFormattingPos >= 0 && lineFormattingPos < breakPos) txt = txt.slice(breakPos)

        txt = stripInlineStyles(txt)

        if (i === 0) str = txt
        else {
            str += String.fromCharCode(parseInt(txt.slice(0, 2), 16))
            str += txt.slice(2)
        }
    })
    return str
}

function stripInlineStyles(txt: string): string {
    let styleIndex = txt.indexOf("\\")
    while (styleIndex >= 0) {
        let nextSpace = txt.indexOf(" ", styleIndex)
        if (nextSpace < 1) nextSpace = txt.length
        txt = txt.slice(0, styleIndex) + txt.slice(nextSpace)
        styleIndex = txt.indexOf("\\")
    }
    return txt
}

function cleanDecodedText(str: string): string {
    str = str.replaceAll("}{", "<br>").replaceAll("} {", "<br>").replaceAll("}  {", "<br>").replaceAll("{ }", "")

    // Remove any leading {{ within the first three characters.
    if (str.indexOf("{{") > -1 && str.indexOf("{{") < 3) str = str.slice(str.indexOf("{{") + 2)

    str = str.trim()

    // Remove trailing } and special chars.
    if (str.length - str.lastIndexOf("}") < 3) str = str.slice(0, str.lastIndexOf("}"))
    str = str.trim()

    while (str.indexOf("<br>") === 0) str = str.slice(4)
    return str
}

function rgbStringToHex(rgbaString: string): string {
    if (typeof rgbaString !== "string") return ""
    // TODO: honor alpha
    const [r, g, b]: string[] = rgbaString.split(" ")
    if (isNaN(+r) || isNaN(+g) || isNaN(+b)) return ""

    return `#${toHex(+r * 255)}${toHex(+g * 255)}${toHex(+b * 255)}`
}

const toHex = (c: number) => ("0" + Number(c.toFixed()).toString(16)).slice(-2)

// ----- Pro7 (JSON) -----

function convertProToSlides(song: any): ConvertedShow {
    const slides: Record<string, Slide> = {}
    const media: Record<string, any> = {}
    const layouts: any[] = []
    const tempLayouts: Record<string, SlideData> = {}
    const idMap = new Map<string, string>()

    const tempSlides = getSlides(song.cues || [])
    const tempGroups = getGroups(song.cueGroups || [])
    const tempArrangements = getArrangements(song.arrangements || [])

    if (!tempArrangements.length) {
        tempArrangements.push({ groups: Object.keys(tempGroups), name: "" })
    }

    // Slides not referenced by any group still need to exist in `tempLayouts`
    // so id lookups (e.g., from the timeline) resolve.
    const slidesWithoutGroup = Object.keys(tempSlides).filter((id) => !Object.values(tempGroups).find((g: any) => g.slides.includes(id)))
    slidesWithoutGroup.forEach((id) => createSlide(id))

    tempArrangements.forEach(({ name = "", groups: arrGroups }: any) => {
        layouts.push({ id: uid(), name, notes: "", slides: createLayoutSlides(arrGroups) })
    })

    function createLayoutSlides(arrGroups: string[]): SlideData[] {
        const layoutSlides: SlideData[] = []

        arrGroups.forEach((groupId) => {
            const group = tempGroups[groupId]
            if (!group) return

            const allSlides = group.slides.map((id: string, i: number) => createSlide(id, i === 0, { color: group.color, name: group.name }))
            if (allSlides.length > 1) {
                slides[allSlides[0].id].children = allSlides.slice(1).map(({ id }: SlideData) => id)
            }

            layoutSlides.push(allSlides[0])
        })

        return layoutSlides
    }

    function createSlide(id: string, isParent = true, { color, name }: { color?: string; name?: string } = {}): SlideData {
        if (tempLayouts[id]) return tempLayouts[id]

        const slideId = uid()
        const layoutSlide: SlideData = { id: slideId }
        idMap.set(id, slideId)

        const tempSlide = tempSlides[id]
        if (!tempSlide) return layoutSlide

        if (tempSlide.disabled) layoutSlide.disabled = true

        if (tempSlide.media) {
            const mediaId = uid()
            const path = tempSlide.media
            media[mediaId] = { name: getFileName(path), path, type: getMediaType(getExtension(path)) }
            layoutSlide.background = mediaId
        }

        const slide: Slide = {
            group: null,
            color: null,
            settings: {
                background: tempSlide.backgroundColor,
                resolution: tempSlide.size
            },
            notes: "",
            items: tempSlide.items.map(convertItem)
        }

        if (isParent) {
            const group = name || tempSlide.name || ""
            const globalGroup = getGlobalGroup(group)
            slide.color = color || ""
            slide.group = group
            if (globalGroup) slide.globalGroup = globalGroup
        }

        slides[slideId] = slide
        tempLayouts[id] = layoutSlide
        return layoutSlide
    }

    const timeline = buildTimeline(song.timeline?.cues || [], layouts, slides, idMap)
    if (timeline) layouts[0].timeline = timeline

    return { slides, layouts, media }
}

function buildTimeline(cues: any[], layouts: any[], slides: Record<string, Slide>, idMap: Map<string, string>): Timeline | null {
    if (!cues.length || !layouts[0]) return null

    const slideIndexMap: string[] = []
    layouts[0].slides.forEach((slide: SlideData) => {
        slideIndexMap.push(slide.id)
        if (slides[slide.id].children) slideIndexMap.push(...(slides[slide.id].children || []))
    })

    let currentIndex = -1
    const actions = cues
        .map((cue) => {
            const id = idMap.get(cue.cueId?.string) || cue.cueId?.string
            if (!id) return null

            // Prefer the next occurrence at or after the current playhead so that
            // repeated slides on the timeline stay in order.
            let slideIndex = slideIndexMap.findIndex((slideId, i) => slideId === id && i >= currentIndex)
            if (slideIndex === -1) slideIndex = slideIndexMap.findIndex((slideId) => slideId === id)
            currentIndex = slideIndex

            return {
                id: uid(6),
                time: (cue.triggerTime || 0) * 1000,
                name: cue.name || "",
                type: "slide",
                data: {
                    id,
                    index: slideIndex > -1 ? slideIndex : undefined
                }
            }
        })
        .filter(Boolean)

    return { actions } as Timeline
}

function convertItem(item: any): Item {
    return {
        style: getItemStyle(item),
        lines: (item.text as string).split("\n").map((lineText) => ({ align: "", text: [{ value: lineText, style: "" }] }))
    }
}

function getItemStyle(item: any): string {
    const bounds = item.bounds
    if (!bounds) return DEFAULT_ITEM_STYLE

    const { origin: pos, size } = bounds
    if (Object.keys(pos).length !== 2 || Object.keys(size).length !== 2) return DEFAULT_ITEM_STYLE

    return `left:${pos.x}px;top:${pos.y}px;width:${size.width}px;height:${size.height}px;`
}

function getArrangements(arrangements: any): any[] {
    if (!Array.isArray(arrangements)) return []

    return arrangements
        .map((arr) => ({
            name: arr.name,
            groups: arr.groupIdentifiers?.map((a: any) => a.string) || []
        }))
        .filter((a) => a.groups.length)
}

function getGroups(cueGroups: any): Record<string, any> {
    if (!Array.isArray(cueGroups)) return {}

    const newGroups: Record<string, any> = {}
    cueGroups.forEach(({ group, cueIdentifiers }: any) => {
        newGroups[group.uuid.string] = {
            name: group.name,
            color: getColorValue(group.color),
            slides: cueIdentifiers?.map((a: any) => a.string) || []
        }
    })

    return newGroups
}

function getSlides(cues: any): Record<string, any> {
    const slides: Record<string, any> = {}
    if (!Array.isArray(cues)) return slides

    cues.forEach((slide: any) => {
        const baseSlide = slide.actions?.find((a: any) => a.slide?.presentation)?.slide?.presentation?.baseSlide || {}
        if (!baseSlide) return

        slides[slide.uuid.string] = {
            name: slide.name,
            disabled: !slide.isEnabled,
            media: slide.actions?.find((a: any) => a.media?.element)?.media?.element?.url?.absoluteString,
            backgroundColor: getColorValue(baseSlide.backgroundColor),
            size: baseSlide.size,
            items: baseSlide.elements?.map(getItem) || []
        }
    })

    return slides
}

function getItem(item: any) {
    return {
        bounds: item.element.bounds,
        text: decodeRTF(item.element.text?.rtfData)
    }
}

function decodeRTF(text: string): string {
    if (!text) return ""
    return RTFToText(decodeBase64(text))
}

function getColorValue(color: { red: number; green: number; blue: number; alpha: number }): string {
    if (!color) return ""

    const rgba = {
        red: color.red || 255,
        green: color.green || 255,
        blue: color.blue || 255,
        alpha: color.alpha || 1
    }

    return `rgb(${rgba.red.toFixed(2)} ${rgba.green.toFixed(2)} ${rgba.blue.toFixed(2)} / ${rgba.alpha.toFixed(1)})`
}
