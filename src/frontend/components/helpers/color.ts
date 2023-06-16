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
