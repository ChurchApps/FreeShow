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
    static BGRAtoYUV(data: Buffer) {
        const newData = Buffer.alloc((data.length / 4) * 3)
        for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
            const B = data[i]
            const G = data[i + 1]
            const R = data[i + 2]

            // YUV conversion formulas
            const Y = 0.299 * R + 0.587 * G + 0.114 * B
            const U = -0.14713 * R - 0.28886 * G + 0.436 * B + 128
            const V = 0.615 * R - 0.51499 * G - 0.10001 * B + 128

            // Clamp Y, U, V to 0-255
            newData[j] = Math.min(255, Math.max(0, Math.round(Y)))
            newData[j + 1] = Math.min(255, Math.max(0, Math.round(U)))
            newData[j + 2] = Math.min(255, Math.max(0, Math.round(V)))
            // Alpha channel is removed
        }
        return newData
    }

    /*  convert from ARGB to YUV  */
    static ARGBtoYUV(data: Buffer) {
        const newData = Buffer.alloc((data.length / 4) * 3)
        for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
            const R = data[i + 1]
            const G = data[i + 2]
            const B = data[i + 3]

            // YUV conversion formulas
            const Y = 0.299 * R + 0.587 * G + 0.114 * B
            const U = -0.14713 * R - 0.28886 * G + 0.436 * B + 128
            const V = 0.615 * R - 0.51499 * G - 0.10001 * B + 128

            // Clamp Y, U, V to 0-255
            newData[j] = Math.min(255, Math.max(0, Math.round(Y)))
            newData[j + 1] = Math.min(255, Math.max(0, Math.round(U)))
            newData[j + 2] = Math.min(255, Math.max(0, Math.round(V)))
            // Alpha channel is removed
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
