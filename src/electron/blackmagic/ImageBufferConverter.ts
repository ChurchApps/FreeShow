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

   static BGRAtoYUV(data: Buffer, { width: srcWidth, height: srcHeight }: Size, targetDims?: { width: number, height: number }) {
        // Use target dimensions if provided, otherwise use source dimensions
        const targetWidth = targetDims?.width || srcWidth;
        const targetHeight = targetDims?.height || srcHeight;

        
        // Output buffer size for UYVY format (2 bytes per pixel)
        const yuvSize = targetWidth * targetHeight * 2;
        const newData = Buffer.alloc(yuvSize);
        
        // Calculate scaling ratios
        const xRatio = srcWidth / targetWidth;
        const yRatio = srcHeight / targetHeight;

        for (let y = 0; y < targetHeight; y++) {
            for (let x = 0; x < targetWidth; x += 2) {
                const srcX1 = Math.min(Math.floor(x * xRatio), srcWidth - 1);
		const srcX2 = Math.min(Math.floor((x + 1) * xRatio), srcWidth - 1);
		const srcY = Math.min(Math.floor(y * yRatio), srcHeight - 1);
                
                const i1 = (srcY * srcWidth + srcX1) * 4;
                const i2 = Math.min((srcY * srcWidth + srcX2) * 4, data.length - 4);
                
                const B1 = data[i1];
                const G1 = data[i1 + 1];
                const R1 = data[i1 + 2];
                
                const B2 = data[i2];
                const G2 = data[i2 + 1];
                const R2 = data[i2 + 2];

                const Y1 = 0.299 * R1 + 0.587 * G1 + 0.114 * B1;
                const Y2 = 0.299 * R2 + 0.587 * G2 + 0.114 * B2;
                
		const U = (-0.14713 * (R1 + R2) / 2 - 0.28886 * (G1 + G2) / 2 + 0.436 * (B1 + B2) / 2) + 128;
		const V = (0.5 * (R1 + R2) / 2 - 0.4542 * (G1 + G2) / 2 - 0.0458 * (B1 + B2) / 2) + 128;

                const j = (y * targetWidth + x) * 2;
                
                newData[j] = Math.min(255, Math.max(0, Math.round(U)));
                newData[j + 1] = Math.min(255, Math.max(0, Math.round(Y1)));
                newData[j + 2] = Math.min(255, Math.max(0, Math.round(V)));
                newData[j + 3] = Math.min(255, Math.max(0, Math.round(Y2)));
            }
        }

        return newData;
    }

    static ARGBtoYUV(data: Buffer, { width: srcWidth, height: srcHeight }: Size, targetDims?: { width: number, height: number }) {
        // Similar implementation as BGRAtoYUV but with ARGB pixel format
        const targetWidth = targetDims?.width || srcWidth;
        const targetHeight = targetDims?.height || srcHeight;
        
        const yuvSize = targetWidth * targetHeight * 2;
        const newData = Buffer.alloc(yuvSize);
        
        const xRatio = srcWidth / targetWidth;
        const yRatio = srcHeight / targetHeight;

        for (let y = 0; y < targetHeight; y++) {
            for (let x = 0; x < targetWidth; x += 2) {
                const srcX1 = Math.min(Math.floor(x * xRatio), srcWidth - 1);
		const srcX2 = Math.min(Math.floor((x + 1) * xRatio), srcWidth - 1);
		const srcY = Math.min(Math.floor(y * yRatio), srcHeight - 1);
                
                const i1 = (srcY * srcWidth + srcX1) * 4;
                const i2 = Math.min((srcY * srcWidth + srcX2) * 4, data.length - 4);
                
                const R1 = data[i1 + 1];
                const G1 = data[i1 + 2];
                const B1 = data[i1 + 3];
                
                const R2 = data[i2 + 1];
                const G2 = data[i2 + 2];
                const B2 = data[i2 + 3];

                const Y1 = 0.299 * R1 + 0.587 * G1 + 0.114 * B1;
                const Y2 = 0.299 * R2 + 0.587 * G2 + 0.114 * B2;
                
                const U = (-0.14713 * (R1 + R2) / 2 - 0.28886 * (G1 + G2) / 2 + 0.436 * (B1 + B2) / 2) + 128;
                const V = (0.615 * (R1 + R2) / 2 - 0.51499 * (G1 + G2) / 2 - 0.10001 * (B1 + B2) / 2) + 128;

                const j = (y * targetWidth + x) * 2;
                
                newData[j] = Math.min(255, Math.max(0, Math.round(U)));
                newData[j + 1] = Math.min(255, Math.max(0, Math.round(Y1)));
                newData[j + 2] = Math.min(255, Math.max(0, Math.round(V)));
                newData[j + 3] = Math.min(255, Math.max(0, Math.round(Y2)));
            }
        }

        return newData;
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
    static BGRAtoYUV(data: Buffer, { width: srcWidth, height: srcHeight }: Size, targetDims?: { width: number, height: number }) {
        // Use target dimensions if provided, otherwise use source dimensions
        const targetWidth = targetDims?.width || srcWidth;
        const targetHeight = targetDims?.height || srcHeight;
        
        // For 10-bit, each component needs 2 bytes
        const yuvSize = targetWidth * targetHeight * 4; // 4 bytes per pixel for v210 format
        const newData = Buffer.alloc(yuvSize);
        
        // Calculate scaling ratios
        const xRatio = srcWidth / targetWidth;
        const yRatio = srcHeight / targetHeight;

        for (let y = 0; y < targetHeight; y++) {
            for (let x = 0; x < targetWidth; x += 2) { // Process 2 pixels at a time
                const srcX1 = Math.min(Math.floor(x * xRatio), srcWidth - 1);
		const srcX2 = Math.min(Math.floor((x + 1) * xRatio), srcWidth - 1);
		const srcY = Math.min(Math.floor(y * yRatio), srcHeight - 1);
                
                // Calculate source indices
                const i1 = (srcY * srcWidth + srcX1) * 4;  // BGRA index for first pixel
                const i2 = Math.min((srcY * srcWidth + srcX2) * 4, data.length - 4);  // BGRA index for second pixel
                
                // Get source colors for first pixel
                const B1 = data[i1];
                const G1 = data[i1 + 1];
                const R1 = data[i1 + 2];
                
                // Get source colors for second pixel
                const B2 = data[i2];
                const G2 = data[i2 + 1];
                const R2 = data[i2 + 2];

                // Convert to YUV using BT.709 coefficients for HD
                const Y1 = 0.2126 * R1 + 0.7152 * G1 + 0.0722 * B1;
                const Y2 = 0.2126 * R2 + 0.7152 * G2 + 0.0722 * B2;
                
                // Calculate U and V by averaging the two pixels
                const U = (-0.1146 * (R1 + R2) / 2 - 0.3854 * (G1 + G2) / 2 + 0.5 * (B1 + B2) / 2);
                const V = (0.5 * (R1 + R2) / 2 - 0.4542 * (G1 + G2) / 2 - 0.0458 * (B1 + B2) / 2);

                // Scale to 10-bit range (0-1023)
                const Y1_10bit = Math.min(1023, Math.max(0, Math.round(Y1 * 4)));
                const Y2_10bit = Math.min(1023, Math.max(0, Math.round(Y2 * 4)));
                const U_10bit = Math.min(1023, Math.max(0, Math.round((U + 0.5) * 1023)));
                const V_10bit = Math.min(1023, Math.max(0, Math.round((V + 0.5) * 1023)));

                // Calculate destination index
                const j = (y * targetWidth + x) * 4;

		// Pack as v210 format (each component is 10 bits)
		const word0 = (U_10bit << 20) | (Y1_10bit << 10) | V_10bit;
		const word1 = Y2_10bit << 20;  // Rest of word1 will be used by next pair

		// Write the 32-bit words in little-endian format
		newData[j] = word0 & 0xFF;
		newData[j + 1] = (word0 >> 8) & 0xFF;
		newData[j + 2] = (word0 >> 16) & 0xFF;
		newData[j + 3] = (word0 >> 24) & 0xFF;

		if (x + 1 < targetWidth) {
 		   newData[j + 4] = word1 & 0xFF;
 		   newData[j + 5] = (word1 >> 8) & 0xFF;
 		   newData[j + 6] = (word1 >> 16) & 0xFF;
 		   newData[j + 7] = (word1 >> 24) & 0xFF;
		}
            }
        }

        console.log(`Converted 10-bit: ${srcWidth}x${srcHeight} to ${targetWidth}x${targetHeight}`);
        return newData;
    }

    static ARGBtoYUV(data: Buffer, { width: srcWidth, height: srcHeight }: Size, targetDims?: { width: number, height: number }) {
        // Use target dimensions if provided, otherwise use source dimensions
        const targetWidth = targetDims?.width || srcWidth;
        const targetHeight = targetDims?.height || srcHeight;
        
        // For 10-bit, each component needs 2 bytes
        const yuvSize = targetWidth * targetHeight * 4; // 4 bytes per pixel for v210 format
        const newData = Buffer.alloc(yuvSize);
        
        // Calculate scaling ratios
        const xRatio = srcWidth / targetWidth;
        const yRatio = srcHeight / targetHeight;

        for (let y = 0; y < targetHeight; y++) {
            for (let x = 0; x < targetWidth; x += 2) { // Process 2 pixels at a time
                const srcX1 = Math.min(Math.floor(x * xRatio), srcWidth - 1);
		const srcX2 = Math.min(Math.floor((x + 1) * xRatio), srcWidth - 1);
		const srcY = Math.min(Math.floor(y * yRatio), srcHeight - 1);
                
                // Calculate source indices
                const i1 = (srcY * srcWidth + srcX1) * 4;  // ARGB index for first pixel
                const i2 = Math.min((srcY * srcWidth + srcX2) * 4, data.length - 4);  // ARGB index for second pixel
                
                // Get source colors for first pixel (ARGB format)
                const R1 = data[i1 + 1];
                const G1 = data[i1 + 2];
                const B1 = data[i1 + 3];
                
                // Get source colors for second pixel (ARGB format)
                const R2 = data[i2 + 1];
                const G2 = data[i2 + 2];
                const B2 = data[i2 + 3];

                // Convert to YUV using BT.709 coefficients for HD
                const Y1 = 0.2126 * R1 + 0.7152 * G1 + 0.0722 * B1;
                const Y2 = 0.2126 * R2 + 0.7152 * G2 + 0.0722 * B2;
                
                // Calculate U and V by averaging the two pixels
                const U = (-0.1146 * (R1 + R2) / 2 - 0.3854 * (G1 + G2) / 2 + 0.5 * (B1 + B2) / 2);
                const V = (0.5 * (R1 + R2) / 2 - 0.4542 * (G1 + G2) / 2 - 0.0458 * (B1 + B2) / 2);

                // Scale to 10-bit range (0-1023)
                const Y1_10bit = Math.min(1023, Math.max(0, Math.round(Y1 * 4)));
                const Y2_10bit = Math.min(1023, Math.max(0, Math.round(Y2 * 4)));
                const U_10bit = Math.min(1023, Math.max(0, Math.round((U + 0.5) * 1023)));
                const V_10bit = Math.min(1023, Math.max(0, Math.round((V + 0.5) * 1023)));

                // Calculate destination index
                const j = (y * targetWidth + x) * 4;

		// Pack as v210 format (each component is 10 bits)
		const word0 = (U_10bit << 20) | (Y1_10bit << 10) | V_10bit;
		const word1 = Y2_10bit << 20;  // Rest of word1 will be used by next pair

		// Write the 32-bit words in little-endian format
		newData[j] = word0 & 0xFF;
		newData[j + 1] = (word0 >> 8) & 0xFF;
		newData[j + 2] = (word0 >> 16) & 0xFF;
		newData[j + 3] = (word0 >> 24) & 0xFF;

		if (x + 1 < targetWidth) {
		    newData[j + 4] = word1 & 0xFF;
		    newData[j + 5] = (word1 >> 8) & 0xFF;
		    newData[j + 6] = (word1 >> 16) & 0xFF;
		    newData[j + 7] = (word1 >> 24) & 0xFF;
		}
            }
        }

        console.log(`Converted 10-bit: ${srcWidth}x${srcHeight} to ${targetWidth}x${targetHeight}`);
        return newData;
    }
}

export class InputImageBufferConverter {
    /*  convert from YUV to RGBA  */
    // static YUVtoRGBA(data: Buffer) {
    //     const newData = []
    //     for (let i = 0; i < data.length; i += 3) {
    //         const Y = data[i]
    //         const U = data[i + 1] - 128
    //         const V = data[i + 2] - 128

    //         // Convert YUV to RGB
    //         const R = Y + 1.402 * V
    //         const G = Y - 0.344136 * U - 0.714136 * V
    //         const B = Y + 1.772 * U

    //         // Ensure RGB values are within the 0-255 range
    //         newData.push(
    //             Math.max(0, Math.min(255, R)),
    //             Math.max(0, Math.min(255, G)),
    //             Math.max(0, Math.min(255, B)),
    //             255 // Alpha channel
    //         )
    //     }
    //     return Buffer.from(newData)
    // }
    /*  convert from YUV240 to RGBA  */
    static YUVtoRGBA(yuvData: Buffer, { width, height }: Size) {
        const numPixels = width * height
        const rgbaData = Buffer.alloc(numPixels * 4) // RGBA has 4 bytes per pixel

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
