// https://clrs.cc/
export const defaultColors = [
    { name: "White", value: "#FFFFFF" },
    { name: "Silver", value: "#DDDDDD" },
    { name: "Gray", value: "#AAAAAA" },
    { name: "Red", value: "#FF4136" },
    { name: "Orange", value: "#FF851B" },
    { name: "Yellow", value: "#FFDC00" },
    { name: "Green", value: "#2ECC40" },
    { name: "Lime", value: "#01FF70" },
    { name: "Olive", value: "#3D9970" },
    { name: "Teal", value: "#39CCCC" },
    { name: "Aqua", value: "#7FDBFF" },
    { name: "Blue", value: "#0074D9" },
    { name: "Navy", value: "#001f3f" },
    { name: "Purple", value: "#B10DC9" },
    { name: "Fuchsia", value: "#F012BE" },
    { name: "Maroon", value: "#85144b" },
    { name: "Black", value: "#000000" },
]

export const defaultGradients = [
    // Single
    // { name: "White", value: "linear-gradient(120deg, #FFFFFF 0%, #DDDDDD 60%, #AAAAAA 100%)" },
    { name: "Silver", value: "linear-gradient(120deg, #DDDDDD 0%, #BBBBBB 60%, #999999 100%)" },
    // { name: "Gray", value: "linear-gradient(120deg, #AAAAAA 0%, #888888 60%, #666666 100%)" },
    { name: "Red", value: "linear-gradient(120deg, #FF4136 0%, #C7002D 60%, #800020 100%)" },
    { name: "Orange", value: "linear-gradient(120deg, #FF851B 0%, #E06A00 60%, #A34700 100%)" },
    { name: "Yellow", value: "linear-gradient(120deg, #FFDC00 0%, #D4AF00 60%, #A18600 100%)" },
    { name: "Green", value: "linear-gradient(120deg, #2ECC40 0%, #1F9E2E 60%, #156F20 100%)" },
    // { name: "Lime", value: "linear-gradient(120deg, #01FF70 0%, #00CC58 60%, #009944 100%)" },
    // { name: "Olive", value: "linear-gradient(120deg, #3D9970 0%, #2E7354 60%, #204F39 100%)" },
    { name: "Teal", value: "linear-gradient(120deg, #39CCCC 0%, #2CA0A0 60%, #1E7575 100%)" },
    { name: "Aqua", value: "linear-gradient(120deg, #7FDBFF 0%, #52B8E6 60%, #2985B5 100%)" },
    { name: "Blue", value: "linear-gradient(120deg, #0074D9 0%, #0051A3 60%, #00346C 100%)" },
    // { name: "Navy", value: "linear-gradient(120deg, #001f3f 0%, #00152C 60%, #000A19 100%)" },
    { name: "Purple", value: "linear-gradient(120deg, #B10DC9 0%, #8A0AA4 60%, #5F0578 100%)" },
    // { name: "Fuchsia", value: "linear-gradient(120deg, #F012BE 0%, #C00999 60%, #900572 100%)" },
    // { name: "Maroon", value: "linear-gradient(120deg, #85144b 0%, #5E0F35 60%, #3D0A23 100%)" },
    { name: "Black", value: "linear-gradient(120deg, #000000 0%, #222222 60%, #444444 100%)" },
    // Multiple
    { name: "Pink to Purple", value: "linear-gradient(120deg,rgba(255,128,212, 1) 0%,rgba(193,47,106, 1) 62%,rgba(167,19,45, 1) 100%)" },
    { name: "Blue to Purple", value: "linear-gradient(120deg, #7FDBFF 0%, #c74076 62%, #b91533 100%)" },
    { name: "Orange to Purple", value: "linear-gradient(120deg, #FF851B 0%, #c74076 62%, #b91533 100%)" },
    // Radial
    { name: "Purple Circle", value: "radial-gradient(circle, #A73537 0%, #AB087D 50%, #7C1DE8 100%)" },
    { name: "Blue Circle", value: "radial-gradient(circle, #39CCCC 0%, #0074D9 50%, #001f3f 100%)" },
]

export function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)

    return {
        r: result ? parseInt(result[1], 16) : 0,
        g: result ? parseInt(result[2], 16) : 0,
        b: result ? parseInt(result[3], 16) : 0,
    }
}

export function splitRgb(rgb: string) {
    const numbers = rgb.replace(/[^\d. ]+/g, "").replaceAll("  ", " ")
    const splitted = numbers.split(" ")

    return {
        r: Number(splitted[0] ?? 0),
        g: Number(splitted[1] ?? 0),
        b: Number(splitted[2] ?? 0),
        a: Number(splitted[3] ?? 1),
    }
}

export function getContrast(hex: string) {
    let color = "#FFFFFF"
    const rgb = hexToRgb(hex)
    if (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114 > 186) color = "#000000"
    return color
}

// GRADIENT

// split gradient value
export function splitGradientValue(gradientStr: string) {
    const result = {
        type: "",
        deg: 0,
        shape: "circle",
        colors: [] as { color: string; pos: number }[],
    }

    // remove whitespace and the trailing semicolon if present
    gradientStr = gradientStr.trim().replace(/;$/, "")

    // get type
    const typeMatch = gradientStr.match(/^([a-zA-Z-]+)\(/)
    if (!typeMatch) return result
    result.type = typeMatch[1]

    // const gradientRegex = /^(\w+-gradient)\(([^)]+)\)$/
    // const match = gradientStr.match(gradientRegex)
    // if (!match) return result
    // result.type = match[1] // e.g. "linear-gradient"
    // const inner = match[2] // everything inside the parentheses

    // extract inside of parentheses
    const openParenIndex = gradientStr.indexOf("(")
    const content = gradientStr.slice(openParenIndex + 1, -1) // remove outer parentheses

    // split components (angle + color stops)
    const parts: string[] = []
    let buffer = ""
    let depth = 0

    for (let char of content) {
        if (char === "(") depth++
        if (char === ")") depth--
        if (char === "," && depth === 0) {
            parts.push(buffer.trim())
            buffer = ""
        } else {
            buffer += char
        }
    }
    if (buffer) parts.push(buffer.trim())

    // Linear-gradient: look for angle
    if (result.type === "linear-gradient") {
        const angleRegex = /^(\d+(?:\.\d+)?)(deg)?$/i
        if (angleRegex.test(parts[0])) {
            result.deg = parseFloat(parts[0])
            parts.shift()
        } else {
            result.deg = 180 // default
        }
    }

    // Radial-gradient: look for shape/size
    if (result.type === "radial-gradient") {
        const shapeKeywords = ["circle", "ellipse"]
        if (shapeKeywords.includes(parts[0].toLowerCase())) {
            result.shape = parts[0].toLowerCase()
            parts.shift()
        } else {
            result.shape = "ellipse" // CSS default
        }
    }

    // Normalize rgb(...) to rgba(...)
    function normalizeColor(colorStr) {
        if (/^rgb\(/i.test(colorStr)) {
            const inside = colorStr.slice(4, -1).trim()
            const values = inside.includes(",") ? inside.split(",") : inside.split(/\s+/)
            if (values.length === 3) {
                return `rgba(${values.join(",")}, 1)`
            } else if (values.length === 4) {
                return `rgba(${values.join(",")})`
            }
        }
        return colorStr.trim()
    }

    // Parse color stops
    for (const part of parts) {
        const lastSpaceIndex = part.lastIndexOf(" ")
        let color,
            pos = 0

        if (lastSpaceIndex !== -1 && /[\d.]+%$/.test(part.slice(lastSpaceIndex + 1))) {
            color = part.slice(0, lastSpaceIndex).trim()
            pos = parseFloat(part.slice(lastSpaceIndex + 1))
        } else {
            color = part.trim()
        }

        color = normalizeColor(color)
        result.colors.push({ color, pos })
    }

    return result
}
