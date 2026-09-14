// Shared frame handling for the NDI and OMT receive paths: full-resolution frames to the output windows
// that render them, and a small copy to the app window, which only ever previews the stream.

export type StreamFrameFormat = "uyvy" | "rgba" | "bgra"
export type StreamFrame = { xres: number; yres: number; data: Buffer; format: StreamFrameFormat }

const BYTES_PER_PIXEL: { [format in StreamFrameFormat]: number } = { uyvy: 2, rgba: 4, bgra: 4 }

// Drop row padding, leaving the pixels in the format the library produced; the renderer converts while drawing.
export function packStreamFrame(data: Buffer, width: number, height: number, stride: number, format: StreamFrameFormat): StreamFrame | null {
    const rowBytes = width * BYTES_PER_PIXEL[format]
    const packed = stride === rowBytes ? data : Buffer.alloc(rowBytes * height)
    if (packed !== data) {
        for (let y = 0; y < height; y++) data.copy(packed, y * rowBytes, y * stride, y * stride + rowBytes)
    }

    if (packed.length < rowBytes * height) return null
    return { xres: width, yres: height, data: packed, format }
}

// Nearest-neighbour shrink to RGBA for the app window's preview, converting only the sampled pixels.
export function previewStreamFrame(full: StreamFrame, maxWidth = 480): StreamFrame {
    const scale = Math.max(1, Math.ceil(full.xres / maxWidth))
    const width = Math.floor(full.xres / scale)
    const height = Math.floor(full.yres / scale)
    const data = Buffer.alloc(width * height * 4)
    const source = full.data

    // BT.709 above SD heights, matching what the capture libraries auto-detect
    const bt709 = full.yres >= 720
    const kr = bt709 ? 1.5748 : 1.402
    const kb = bt709 ? 1.8556 : 1.772
    const gu = bt709 ? 0.1873 : 0.344136
    const gv = bt709 ? 0.4681 : 0.714136
    const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)

    for (let y = 0; y < height; y++) {
        const sourceY = y * scale
        for (let x = 0; x < width; x++) {
            const sourceX = x * scale
            const target = (y * width + x) * 4
            if (full.format === "uyvy") {
                // UYVY packs two pixels per four bytes: U Y0 V Y1
                const pair = sourceX - (sourceX % 2)
                const i = sourceY * full.xres * 2 + pair * 2
                const luma = ((sourceX % 2 === 0 ? source[i + 1] : source[i + 3]) - 16) / 219
                const u = (source[i] - 128) / 224
                const v = (source[i + 2] - 128) / 224
                data[target] = clamp((luma + kr * v) * 255)
                data[target + 1] = clamp((luma - gu * u - gv * v) * 255)
                data[target + 2] = clamp((luma + kb * u) * 255)
            } else {
                const i = (sourceY * full.xres + sourceX) * 4
                const swapped = full.format === "bgra"
                data[target] = source[i + (swapped ? 2 : 0)]
                data[target + 1] = source[i + 1]
                data[target + 2] = source[i + (swapped ? 0 : 2)]
            }
            data[target + 3] = 255
        }
    }
    return { xres: width, yres: height, data, format: "rgba" }
}
