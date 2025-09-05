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

    const fonts = await window.queryLocalFonts()

    let families: { [key: string]: FontData[] } = {}
    fonts.forEach((font) => {
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

        let previousStyleNames: string[] = []
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

    const weightMap: { [key: string]: string } = {
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

    // prioritize more specific matches by checking longest keys first
    const sortedWeightKeys = Object.keys(weightMap).sort((a, b) => b.length - a.length)
    let fontWeight = "400" // Default

    for (const key of sortedWeightKeys) {
        if (lowerStyle.includes(key)) {
            fontWeight = weightMap[key]
            break
        }
    }

    const isCondensed = /condensed|narrow/.test(lowerStyle)
    const stretch = isCondensed ? "condensed " : ""

    return `font: ${fontStyle} ${fontWeight} ${stretch}1em '${fontData.family}';`
}

// web fonts
const defaultFonts = ["CMGSans", "Arial", "Verdana", "Tahoma", "Trebuchet MS", "Times New Roman", "Georgia", "Garamond", "Courier New", "Brush Script MT", "Helvetica", "Fantasy", "monospace"]
// does not work with ''
const noQuotes = ["Fantasy", "monospace"]
function getFontName(value: string) {
    if (!value) return ""
    if (noQuotes.includes(value)) return value
    return `'${value}'`
}

export async function getSystemFontsList() {
    // { family: "CMGSans", default: 0, fonts: [{ name: "CMGSans", path: "", style: "", css: "font: 1em 'CMGSans'" }] }
    const fonts: Family[] = defaultFonts.map((name) => {
        const css = `font: 1em ${getFontName(name)}`
        return { family: name, default: 0, fonts: [{ name, path: "", style: "", css }] }
    })

    let loadedFonts = await getFontsList()
    if (!loadedFonts.length) return []

    return addFonts(fonts, loadedFonts).map((a) => ({ label: a.family, value: a.family, style: a.fonts[a.default]?.css || (a.family ? `font-family: ${a.family};` : "") }))
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

    let existingValues: string[] = [defaultValue]
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
export function loadCustomFonts(fonts: { name: string; path: string }[]) {
    fonts.forEach((font) => {
        // try loading from Google Fonts
        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = "https://fonts.googleapis.com/css2?family=" + font.name + ":wght@400;700&display=swap"
        document.head.appendChild(link)

        // fetch(font.path)
        // .then(res => res.arrayBuffer())
        // .then(buffer => {
        //     const font = new FontFace(font.name, buffer)
        //     return font.load()
        // })
        // .then(font => {
        //     document.fonts.add(font)
        //     console.log('Font loaded from binary!')
        // })
    })
}