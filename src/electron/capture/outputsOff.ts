// Outputs the user has turned off, as the capture worker knows them. An off output stays connected, but
// everything it sends goes dark: black in place of the picture (fully transparent for a transparent
// output, so a keyed graphic disappears instead of covering the program) and silence in place of sound.
// Main owns the state (OutputLifecycle.setOutputOn) and posts the full list whenever it changes.

import { cardFrameBytes } from "../blackmagic/cardFormat"

export const outputsOff = new Set<string>()

export function setOutputsOff(ids: string[]) {
    outputsOff.clear()
    for (const id of ids) outputsOff.add(id)
}

// planes per format: 0 BGRA, 1 UYVY, 2 UYVA (UYVY + alpha plane), 3 RGBA, 4 I420. UYVY/UYVA are BT.601 full
// range and I420 is BT.601 limited range, matching the converters that produce the real frames.
export function blankFrame(width: number, height: number, format: number, transparent: boolean): Buffer {
    const px = width * height
    if (format === 1 || format === 2) {
        const buf = Buffer.alloc(px * 2 + (format === 2 ? px : 0))
        for (let i = 0; i < px * 2; i += 2) buf[i] = 128
        return buf
    }
    // the SDI card formats (cardFormat.ts), limited range: Y 16 (64), chroma 128 (512)
    if (format === 5 || format === 6) {
        const buf = Buffer.alloc(px * 2, 16)
        for (let i = 0; i < px * 2; i += 2) buf[i] = 128
        return buf
    }
    if (format === 7 || format === 8) {
        const buf = Buffer.alloc(cardFrameBytes(width, height, format))
        // each 6-pixel group: chroma 512 and luma 64 in the v210 word order
        const words = [512 | (64 << 10) | (512 << 20), 64 | (512 << 10) | (64 << 20), 512 | (64 << 10) | (512 << 20), 64 | (512 << 10) | (64 << 20)]
        for (let i = 0; i + 16 <= buf.length; i += 16) for (let k = 0; k < 4; k++) buf.writeUInt32LE(words[k], i + k * 4)
        return buf
    }
    if (format === 4) {
        const chroma = Math.floor(width / 2) * Math.floor(height / 2)
        const buf = Buffer.alloc(px + chroma * 2, 128)
        buf.fill(16, 0, px)
        return buf
    }
    const buf = Buffer.alloc(px * 4)
    if (!transparent) for (let i = 3; i < buf.length; i += 4) buf[i] = 255
    return buf
}
