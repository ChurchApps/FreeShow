export interface Family {
    family: string
    default: number
    fonts: Font[]
}
export interface Font {
    name: string
    style: string
    css: string
}

// "Regular"
const commonStyles = ["Bold", "Italic", "Bold Italic"]

let cachedFonts: Family[] = []
export async function getFontsList() {
    if (cachedFonts.length) return cachedFonts

    const localFonts = await window.queryLocalFonts()

    const families: { [key: string]: FontData[] } = {}
    localFonts.forEach((font) => {
        if (!families[font.family]) families[font.family] = []
        families[font.family].push(font)
    })

    const fontFamilies: Family[] = []

    Object.values(families).forEach((familyFonts) => {
        let newFamilyFonts = familyFonts.filter((a) => {
            // remove styles that can already be changed
            return !commonStyles.includes(a.style)
        })

        if (!newFamilyFonts.length) newFamilyFonts = [familyFonts[0]]

        const previousStyleNames: string[] = []
        const fonts: Font[] = newFamilyFonts.map((a) => {
            let style = a.style

            let fontName = a.fullName
            if (newFamilyFonts.length === 1) fontName = a.family

            if (previousStyleNames.includes(style)) style = fontName
            previousStyleNames.push(style)

            return {
                name: fontName, // used by actual text style
                style, // style name
                css: fontDataToCssString(a) // actual preview style
            }
        })

        let defaultIndex = newFamilyFonts.findIndex((a) => a.style.toLowerCase().includes("regular") || a.style.toLowerCase().includes("normal"))
        if (defaultIndex < 0) defaultIndex = 0

        fontFamilies.push({
            family: newFamilyFonts[0].family,
            default: defaultIndex,
            fonts
        })
    })

    cachedFonts = fontFamilies
    return fontFamilies
}

function fontDataToCssString(fontData: FontData) {
    const lowerStyle = fontData.style.toLowerCase()

    const fontStyle = /italic/.test(lowerStyle) ? "italic" : "normal"

    const fontWeight = getWeightFromStyle(lowerStyle)

    const isCondensed = /condensed|narrow/.test(lowerStyle)
    const stretch = isCondensed ? "condensed " : ""

    return `font: ${fontStyle} ${fontWeight} ${stretch}1em '${fontData.family}';`
}

const WEIGHT_MAP: { [key: string]: string } = {
    black: "900",
    extrabold: "800",
    bold: "700",
    semibold: "600",
    medium: "500",
    normal: "400",
    regular: "400",
    semilight: "300",
    light: "300",
    extralight: "200",
    thin: "100"
}

function getWeightFromStyle(style: string | undefined) {
    if (!style) return "400"

    const lower = style.toLowerCase()
    // prioritize more specific matches by checking longest keys first
    const keys = Object.keys(WEIGHT_MAP).sort((a, b) => b.length - a.length)
    for (const k of keys) {
        if (lower.includes(k)) return WEIGHT_MAP[k]
    }

    return "400"
}

// web fonts
const defaultFonts = ["CMGSans", "Arial", "Verdana", "Tahoma", "Trebuchet MS", "Times New Roman", "Georgia", "Garamond", "Courier New", "Brush Script MT", "Helvetica", "Fantasy", "monospace"]
// does not work with ''
const noQuotes = ["Fantasy", "monospace"]
export function getFontName(value: string) {
    if (!value) return ""
    if (noQuotes.includes(value) || value.startsWith("'")) return value
    return `'${value}'`
}

export async function getSystemFontsList() {
    // { family: "CMGSans", default: 0, fonts: [{ name: "CMGSans", path: "", style: "", css: "font: 1em 'CMGSans'" }] }
    const fonts: Family[] = defaultFonts.map((name) => {
        const css = `font: 1em ${getFontName(name)}`
        return { family: name, default: 0, fonts: [{ name, path: "", style: "", css }] }
    })

    const loadedFonts = await getFontsList()
    if (!loadedFonts.length) return []

    return addFonts(fonts, loadedFonts).map((a) => ({ label: a.family, value: getFontName(a.family), style: a.fonts[a.default]?.css || (a.family ? `font-family: ${getFontName(a.family)};` : "") }))
}
export function getFontStyleList(font: string) {
    if (!cachedFonts.length) return { fontStyles: [], defaultValue: "" }

    const family = cachedFonts.find((a) => a.family === font)
    const fontStyles = (family?.fonts || []).map((a) => ({
        value: a.css
            ?.replace(/^font:\s*(.*);$/, "$1")
            .replace("1em", "100px")
            .trim(),
        label: a.style,
        style: a.css
    }))

    const defaultValue = fontStyles[family?.default || 0]?.value || ""

    const existingValues: string[] = [defaultValue]
    const filteredFontStyles = fontStyles.filter((a) => {
        if (a.value === defaultValue) return true
        if (existingValues.includes(a.value)) return false
        existingValues.push(a.value)
        return true
    })

    return { fontStyles: filteredFontStyles, defaultValue }
}

function addFonts(fonts: Family[], newFonts: Family[]) {
    // join and remove duplicates
    fonts = fonts.filter((font1) => !newFonts.find((font2) => font2.family === font1.family))
    fonts = [...newFonts, ...fonts]
    // sort
    fonts = fonts.sort((a, b) => a.family.localeCompare(b.family))
    // add default app font
    // if (system) {
    //     const noFont = { family: "", default: 0, fonts: [{ name: "", path: "", style: "", css: "" }] }
    //     fonts = [noFont, ...fonts]
    // }

    return fonts
}

// PPT import

// normalize local file path to a proper file URL
function filePathToURL(filePath: string) {
    if (!filePath || /^file:\/\//i.test(filePath)) return filePath

    let fileUrl = filePath.replace(/\\/g, "/").replace(/\0/g, "")
    if (/^[A-Za-z]:\//.test(fileUrl)) fileUrl = "/" + fileUrl
    return "file://" + encodeURI(fileUrl)
}

export function loadCustomFonts(fonts: { name: string; path: string }[]) {
    fonts.forEach(async (font) => {
        try {
            const fileUrl = filePathToURL(font.path)

            const response = await fetch(fileUrl)
            const arrayBuffer = await response.arrayBuffer()
            const fontData = extractFontInfo(arrayBuffer)
            if (!fontData?.family) throw new Error("Unknown font format")

            // create the FontFace from the detected SFNT offset
            const start = typeof fontData.offset === "number" ? fontData.offset : 0
            const source = new Uint8Array(arrayBuffer, start)

            const fontStyle = /italic/.test((fontData.subfamily || fontData.fullName || "").toLowerCase()) ? "italic" : "normal"
            const weight = (fontData as any).weight || getWeightFromStyle((fontData.subfamily || fontData.fullName || "").toLowerCase())

            const fnt = new (FontFace as any)(fontData.family, source, { weight: String(weight), style: fontStyle })
            await fnt.load()
            document.fonts.add(fnt)
        } catch {
            if (font.name.includes("font")) return

            // try loading from Google Fonts
            const link = document.createElement("link")
            link.rel = "stylesheet"
            link.href = "https://fonts.googleapis.com/css2?family=" + font.name + ":wght@400;700&display=swap"
            document.head.appendChild(link)
        }
    })
}

function extractFontInfo(arrayBuffer) {
    const view = new DataView(arrayBuffer)
    const bytes = new Uint8Array(arrayBuffer)
    const sfnt = findSFNT(bytes)
    if (!sfnt) return null

    const hOff = sfnt.offset
    const numTables = view.getUint16(hOff + 4)
    const tables: { [key: string]: { offset: number; len: number } } = {}

    // map all tables
    for (let i = 0; i < numTables; i++) {
        const o = hOff + 12 + i * 16
        const tag = Array.from({ length: 4 }, (_, j) => String.fromCharCode(view.getUint8(o + j))).join("")
        tables[tag] = { offset: view.getUint32(o + 8), len: view.getUint32(o + 12) }
    }

    if (!tables.name) return null

    // parse name table
    const nOff = hOff + tables.name.offset
    const count = view.getUint16(nOff + 2)
    const sOff = view.getUint16(nOff + 4)
    const names: { [key: number]: string } = {}

    for (let i = 0; i < count; i++) {
        const r = nOff + 6 + i * 12
        const pID = view.getUint16(r)
        const nID = view.getUint16(r + 6)
        const len = view.getUint16(r + 8)
        const start = nOff + sOff + view.getUint16(r + 10)

        if (start + len > bytes.length) continue

        const decoder = pID === 3 || pID === 0 ? "utf-16be" : "latin1"
        names[nID] = new TextDecoder(decoder).decode(bytes.subarray(start, start + len))
    }

    // remove subfamily indicators from family name (e.g. "Bold", "Italic") since these are usually represented as separate attributes
    const { 1: family, 2: sub, 4: full } = names
    let normFamily = (family || full || "").trim()
    if (sub && normFamily.endsWith(" " + sub.trim())) {
        normFamily = normFamily.replace(new RegExp(`\\s+${sub.trim()}$`), "")
    }

    // get weight (OS/2 usWeightClass)
    let weight = tables["OS/2"] ? view.getUint16(hOff + tables["OS/2"].offset + 4) : getWeightFromStyle((sub || full || "").toLowerCase())

    return { type: sfnt.type, offset: hOff, family: normFamily, subfamily: sub, fullName: full, weight: String(weight) }
}

// get first occurrence of known signatures
function findSFNT(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const signatures = {
        0x4f54544f: "opentype", // OTTO
        0x00010000: "truetype", // 0x00010000
        0x74727565: "truetype", // true
        0x74746366: "ttc", // ttcf
        0x774f4646: "woff", // wOFF
        0x774f4632: "woff2" // wOF2
    }

    // prioritized return order (if multiple are found in the same buffer)
    const priority = ["opentype", "ttc", "truetype", "woff", "woff2"]
    const found = {}

    // jump 1 byte at a time but read 4 bytes as one int32
    for (let i = 0; i < bytes.length - 4; i++) {
        const sig = view.getUint32(i)
        const type = signatures[sig]

        if (type && found[type] === undefined) {
            found[type] = i
            if (type === priority[0]) break
        }
    }

    const bestType = priority.find((t) => found[t] !== undefined)
    return bestType ? { offset: found[bestType], type: bestType } : null
}
