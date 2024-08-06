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
        for (let i = 0; i < data.length; i += 4) {
            const B = data[i]
            const G = data[i + 1]
            const R = data[i + 2]

            // YUV conversion formulas
            const Y = 0.299 * R + 0.587 * G + 0.114 * B
            const U = -0.14713 * R - 0.28886 * G + 0.436 * B + 128
            const V = 0.615 * R - 0.51499 * G - 0.10001 * B + 128

            data[i] = Y
            data[i + 1] = U
            data[i + 2] = V
            // Alpha channel remains unchanged
            // data[i + 3] = data[i + 3];
        }
    }

    /*  convert from ARGB to YUV  */
    static ARGBtoYUV(data: Buffer) {
        for (let i = 0; i < data.length; i += 4) {
            // const A = data[i];
            const R = data[i + 1]
            const G = data[i + 2]
            const B = data[i + 3]

            // YUV conversion formulas
            const Y = 0.299 * R + 0.587 * G + 0.114 * B
            const U = -0.14713 * R - 0.28886 * G + 0.436 * B + 128
            const V = 0.615 * R - 0.51499 * G - 0.10001 * B + 128

            data[i] = Y
            data[i + 1] = U
            data[i + 2] = V
            // Alpha channel remains unchanged
            // data[i + 3] = A;
        }
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
    static BGRAtoRGB(data: Buffer) {
        const newData = []
        for (let i = 0; i < data.length; i += 4) {
            const B = data[i]
            const G = data[i + 1]
            const R = data[i + 2]

            newData.push(R, G, B)
        }
        return newData
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
        return newData
    }
}
