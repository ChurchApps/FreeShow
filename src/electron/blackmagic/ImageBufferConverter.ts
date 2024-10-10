import { Size } from "electron"

// 8 Bit
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

    /*  convert from BGRA to YUV  */
    // static BGRAtoYUV(data: Buffer) {
    //     const newData = Buffer.alloc((data.length / 4) * 3)
    //     for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    //         const B = data[i]
    //         const G = data[i + 1]
    //         const R = data[i + 2]

    //         // YUV conversion formulas
    //         const Y = 0.299 * R + 0.587 * G + 0.114 * B
    //         const U = -0.14713 * R - 0.28886 * G + 0.436 * B + 128
    //         const V = 0.615 * R - 0.51499 * G - 0.10001 * B + 128

    //         // Clamp Y, U, V to 0-255
    //         newData[j] = Math.min(255, Math.max(0, Math.round(Y)))
    //         newData[j + 1] = Math.min(255, Math.max(0, Math.round(U)))
    //         newData[j + 2] = Math.min(255, Math.max(0, Math.round(V)))
    //         // Alpha channel is removed
    //     }
    //     return newData
    // }
    /*  convert from BGRA to YUV 420  */
    static BGRAtoYUV(data: Buffer, { width, height }: Size) {
        const ySize = width * height // Size of Y plane
        const uSize = (width / 2) * (height / 2) // Size of U plane (half width, half height)
        const vSize = uSize // Size of V plane (same as U)
        const newData = Buffer.alloc(ySize + uSize + vSize)

        let yIndex = 0 // Index for Y plane
        let uIndex = ySize // Index for U plane
        let vIndex = ySize + uSize // Index for V plane

        // Loop through each pixel
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4 // BGRA index
                const B = data[i]
                const G = data[i + 1]
                const R = data[i + 2]

                // YUV conversion formulas
                const Y = 0.299 * R + 0.587 * G + 0.114 * B
                const U = -0.14713 * R - 0.28886 * G + 0.436 * B + 128
                const V = 0.615 * R - 0.51499 * G - 0.10001 * B + 128

                // Clamp Y, U, V to 0-255
                const clampedY = Math.min(255, Math.max(0, Math.round(Y)))
                newData[yIndex++] = clampedY // Store Y value

                // Store U and V values at the appropriate indices for YUV420
                if (x % 2 === 0 && y % 2 === 0) {
                    // Only store U and V for the top-left pixel of each 2x2 block
                    newData[uIndex++] = Math.min(255, Math.max(0, Math.round(U))) // Store U
                    newData[vIndex++] = Math.min(255, Math.max(0, Math.round(V))) // Store V
                }
            }
        }

        return newData
    }

    /*  convert from ARGB to YUV  */
    // static ARGBtoYUV(data: Buffer) {
    //     const newData = Buffer.alloc((data.length / 4) * 3)
    //     for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    //         const R = data[i + 1]
    //         const G = data[i + 2]
    //         const B = data[i + 3]

    //         // YUV conversion formulas
    //         const Y = 0.299 * R + 0.587 * G + 0.114 * B
    //         const U = -0.14713 * R - 0.28886 * G + 0.436 * B + 128
    //         const V = 0.615 * R - 0.51499 * G - 0.10001 * B + 128

    //         // Clamp Y, U, V to 0-255
    //         newData[j] = Math.min(255, Math.max(0, Math.round(Y)))
    //         newData[j + 1] = Math.min(255, Math.max(0, Math.round(U)))
    //         newData[j + 2] = Math.min(255, Math.max(0, Math.round(V)))
    //         // Alpha channel is removed
    //     }
    //     return newData
    // }
    /*  convert from ARGB to YUV 420  */
    static ARGBtoYUV(data: Buffer, { width, height }: Size) {
        const numPixels = width * height

        // Create output buffers
        const yPlane = Buffer.alloc(numPixels) // Y plane
        const uPlane = Buffer.alloc(numPixels / 4) // U plane (subsampled)
        const vPlane = Buffer.alloc(numPixels / 4) // V plane (subsampled)

        let yIndex = 0
        let uvIndex = 0

        for (let i = 0; i < data.length; i += 4) {
            const R = data[i + 1] // Red channel
            const G = data[i + 2] // Green channel
            const B = data[i + 3] // Blue channel

            // YUV conversion formulas
            const Y = 0.299 * R + 0.587 * G + 0.114 * B
            const U = -0.14713 * R - 0.28886 * G + 0.436 * B + 128
            const V = 0.615 * R - 0.51499 * G - 0.10001 * B + 128

            // Clamp Y, U, V to 0-255
            const YClamped = Math.min(255, Math.max(0, Math.round(Y)))
            const UClamped = Math.min(255, Math.max(0, Math.round(U)))
            const VClamped = Math.min(255, Math.max(0, Math.round(V)))

            // Store Y value
            yPlane[yIndex++] = YClamped

            // Store U and V values using 2x2 subsampling
            if ((i / 4) % 2 === 0 && (yIndex - 1) % 2 === 0) {
                // Average the U and V values for subsampling
                const uAvg = (UClamped + (i + 4 < data.length ? Math.min(255, Math.max(0, Math.round(-0.14713 * data[i + 5] - 0.28886 * data[i + 6] + 0.436 * data[i + 7] + 128))) : 128)) / 2
                const vAvg = (VClamped + (i + 4 < data.length ? Math.min(255, Math.max(0, Math.round(0.615 * data[i + 5] - 0.51499 * data[i + 6] - 0.10001 * data[i + 7] + 128))) : 128)) / 2

                uPlane[uvIndex] = Math.round(uAvg)
                vPlane[uvIndex] = Math.round(vAvg)
                uvIndex++
            }
        }

        // Combine Y, U, V planes into a single buffer (optional)
        // You can choose to return separate planes or a combined one based on your requirements.

        const newData = Buffer.concat([yPlane, uPlane, vPlane])
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
    static BGRAtoRGBLE(data: Buffer) {
        const newData = new Uint8ClampedArray((data.length / 4) * 3)
        for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
            const B = data[i]
            const G = data[i + 1]
            const R = data[i + 2]

            newData[j] = R
            newData[j + 1] = G
            newData[j + 2] = B
        }
        return Buffer.from(newData)
    }

    /*  convert from ARGB to RGBLE  */
    static ARGBtoRGBLE(data: Buffer) {
        const newData = []
        for (let i = 0; i < data.length; i += 4) {
            const R = data[i + 1]
            const G = data[i + 2]
            const B = data[i + 3]

            newData.push(R, G, B)
        }
        return Buffer.from(newData)
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
    static BGRAtoRGB(data: Buffer) {
        const newData = []
        for (let i = 0; i < data.length; i += 4) {
            const B = data[i]
            const G = data[i + 1]
            const R = data[i + 2]

            newData.push(R, G, B)
        }
        return Buffer.from(newData)
    }

    /*  convert from ARGB to RGB  */
    static ARGBtoRGB(data: Buffer) {
        const newData = []
        for (let i = 0; i < data.length; i += 4) {
            const R = data[i + 1]
            const G = data[i + 2]
            const B = data[i + 3]

            newData.push(R, G, B)
        }
        return Buffer.from(newData)
    }
}

// 10 Bit
export class ImageBufferConverter10Bit {
    static BGRAtoYUV(data: Buffer, { width, height }: Size) {
        const ySize = width * height // Size of Y plane
        const uSize = (width / 2) * (height / 2) // Size of U plane (half width, half height)
        const vSize = uSize // Size of V plane (same as U)
        const newData = Buffer.alloc(ySize * 2 + uSize * 2 + vSize * 2) // Allocate 2 bytes for each channel

        let yIndex = 0 // Index for Y plane
        let uIndex = ySize * 2 // Index for U plane (shifted for 10 bits)
        let vIndex = ySize * 2 + uSize * 2 // Index for V plane

        // Loop through each pixel
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4 // BGRA index
                const B = data[i] // Blue
                const G = data[i + 1] // Green
                const R = data[i + 2] // Red

                // YUV conversion formulas
                const Y = 0.299 * R + 0.587 * G + 0.114 * B
                const U = -0.14713 * R - 0.28886 * G + 0.436 * B + 128
                const V = 0.615 * R - 0.51499 * G - 0.10001 * B + 128

                // Scale Y, U, V to 10 bits (0-1023)
                const scaledY = Math.round(Y * 4) // Scale Y from 0-255 to 0-1020 (approx)
                const scaledU = Math.min(1023, Math.max(0, Math.round(U * 4))) // Scale U
                const scaledV = Math.min(1023, Math.max(0, Math.round(V * 4))) // Scale V

                // Store Y value
                newData[yIndex++] = (scaledY >> 2) & 0xff // Store high byte
                newData[yIndex++] = (scaledY & 0x03) << 6 // Store low bits

                // Store U and V values at the appropriate indices for YUV420
                if (x % 2 === 0 && y % 2 === 0) {
                    // Only store U and V for the top-left pixel of each 2x2 block
                    newData[uIndex++] = (scaledU >> 2) & 0xff // Store high byte
                    newData[uIndex++] = (scaledU & 0x03) << 6 // Store low bits

                    newData[vIndex++] = (scaledV >> 2) & 0xff // Store high byte
                    newData[vIndex++] = (scaledV & 0x03) << 6 // Store low bits
                }
            }
        }

        return newData
    }

    static ARGBtoYUV(data: Buffer, { width, height }: Size) {
        const numPixels = width * height

        // Create output buffers
        const yPlane = Buffer.alloc(numPixels * 2) // Y plane (10 bits = 2 bytes per pixel)
        const uPlane = Buffer.alloc((numPixels / 4) * 2) // U plane (10 bits = 2 bytes per pixel, subsampled)
        const vPlane = Buffer.alloc((numPixels / 4) * 2) // V plane (10 bits = 2 bytes per pixel, subsampled)

        let yIndex = 0
        let uvIndex = 0

        for (let i = 0; i < data.length; i += 4) {
            const R = data[i + 1] // Red channel
            const G = data[i + 2] // Green channel
            const B = data[i + 3] // Blue channel

            // YUV conversion formulas
            const Y = 0.299 * R + 0.587 * G + 0.114 * B
            const U = -0.14713 * R - 0.28886 * G + 0.436 * B + 128
            const V = 0.615 * R - 0.51499 * G - 0.10001 * B + 128

            // Scale Y, U, V to 10 bits (0-1023)
            const Y10Bit = Math.min(1023, Math.max(0, Math.round(Y * 4))) // Scale Y to 0-1020
            const U10Bit = Math.min(1023, Math.max(0, Math.round(U * 4))) // Scale U
            const V10Bit = Math.min(1023, Math.max(0, Math.round(V * 4))) // Scale V

            // Store Y value in 10-bit format
            yPlane[yIndex++] = (Y10Bit >> 2) & 0xff // Store high byte
            yPlane[yIndex++] = (Y10Bit & 0x03) << 6 // Store low bits

            // Store U and V values using 2x2 subsampling
            if ((i / 4) % 2 === 0 && (yIndex - 1) % 2 === 0) {
                // Average the U and V values for subsampling
                const nextIndex = i + 4
                const nextU = nextIndex < data.length ? -0.14713 * data[nextIndex + 1] - 0.28886 * data[nextIndex + 2] + 0.436 * data[nextIndex + 3] + 128 : 128
                const nextV = nextIndex < data.length ? 0.615 * data[nextIndex + 1] - 0.51499 * data[nextIndex + 2] - 0.10001 * data[nextIndex + 3] + 128 : 128

                const uAvg = (U10Bit + Math.min(1023, Math.max(0, Math.round(nextU * 4)))) / 2
                const vAvg = (V10Bit + Math.min(1023, Math.max(0, Math.round(nextV * 4)))) / 2

                const u10Bit = Math.round(uAvg)
                const v10Bit = Math.round(vAvg)

                uPlane[uvIndex++] = (u10Bit >> 2) & 0xff // Store high byte for U
                uPlane[uvIndex++] = (u10Bit & 0x03) << 6 // Store low bits for U

                vPlane[uvIndex++] = (v10Bit >> 2) & 0xff // Store high byte for V
                vPlane[uvIndex++] = (v10Bit & 0x03) << 6 // Store low bits for V
            }
        }

        // Combine Y, U, V planes into a single buffer (optional)
        const newData = Buffer.concat([yPlane, uPlane, vPlane])
        return newData
    }
}

export class InputImageBufferConverter {
    /*  convert from YUV to RGBA  */
    static YUVtoRGBA(data: Buffer) {
        const newData = []
        for (let i = 0; i < data.length; i += 3) {
            const Y = data[i]
            const U = data[i + 1] - 128
            const V = data[i + 2] - 128

            // Convert YUV to RGB
            const R = Y + 1.402 * V
            const G = Y - 0.344136 * U - 0.714136 * V
            const B = Y + 1.772 * U

            // Ensure RGB values are within the 0-255 range
            newData.push(
                Math.max(0, Math.min(255, R)),
                Math.max(0, Math.min(255, G)),
                Math.max(0, Math.min(255, B)),
                255 // Alpha channel
            )
        }
        return Buffer.from(newData)
    }

    /*  convert from RGBXLE to RGBA  */
    static RGBXLEtoRGBA(data: Buffer) {
        const newData = []
        for (let i = 0; i < data.length; i += 3) {
            const R = data[i]
            const G = data[i + 1]
            const B = data[i + 2]

            newData.push(
                R,
                G,
                B,
                255 // Alpha channel
            )
        }
        return Buffer.from(newData)
    }

    /*  convert from RGBLE to RGBA  */
    static RGBLEtoRGBA(data: Buffer) {
        const newData = []
        for (let i = 0; i < data.length; i += 3) {
            const R = data[i]
            const G = data[i + 1]
            const B = data[i + 2]

            newData.push(
                R,
                G,
                B,
                255 // Alpha channel
            )
        }
        return Buffer.from(newData)
    }

    /*  convert from RGBX to RGBA  */
    static RGBXtoRGBA(data: Buffer) {
        const newData = []
        for (let i = 0; i < data.length; i += 4) {
            const R = data[i]
            const G = data[i + 1]
            const B = data[i + 2]
            // const X = data[i + 3]; // X is not used

            newData.push(
                R,
                G,
                B,
                255 // Alpha channel
            )
        }
        return Buffer.from(newData)
    }

    /*  convert from RGB to RGBA  */
    static RGBtoRGBA(data: Buffer) {
        const newData = []
        for (let i = 0; i < data.length; i += 3) {
            const R = data[i]
            const G = data[i + 1]
            const B = data[i + 2]

            newData.push(
                R,
                G,
                B,
                255 // Alpha channel
            )
        }
        return Buffer.from(newData)
    }
}
