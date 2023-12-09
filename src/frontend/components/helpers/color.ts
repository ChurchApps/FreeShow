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

export function hexToRgb(hex: string) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)

    return {
        r: result ? parseInt(result[1], 16) : 0,
        g: result ? parseInt(result[2], 16) : 0,
        b: result ? parseInt(result[3], 16) : 0,
    }
}

export function splitRgb(rgb: string) {
    let numbers = rgb.replace(/[^\d. ]+/g, "").replaceAll("  ", " ")
    let splitted = numbers.split(" ")

    return {
        r: Number(splitted[0] ?? 0),
        g: Number(splitted[1] ?? 0),
        b: Number(splitted[2] ?? 0),
        a: Number(splitted[3] ?? 1),
    }
}

export function getContrast(hex: string) {
    let color = "#FFFFFF"
    let rgb = hexToRgb(hex)
    if (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114 > 186) color = "#000000"
    return color
}
