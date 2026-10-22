// The SDI card formats osr-capture produces on the GPU (osr_readback.h): 5 = 8-bit '2vuy' BT.709, 6 = the
// same BT.601, 7 = 10-bit v210 BT.709, 8 = v210 BT.601, all limited range as SDI carries them. 0 when the
// card's mode is not one of these (RGB modes, or a keyer, which needs the alpha the YUV modes do not have).
export function cardFormat(pixelFormat: string, colorSpace: string, enableKeying: boolean): number {
    if (enableKeying || !pixelFormat.includes("YUV")) return 0
    const cs = colorSpace.toLowerCase()
    const bt601 = cs.includes("601") || cs.includes("170")
    return (pixelFormat.includes("10") ? 7 : 5) + (bt601 ? 1 : 0)
}

// bytes of one frame in a card format: v210 rows are padded to 128 bytes (48 pixels), as the card expects
export function cardFrameBytes(width: number, height: number, format: number): number {
    if (format === 7 || format === 8) return Math.ceil(width / 48) * 128 * height
    return width * height * 2
}
