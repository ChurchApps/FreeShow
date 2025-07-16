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
