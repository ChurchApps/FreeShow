// osr-capture GPU formats: 5 = 8-bit 2vuy BT.709, 6 = 2vuy BT.601, 7 = v210 BT.709, 8 = v210 BT.601 (limited range).
// 0 = not a GPU format (RGB modes, or keying, which needs alpha).
export function cardFormat(pixelFormat: string, colorSpace: string, enableKeying: boolean): number {
    if (enableKeying || !pixelFormat.includes("YUV")) return 0
    const cs = colorSpace.toLowerCase()
    const bt601 = cs.includes("601") || cs.includes("170")
    return (pixelFormat.includes("10") ? 7 : 5) + (bt601 ? 1 : 0)
}

// v210 rows are padded to 128 bytes (48 pixels)
export function cardFrameBytes(width: number, height: number, format: number): number {
    if (format === 7 || format === 8) return Math.ceil(width / 48) * 128 * height
    return width * height * 2
}
