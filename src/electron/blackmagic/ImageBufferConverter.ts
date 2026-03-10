/**
 * Image buffer format converters for Blackmagic Design devices
 *
 * Handles conversion between various pixel formats:
 * - 8-bit: RGBA, ARGB, BGRA, RGB, YUV422
 * - 10-bit: YUV (v210), RGB, RGBX, RGBXLE
 * - 12-bit: RGB, RGBLE
 *
 * The converters transform between web canvas formats (RGBA/ARGB/BGRA)
 * and Blackmagic hardware formats for both output and input operations.
 */

import type { Size } from "electron"

function getOutputBuffer(requiredSize: number, outputBuffer?: Buffer): Buffer {
    if (outputBuffer && outputBuffer.length >= requiredSize) return outputBuffer
    return Buffer.allocUnsafe(requiredSize)
}

/**
 * 8-bit image buffer converters for output operations
 */
export class ImageBufferConverter {
    /*  convert from BGRA to ARGB  */
    static BGRAtoARGB(data: Buffer) {
        for (let i = 0; i < data.length; i += 4) {
            const B = data[i]
            const G = data[i + 1]
            const R = data[i + 2]
            const A = data[i + 3]

            data[i] = A
            data[i + 1] = R
            data[i + 2] = G
            data[i + 3] = B
        }
    }

    /**
     * Convert from BGRA to YUV 422 packed (UYVY format)
     * YUV422 packed format: each 2 pixels = 4 bytes (U Y V Y)
     */
    static BGRAtoYUV(data: Buffer, { width, height }: Size, outputBuffer?: Buffer) {
        // YUV422 packed format: each 2 pixels = 4 bytes (U Y V Y)
        const requiredSize = width * height * 2
        const newData = getOutputBuffer(requiredSize, outputBuffer)
        let outIndex = 0

        // Validate input buffer size (should be width * height * 4 for BGRA)
        const expectedInputSize = width * height * 4
        const hasFullInput = data.length >= expectedInputSize
        if (!hasFullInput) {
            console.warn(`Input buffer too small: ${data.length} < ${expectedInputSize}. Frame may be truncated.`)
        }

        // Fast path for complete frames: avoid per-pixel bounds checks.
        if (hasFullInput) {
            for (let y = 0; y < height; y++) {
                const rowBase = y * width * 4
                for (let x = 0; x < width; x += 2) {
                    const i1 = rowBase + x * 4
                    const B1 = data[i1]
                    const G1 = data[i1 + 1]
                    const R1 = data[i1 + 2]

                    // Get second pixel (right), or reuse first for odd widths.
                    let B2 = B1
                    let G2 = G1
                    let R2 = R1
                    if (x + 1 < width) {
                        const i2 = i1 + 4
                        B2 = data[i2]
                        G2 = data[i2 + 1]
                        R2 = data[i2 + 2]
                    }

                    const Y1 = 0.299 * R1 + 0.587 * G1 + 0.114 * B1
                    const U1 = (B1 - Y1) / 1.772 + 128
                    const V1 = (R1 - Y1) / 1.402 + 128

                    const Y2 = 0.299 * R2 + 0.587 * G2 + 0.114 * B2
                    const U2 = (B2 - Y2) / 1.772 + 128
                    const V2 = (R2 - Y2) / 1.402 + 128

                    const U = Math.round((U1 + U2) / 2)
                    const V = Math.round((V1 + V2) / 2)

                    const clampedY1 = Math.min(255, Math.max(0, Math.round(Y1)))
                    const clampedY2 = Math.min(255, Math.max(0, Math.round(Y2)))
                    const clampedU = Math.min(255, Math.max(0, U))
                    const clampedV = Math.min(255, Math.max(0, V))

                    newData[outIndex++] = clampedU
                    newData[outIndex++] = clampedY1
                    newData[outIndex++] = clampedV
                    newData[outIndex++] = clampedY2
                }
            }

            return newData
        }

        // Process pairs of pixels to create UYVY format
        for (let y = 0; y < height; y++) {
            const rowBase = y * width * 4
            for (let x = 0; x < width; x += 2) {
                // Get first pixel (left)
                const i1 = rowBase + x * 4

                // Bounds check
                if (i1 + 4 > data.length) {
                    break
                }

                const B1 = data[i1]
                const G1 = data[i1 + 1]
                const R1 = data[i1 + 2]
                // const A1 = data[i1 + 3] // Alpha, not used

                // Get second pixel (right), or use first pixel if at width boundary
                let B2 = B1
                let G2 = G1
                let R2 = R1
                if (x + 1 < width) {
                    const i2 = i1 + 4
                    if (i2 + 4 <= data.length) {
                        B2 = data[i2]
                        G2 = data[i2 + 1]
                        R2 = data[i2 + 2]
                    }
                }

                // Calculate YUV for both pixels using standard BT.601 coefficients
                const Y1 = 0.299 * R1 + 0.587 * G1 + 0.114 * B1
                const U1 = (B1 - Y1) / 1.772 + 128
                const V1 = (R1 - Y1) / 1.402 + 128

                const Y2 = 0.299 * R2 + 0.587 * G2 + 0.114 * B2
                const U2 = (B2 - Y2) / 1.772 + 128
                const V2 = (R2 - Y2) / 1.402 + 128

                // Average U and V for the pair (horizontal chroma subsampling)
                const U = Math.round((U1 + U2) / 2)
                const V = Math.round((V1 + V2) / 2)

                // Clamp values to 0-255
                const clampedY1 = Math.min(255, Math.max(0, Math.round(Y1)))
                const clampedY2 = Math.min(255, Math.max(0, Math.round(Y2)))
                const clampedU = Math.min(255, Math.max(0, U))
                const clampedV = Math.min(255, Math.max(0, V))

                // Write UYVY format: U Y V Y
                newData[outIndex++] = clampedU
                newData[outIndex++] = clampedY1
                newData[outIndex++] = clampedV
                newData[outIndex++] = clampedY2
            }
        }

        return newData
    }

    /**
     * Convert from ARGB to YUV 422 packed (UYVY format)
     * YUV422 packed format: each 2 pixels = 4 bytes (U Y V Y)
     */
    static ARGBtoYUV(data: Buffer, { width, height }: Size, outputBuffer?: Buffer) {
        // YUV422 packed format: each 2 pixels = 4 bytes (U Y V Y)
        const requiredSize = width * height * 2
        const newData = getOutputBuffer(requiredSize, outputBuffer)
        let outIndex = 0

        // Validate input buffer size (should be width * height * 4 for ARGB)
        const expectedInputSize = width * height * 4
        const hasFullInput = data.length >= expectedInputSize
        if (!hasFullInput) {
            console.warn(`Input buffer too small: ${data.length} < ${expectedInputSize}. Frame may be truncated.`)
        }

        // Fast path for complete frames: avoid per-pixel bounds checks.
        if (hasFullInput) {
            for (let y = 0; y < height; y++) {
                const rowBase = y * width * 4
                for (let x = 0; x < width; x += 2) {
                    const i1 = rowBase + x * 4
                    const R1 = data[i1 + 1]
                    const G1 = data[i1 + 2]
                    const B1 = data[i1 + 3]

                    // Get second pixel (right), or reuse first for odd widths.
                    let R2 = R1
                    let G2 = G1
                    let B2 = B1
                    if (x + 1 < width) {
                        const i2 = i1 + 4
                        R2 = data[i2 + 1]
                        G2 = data[i2 + 2]
                        B2 = data[i2 + 3]
                    }

                    const Y1 = 0.299 * R1 + 0.587 * G1 + 0.114 * B1
                    const U1 = (B1 - Y1) / 1.772 + 128
                    const V1 = (R1 - Y1) / 1.402 + 128

                    const Y2 = 0.299 * R2 + 0.587 * G2 + 0.114 * B2
                    const U2 = (B2 - Y2) / 1.772 + 128
                    const V2 = (R2 - Y2) / 1.402 + 128

                    const U = Math.round((U1 + U2) / 2)
                    const V = Math.round((V1 + V2) / 2)

                    const clampedY1 = Math.min(255, Math.max(0, Math.round(Y1)))
                    const clampedY2 = Math.min(255, Math.max(0, Math.round(Y2)))
                    const clampedU = Math.min(255, Math.max(0, U))
                    const clampedV = Math.min(255, Math.max(0, V))

                    newData[outIndex++] = clampedU
                    newData[outIndex++] = clampedY1
                    newData[outIndex++] = clampedV
                    newData[outIndex++] = clampedY2
                }
            }

            return newData
        }

        // Process pairs of pixels to create UYVY format
        for (let y = 0; y < height; y++) {
            const rowBase = y * width * 4
            for (let x = 0; x < width; x += 2) {
                // Get first pixel (left) - ARGB format
                const i1 = rowBase + x * 4

                // Bounds check
                if (i1 + 4 > data.length) {
                    break
                }

                const R1 = data[i1 + 1]
                const G1 = data[i1 + 2]
                const B1 = data[i1 + 3]
                // const A1 = data[i1] // Alpha, not used

                // Get second pixel (right), or use first pixel if at width boundary
                let R2 = R1
                let G2 = G1
                let B2 = B1
                if (x + 1 < width) {
                    const i2 = i1 + 4
                    if (i2 + 4 <= data.length) {
                        R2 = data[i2 + 1]
                        G2 = data[i2 + 2]
                        B2 = data[i2 + 3]
                    }
                }

                // Calculate YUV for both pixels using standard BT.601 coefficients
                const Y1 = 0.299 * R1 + 0.587 * G1 + 0.114 * B1
                const U1 = (B1 - Y1) / 1.772 + 128
                const V1 = (R1 - Y1) / 1.402 + 128

                const Y2 = 0.299 * R2 + 0.587 * G2 + 0.114 * B2
                const U2 = (B2 - Y2) / 1.772 + 128
                const V2 = (R2 - Y2) / 1.402 + 128

                // Average U and V for the pair (horizontal chroma subsampling)
                const U = Math.round((U1 + U2) / 2)
                const V = Math.round((V1 + V2) / 2)

                // Clamp values to 0-255
                const clampedY1 = Math.min(255, Math.max(0, Math.round(Y1)))
                const clampedY2 = Math.min(255, Math.max(0, Math.round(Y2)))
                const clampedU = Math.min(255, Math.max(0, U))
                const clampedV = Math.min(255, Math.max(0, V))

                // Write UYVY format: U Y V Y
                newData[outIndex++] = clampedU
                newData[outIndex++] = clampedY1
                newData[outIndex++] = clampedV
                newData[outIndex++] = clampedY2
            }
        }

        return newData
    }

    /*  convert from BGRA to RGBXLE  */
    static BGRAtoRGBXLE(data: Buffer) {
        for (let i = 0; i < data.length; i += 4) {
            const B = data[i]
            const G = data[i + 1]
            const R = data[i + 2]

            data[i] = R
            data[i + 1] = G
            data[i + 2] = B
            data[i + 3] = 0 // Set the last byte to 0
        }
    }

    /*  convert from ARGB to RGBXLE  */
    static ARGBtoRGBXLE(data: Buffer) {
        for (let i = 0; i < data.length; i += 4) {
            const R = data[i + 1]
            const G = data[i + 2]
            const B = data[i + 3]

            data[i] = R
            data[i + 1] = G
            data[i + 2] = B
            data[i + 3] = 0 // Set the last byte to 0
        }
    }

    /*  convert from BGRA to RGBLE  */
    static BGRAtoRGBLE(data: Buffer, outputBuffer?: Buffer) {
        const requiredSize = (data.length / 4) * 3
        const newData = getOutputBuffer(requiredSize, outputBuffer)
        let j = 0
        for (let i = 0; i < data.length; i += 4) {
            newData[j++] = data[i + 2] // R
            newData[j++] = data[i + 1] // G
            newData[j++] = data[i] // B
        }
        return newData
    }

    /*  convert from ARGB to RGBLE  */
    static ARGBtoRGBLE(data: Buffer, outputBuffer?: Buffer) {
        const requiredSize = (data.length / 4) * 3
        const newData = getOutputBuffer(requiredSize, outputBuffer)
        let j = 0
        for (let i = 0; i < data.length; i += 4) {
            newData[j++] = data[i + 1] // R
            newData[j++] = data[i + 2] // G
            newData[j++] = data[i + 3] // B
        }
        return newData
    }

    /*  convert from ARGB to RGBX  */
    static ARGBtoRGBX(data: Buffer) {
        for (let i = 0; i < data.length; i += 4) {
            const R = data[i + 1]
            const G = data[i + 2]
            const B = data[i + 3]

            data[i] = R
            data[i + 1] = G
            data[i + 2] = B
            data[i + 3] = 0 // Set the last byte to 0 (X)
        }
    }

    /*  convert from BGRA to RGB  */
    static BGRAtoRGB(data: Buffer, outputBuffer?: Buffer) {
        // Byte layout is identical to RGBLE for 8-bit packed output.
        return this.BGRAtoRGBLE(data, outputBuffer)
    }

    /*  convert from ARGB to RGB  */
    static ARGBtoRGB(data: Buffer, outputBuffer?: Buffer) {
        // Byte layout is identical to RGBLE for 8-bit packed output.
        return this.ARGBtoRGBLE(data, outputBuffer)
    }
}

/**
 * 10-bit RGB image buffer converters for output operations
 * Handles r210 (big-endian) and R10l (little-endian) packed formats
 */
export class ImageBufferConverter10BitRGB {
    private static to10BitFullRange(v8: number) {
        return (v8 << 2) & 0x3ff
    }

    /*  convert from BGRA to 10-bit RGB (Blackmagic format, 30 bits per pixel packed in 32-bit words) */
    static BGRAtoRGB(data: Buffer, { width, height }: Size, outputBuffer?: Buffer) {
        // Blackmagic 10-bit RGB (r210): big-endian words
        // Packed as [9:0]=B [19:10]=G [29:20]=R [31:30]=padding
        const newData = getOutputBuffer(width * height * 4, outputBuffer)
        let outIndex = 0

        for (let i = 0; i < data.length; i += 4) {
            const B = this.to10BitFullRange(data[i])
            const G = this.to10BitFullRange(data[i + 1])
            const R = this.to10BitFullRange(data[i + 2])

            const packed = (B | (G << 10) | (R << 20)) >>> 0
            newData.writeUInt32BE(packed, outIndex)
            outIndex += 4
        }

        return newData
    }

    /*  convert from ARGB to 10-bit RGB (Blackmagic format) */
    static ARGBtoRGB(data: Buffer, { width, height }: Size, outputBuffer?: Buffer) {
        const newData = getOutputBuffer(width * height * 4, outputBuffer)
        let outIndex = 0

        for (let i = 0; i < data.length; i += 4) {
            const R = this.to10BitFullRange(data[i + 1])
            const G = this.to10BitFullRange(data[i + 2])
            const B = this.to10BitFullRange(data[i + 3])

            const packed = (B | (G << 10) | (R << 20)) >>> 0
            newData.writeUInt32BE(packed, outIndex)
            outIndex += 4
        }

        return newData
    }

    /*  convert from BGRA to 10-bit RGBXLE (R10l, little-endian) */
    static BGRAtoRGBXLE(data: Buffer, { width, height }: Size, outputBuffer?: Buffer) {
        const newData = getOutputBuffer(width * height * 4, outputBuffer)
        let outIndex = 0

        for (let i = 0; i < data.length; i += 4) {
            const B = this.to10BitFullRange(data[i])
            const G = this.to10BitFullRange(data[i + 1])
            const R = this.to10BitFullRange(data[i + 2])

            const packed = (B | (G << 10) | (R << 20)) >>> 0
            newData.writeUInt32LE(packed, outIndex)
            outIndex += 4
        }

        return newData
    }

    /*  convert from ARGB to 10-bit RGBXLE (R10l, little-endian) */
    static ARGBtoRGBXLE(data: Buffer, { width, height }: Size, outputBuffer?: Buffer) {
        const newData = getOutputBuffer(width * height * 4, outputBuffer)
        let outIndex = 0

        for (let i = 0; i < data.length; i += 4) {
            const R = this.to10BitFullRange(data[i + 1])
            const G = this.to10BitFullRange(data[i + 2])
            const B = this.to10BitFullRange(data[i + 3])

            const packed = (B | (G << 10) | (R << 20)) >>> 0
            newData.writeUInt32LE(packed, outIndex)
            outIndex += 4
        }

        return newData
    }

    /*  convert from BGRA to 10-bit RGBX (R10b, big-endian) */
    static BGRAtoRGBX(data: Buffer, { width, height }: Size, outputBuffer?: Buffer) {
        // For 10-bit BE packing, RGB and RGBX share the same packed layout.
        return this.BGRAtoRGB(data, { width, height }, outputBuffer)
    }

    /*  convert from ARGB to 10-bit RGBX (R10b, big-endian) */
    static ARGBtoRGBX(data: Buffer, { width, height }: Size, outputBuffer?: Buffer) {
        // For 10-bit BE packing, RGB and RGBX share the same packed layout.
        return this.ARGBtoRGB(data, { width, height }, outputBuffer)
    }
}

/**
 * 12-bit RGB image buffer converters for output operations
 * Handles both big-endian (R12B) and little-endian (R12L) packed formats
 */
export class ImageBufferConverter12BitRGB {
    /*  convert from BGRA to 12-bit RGB (big-endian packed) */
    static BGRAtoRGB(data: Buffer, { width, height }: Size, outputBuffer?: Buffer) {
        const numPixels = width * height
        const newData = getOutputBuffer(Math.ceil(numPixels * 4.5), outputBuffer)
        let outIndex = 0
        let bitBuffer = 0
        let bitCount = 0

        for (let i = 0; i < data.length; i += 4) {
            const R = ((data[i + 2] << 4) | (data[i + 2] >> 4)) & 0xfff
            const G = ((data[i + 1] << 4) | (data[i + 1] >> 4)) & 0xfff
            const B = ((data[i] << 4) | (data[i] >> 4)) & 0xfff

            bitBuffer = (bitBuffer << 12) | R
            bitCount += 12
            while (bitCount >= 8) {
                bitCount -= 8
                newData[outIndex++] = (bitBuffer >> bitCount) & 0xff
            }

            bitBuffer = (bitBuffer << 12) | G
            bitCount += 12
            while (bitCount >= 8) {
                bitCount -= 8
                newData[outIndex++] = (bitBuffer >> bitCount) & 0xff
            }

            bitBuffer = (bitBuffer << 12) | B
            bitCount += 12
            while (bitCount >= 8) {
                bitCount -= 8
                newData[outIndex++] = (bitBuffer >> bitCount) & 0xff
            }
        }

        if (bitCount > 0) {
            newData[outIndex++] = (bitBuffer << (8 - bitCount)) & 0xff
        }

        return newData
    }

    /*  convert from ARGB to 12-bit RGB (big-endian packed) */
    static ARGBtoRGB(data: Buffer, { width, height }: Size, outputBuffer?: Buffer) {
        const numPixels = width * height
        const newData = getOutputBuffer(Math.ceil(numPixels * 4.5), outputBuffer)
        let outIndex = 0
        let bitBuffer = 0
        let bitCount = 0

        for (let i = 0; i < data.length; i += 4) {
            const R = ((data[i + 1] << 4) | (data[i + 1] >> 4)) & 0xfff
            const G = ((data[i + 2] << 4) | (data[i + 2] >> 4)) & 0xfff
            const B = ((data[i + 3] << 4) | (data[i + 3] >> 4)) & 0xfff

            bitBuffer = (bitBuffer << 12) | R
            bitCount += 12
            while (bitCount >= 8) {
                bitCount -= 8
                newData[outIndex++] = (bitBuffer >> bitCount) & 0xff
            }

            bitBuffer = (bitBuffer << 12) | G
            bitCount += 12
            while (bitCount >= 8) {
                bitCount -= 8
                newData[outIndex++] = (bitBuffer >> bitCount) & 0xff
            }

            bitBuffer = (bitBuffer << 12) | B
            bitCount += 12
            while (bitCount >= 8) {
                bitCount -= 8
                newData[outIndex++] = (bitBuffer >> bitCount) & 0xff
            }
        }

        if (bitCount > 0) {
            newData[outIndex++] = (bitBuffer << (8 - bitCount)) & 0xff
        }

        return newData
    }

    /*  convert from BGRA to 12-bit RGBLE (little-endian packed) */
    static BGRAtoRGBLE(data: Buffer, { width, height }: Size, outputBuffer?: Buffer) {
        const numPixels = width * height
        const newData = getOutputBuffer(Math.ceil(numPixels * 4.5), outputBuffer)
        let outIndex = 0
        let bitBuffer = 0
        let bitCount = 0

        for (let i = 0; i < data.length; i += 4) {
            const R = ((data[i + 2] << 4) | (data[i + 2] >> 4)) & 0xfff
            const G = ((data[i + 1] << 4) | (data[i + 1] >> 4)) & 0xfff
            const B = ((data[i] << 4) | (data[i] >> 4)) & 0xfff

            bitBuffer |= R << bitCount
            bitCount += 12
            while (bitCount >= 8) {
                newData[outIndex++] = bitBuffer & 0xff
                bitBuffer >>>= 8
                bitCount -= 8
            }

            bitBuffer |= G << bitCount
            bitCount += 12
            while (bitCount >= 8) {
                newData[outIndex++] = bitBuffer & 0xff
                bitBuffer >>>= 8
                bitCount -= 8
            }

            bitBuffer |= B << bitCount
            bitCount += 12
            while (bitCount >= 8) {
                newData[outIndex++] = bitBuffer & 0xff
                bitBuffer >>>= 8
                bitCount -= 8
            }
        }

        if (bitCount > 0) {
            newData[outIndex++] = bitBuffer & 0xff
        }

        return newData
    }

    /*  convert from ARGB to 12-bit RGBLE (little-endian packed) */
    static ARGBtoRGBLE(data: Buffer, { width, height }: Size, outputBuffer?: Buffer) {
        const numPixels = width * height
        const newData = getOutputBuffer(Math.ceil(numPixels * 4.5), outputBuffer)
        let outIndex = 0
        let bitBuffer = 0
        let bitCount = 0

        for (let i = 0; i < data.length; i += 4) {
            const R = ((data[i + 1] << 4) | (data[i + 1] >> 4)) & 0xfff
            const G = ((data[i + 2] << 4) | (data[i + 2] >> 4)) & 0xfff
            const B = ((data[i + 3] << 4) | (data[i + 3] >> 4)) & 0xfff

            bitBuffer |= R << bitCount
            bitCount += 12
            while (bitCount >= 8) {
                newData[outIndex++] = bitBuffer & 0xff
                bitBuffer >>>= 8
                bitCount -= 8
            }

            bitBuffer |= G << bitCount
            bitCount += 12
            while (bitCount >= 8) {
                newData[outIndex++] = bitBuffer & 0xff
                bitBuffer >>>= 8
                bitCount -= 8
            }

            bitBuffer |= B << bitCount
            bitCount += 12
            while (bitCount >= 8) {
                newData[outIndex++] = bitBuffer & 0xff
                bitBuffer >>>= 8
                bitCount -= 8
            }
        }

        if (bitCount > 0) {
            newData[outIndex++] = bitBuffer & 0xff
        }

        return newData
    }
}

/**
 * 10-bit YUV image buffer converters for output operations
 * Handles v210 format (10-bit YUV422 packed into 32-bit words)
 */
export class ImageBufferConverter10Bit {
    /*  convert from BGRA to v210 format (10-bit YUV422 packed) */
    static BGRAtoYUV(data: Buffer, { width, height }: Size, outputBuffer?: Buffer) {
        // v210 format: 16 bytes per 6 pixels (10-bit YUV422 packed into 32-bit words)
        // Each 128-bit block contains: U0 Y0 V0 Y1 U2 Y2 V2 Y3 U4 Y4 V4 Y5
        // Packed as: [V0:Y0:U0] [Y2:U2:Y1] [U4:Y3:V2] [Y5:V4:Y4] (little-endian 32-bit words)
        // Groups are padded per row, so allocation must be based on rows (not total pixels).
        const groupsPerRow = Math.ceil(width / 6)
        const newData = getOutputBuffer(groupsPerRow * height * 16, outputBuffer)
        let outIndex = 0

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x += 6) {
                // Process 6 pixels at a time
                const pixels: { y: number; u: number; v: number }[] = []

                for (let i = 0; i < 6 && x + i < width; i++) {
                    const idx = (y * width + x + i) * 4
                    const B = data[idx]
                    const G = data[idx + 1]
                    const R = data[idx + 2]

                    // Convert to YUV (BT.601) and scale to 10-bit (0-1023)
                    const Y = (0.299 * R + 0.587 * G + 0.114 * B) * 4
                    const U = ((B - Y / 4) / 1.772 + 128) * 4
                    const V = ((R - Y / 4) / 1.402 + 128) * 4

                    pixels.push({
                        y: Math.min(1023, Math.max(0, Math.round(Y))),
                        u: Math.min(1023, Math.max(0, Math.round(U))),
                        v: Math.min(1023, Math.max(0, Math.round(V)))
                    })
                }

                // Pad with black if less than 6 pixels
                while (pixels.length < 6) {
                    pixels.push({ y: 64, u: 512, v: 512 })
                }

                // Average chroma for 4:2:2 subsampling
                const u0 = Math.round((pixels[0].u + pixels[1].u) / 2)
                const u2 = Math.round((pixels[2].u + pixels[3].u) / 2)
                const u4 = Math.round((pixels[4].u + pixels[5].u) / 2)
                const v0 = Math.round((pixels[0].v + pixels[1].v) / 2)
                const v2 = Math.round((pixels[2].v + pixels[3].v) / 2)
                const v4 = Math.round((pixels[4].v + pixels[5].v) / 2)

                // Pack into v210 format (4 × 32-bit little-endian words)
                // Word 0: [31:30]=0 [29:20]=V0 [19:10]=Y0 [9:0]=U0
                const word0 = (v0 << 20) | (pixels[0].y << 10) | u0
                newData.writeUInt32LE(word0, outIndex)

                // Word 1: [31:30]=0 [29:20]=Y2 [19:10]=U2 [9:0]=Y1
                const word1 = (pixels[2].y << 20) | (u2 << 10) | pixels[1].y
                newData.writeUInt32LE(word1, outIndex + 4)

                // Word 2: [31:30]=0 [29:20]=U4 [19:10]=Y3 [9:0]=V2
                const word2 = (u4 << 20) | (pixels[3].y << 10) | v2
                newData.writeUInt32LE(word2, outIndex + 8)

                // Word 3: [31:30]=0 [29:20]=Y5 [19:10]=V4 [9:0]=Y4
                const word3 = (pixels[5].y << 20) | (v4 << 10) | pixels[4].y
                newData.writeUInt32LE(word3, outIndex + 12)

                outIndex += 16
            }
        }

        return newData
    }

    /*  convert from ARGB to v210 format (10-bit YUV422 packed) */
    static ARGBtoYUV(data: Buffer, { width, height }: Size, outputBuffer?: Buffer) {
        // v210 format: 16 bytes per 6 pixels
        // Groups are padded per row, so allocation must be based on rows (not total pixels).
        const groupsPerRow = Math.ceil(width / 6)
        const newData = getOutputBuffer(groupsPerRow * height * 16, outputBuffer)
        let outIndex = 0

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x += 6) {
                // Process 6 pixels at a time
                const pixels: { y: number; u: number; v: number }[] = []

                for (let i = 0; i < 6 && x + i < width; i++) {
                    const idx = (y * width + x + i) * 4
                    // ARGB format: A R G B
                    const R = data[idx + 1]
                    const G = data[idx + 2]
                    const B = data[idx + 3]

                    // Convert to YUV (BT.601) and scale to 10-bit
                    const Y = (0.299 * R + 0.587 * G + 0.114 * B) * 4
                    const U = ((B - Y / 4) / 1.772 + 128) * 4
                    const V = ((R - Y / 4) / 1.402 + 128) * 4

                    pixels.push({
                        y: Math.min(1023, Math.max(0, Math.round(Y))),
                        u: Math.min(1023, Math.max(0, Math.round(U))),
                        v: Math.min(1023, Math.max(0, Math.round(V)))
                    })
                }

                // Pad with black if less than 6 pixels
                while (pixels.length < 6) {
                    pixels.push({ y: 64, u: 512, v: 512 })
                }

                // Average chroma for 4:2:2 subsampling
                const u0 = Math.round((pixels[0].u + pixels[1].u) / 2)
                const u2 = Math.round((pixels[2].u + pixels[3].u) / 2)
                const u4 = Math.round((pixels[4].u + pixels[5].u) / 2)
                const v0 = Math.round((pixels[0].v + pixels[1].v) / 2)
                const v2 = Math.round((pixels[2].v + pixels[3].v) / 2)
                const v4 = Math.round((pixels[4].v + pixels[5].v) / 2)

                // Pack into v210 format (4 × 32-bit little-endian words)
                const word0 = (v0 << 20) | (pixels[0].y << 10) | u0
                newData.writeUInt32LE(word0, outIndex)

                const word1 = (pixels[2].y << 20) | (u2 << 10) | pixels[1].y
                newData.writeUInt32LE(word1, outIndex + 4)

                const word2 = (u4 << 20) | (pixels[3].y << 10) | v2
                newData.writeUInt32LE(word2, outIndex + 8)

                const word3 = (pixels[5].y << 20) | (v4 << 10) | pixels[4].y
                newData.writeUInt32LE(word3, outIndex + 12)

                outIndex += 16
            }
        }

        return newData
    }
}

/**
 * Image buffer converters for input (capture) operations
 */
export class InputImageBufferConverter {
    /**
     * Convert from YUV 4:2:0 planar to RGBA
     */
    static YUVtoRGBA(yuvData: Buffer, { width, height }: Size, outputBuffer?: Buffer) {
        const numPixels = width * height
        const rgbaData = getOutputBuffer(numPixels * 4, outputBuffer) // RGBA has 4 bytes per pixel

        const yPlane = yuvData.slice(0, numPixels)
        const uPlane = yuvData.slice(numPixels, numPixels + numPixels / 4)
        const vPlane = yuvData.slice(numPixels + numPixels / 4, numPixels + numPixels / 2)

        let rgbaIndex = 0

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const yIndex = y * width + x
                const uIndex = Math.floor(y / 2) * (width / 2) + Math.floor(x / 2)
                const vIndex = uIndex

                const Y = yPlane[yIndex]
                const U = uPlane[uIndex] - 128
                const V = vPlane[vIndex] - 128

                // Convert YUV to RGB
                const R = Y + 1.402 * V
                const G = Y - 0.344136 * U - 0.714136 * V
                const B = Y + 1.772 * U

                // Ensure RGB values are within the 0-255 range
                rgbaData[rgbaIndex++] = Math.max(0, Math.min(255, Math.round(R)))
                rgbaData[rgbaIndex++] = Math.max(0, Math.min(255, Math.round(G)))
                rgbaData[rgbaIndex++] = Math.max(0, Math.min(255, Math.round(B)))
                rgbaData[rgbaIndex++] = 255 // Alpha channel
            }
        }

        return rgbaData
    }

    /*  convert from RGBXLE to RGBA  */
    static RGBXLEtoRGBA(data: Buffer) {
        return this.RGBLEtoRGBA(data)
    }

    /*  convert from RGBLE to RGBA  */
    static RGBLEtoRGBA(data: Buffer, outputBuffer?: Buffer) {
        const requiredSize = (data.length / 3) * 4
        const newData = getOutputBuffer(requiredSize, outputBuffer)
        let j = 0
        for (let i = 0; i < data.length; i += 3) {
            newData[j++] = data[i] // R
            newData[j++] = data[i + 1] // G
            newData[j++] = data[i + 2] // B
            newData[j++] = 255 // A
        }
        return newData
    }

    /*  convert from RGBX to RGBA  */
    static RGBXtoRGBA(data: Buffer, outputBuffer?: Buffer) {
        const newData = getOutputBuffer(data.length, outputBuffer)
        for (let i = 0; i < data.length; i += 4) {
            newData[i] = data[i] // R
            newData[i + 1] = data[i + 1] // G
            newData[i + 2] = data[i + 2] // B
            newData[i + 3] = 255 // A (replacing X)
        }
        return newData
    }

    /*  convert from RGB to RGBA  */
    static RGBtoRGBA(data: Buffer, outputBuffer?: Buffer) {
        const requiredSize = (data.length / 3) * 4
        const newData = getOutputBuffer(requiredSize, outputBuffer)
        let j = 0
        for (let i = 0; i < data.length; i += 3) {
            newData[j++] = data[i] // R
            newData[j++] = data[i + 1] // G
            newData[j++] = data[i + 2] // B
            newData[j++] = 255 // A
        }
        return newData
    }
}
