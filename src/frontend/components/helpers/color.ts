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
    { name: "Black", value: "#000000" }
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
    { name: "Red to Purple", value: "linear-gradient(145deg, #FF4136 0%, #B10DC9 100%)" },
    { name: "Green to Purple", value: "linear-gradient(145deg, #3D9970 0%, #B10DC9 100%)" },
    { name: "Orange to Red", value: "linear-gradient(120deg, #FF851B 0%, #b91533 70%)" },
    { name: "Green To Blue", value: "linear-gradient(145deg, #01FF70 0%, #24ffd3 40%, #39CCCC 80%)" },
    { name: "Red to Cyan", value: " linear-gradient(145deg, #FF4136 0%, #f69351 20%, #2aeaba 70%, #7FDBFF 100%)" },
    { name: "Red, White, Blue", value: "linear-gradient(90deg, #FF4136 10%, #ff94cd 30%, #FFFFFF 50%, #7FDBFF 70%, #0074D9 90%)" },
    // Radial
    { name: "Purple Circle", value: "radial-gradient(circle, #4998d4 10%, #7a2ad5 50%, #a808aa 90%)" },
    { name: "Blue Circle", value: "radial-gradient(circle, #39CCCC 0%, #0074D9 50%, #001f3f 100%)" }
]

export function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)

    return {
        r: result ? parseInt(result[1], 16) : 0,
        g: result ? parseInt(result[2], 16) : 0,
        b: result ? parseInt(result[3], 16) : 0
    }
}

export function splitRgb(rgb: string) {
    const numbers = rgb.replace(/[^\d. ]+/g, "").replaceAll("  ", " ")
    const splitted = numbers.split(" ")

    return {
        r: Number(splitted[0] ?? 0),
        g: Number(splitted[1] ?? 0),
        b: Number(splitted[2] ?? 0),
        a: Number(splitted[3] ?? 1)
    }
}

export function getContrast(hex: string) {
    let color = "#FFFFFF"
    const rgb = hexToRgb(hex)
    if (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114 > 186) color = "#000000"
    return color
}

// GRADIENT

export function splitGradientValue(gradientStr: string) {
    const result = {
        type: "",
        deg: 0,
        shape: "circle",
        colors: [] as { color: string; pos: number | null }[]
    }

    // remove trailing ;
    gradientStr = gradientStr.trim().replace(/;$/, "")

    // get gradient type
    const typeMatch = gradientStr.match(/^([a-zA-Z-]+)\(/)
    if (!typeMatch) return result
    result.type = typeMatch[1]

    const inner = gradientStr.slice(gradientStr.indexOf("(") + 1, -1)

    // Split components safely accounting for nested parentheses
    const parts: string[] = []
    let buffer = ""
    let depth = 0
    for (const char of inner) {
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

    // linear-gradient: optional angle
    if (result.type === "linear-gradient") {
        const angle = parts[0]?.match(/^(\d+(?:\.\d+)?)deg$/i)
        if (angle) {
            result.deg = parseFloat(angle[1])
            parts.shift()
        } else {
            result.deg = 180
        }
    }

    // radial-gradient: optional shape
    if (result.type === "radial-gradient") {
        const shape = parts[0]?.toLowerCase()
        if (shape === "circle" || shape === "ellipse") {
            result.shape = shape
            parts.shift()
        } else {
            result.shape = "ellipse"
        }
    }

    // Normalize rgb to rgba
    const normalizeColor = (str: string) => {
        const rgbMatch = str.match(/^rgb\(([^)]+)\)$/i)
        if (!rgbMatch) return str.trim()
        const vals = rgbMatch[1].split(/[\s,]+/).map((s) => s.trim())
        return vals.length === 3 ? `rgba(${vals.join(",")}, 1)` : `rgba(${vals.join(",")})`
    }

    // Parse color stops
    for (const stop of parts) {
        const match = stop.match(/^(.*?)(?:\s+([\d.]+)%)?$/)
        if (match) {
            const color = normalizeColor(match[1])
            const pos = match[2] ? parseFloat(match[2]) : null
            result.colors.push({ color, pos })
        }
    }

    // Auto-assign positions if missing
    const total = result.colors.length
    const hasAllPositions = result.colors.every((c) => c.pos !== null)
    if (!hasAllPositions) {
        for (let i = 0; i < total; i++) {
            if (result.colors[i].pos === null) {
                if (i === 0) {
                    result.colors[i].pos = 0
                } else if (i === total - 1) {
                    result.colors[i].pos = 100
                } else {
                    result.colors[i].pos = parseFloat(((100 / (total - 1)) * i).toFixed(2))
                }
            }
        }
    }

    return result
}
