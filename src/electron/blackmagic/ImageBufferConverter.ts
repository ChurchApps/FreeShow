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
        
        // Create or reuse buffer - implement a static buffer pool for better performance
        // For simplicity, we'll create a new buffer each time for now
        const newData = Buffer.alloc(yuvSize);
        
        // Calculate scaling ratios - only do this once
        const xRatio = srcWidth / targetWidth;
        const yRatio = srcHeight / targetHeight;
        
        // Pre-calculate source row offsets for better cache locality
        const srcRowOffsets = new Array(targetHeight);
        for (let y = 0; y < targetHeight; y++) {
            const srcY = Math.min(Math.floor(y * yRatio), srcHeight - 1);
            srcRowOffsets[y] = srcY * srcWidth * 4;
        }
        
        // Process scan lines in chunks for better cache performance
        const CHUNK_HEIGHT = 16; // Process 16 rows at a time
        
        for (let chunkY = 0; chunkY < targetHeight; chunkY += CHUNK_HEIGHT) {
            const endY = Math.min(chunkY + CHUNK_HEIGHT, targetHeight);
            
            for (let y = chunkY; y < endY; y++) {
                const destRowOffset = y * targetWidth * 2;
                const srcRowOffset = srcRowOffsets[y];
                
                // Process pairs of pixels in each row
                for (let x = 0; x < targetWidth; x += 2) {
                    // Calculate source indices precisely once
                    const srcX1 = Math.min(Math.floor(x * xRatio), srcWidth - 1);
                    const srcX2 = Math.min(Math.floor((x + 1) * xRatio), srcWidth - 1);
                    
                    const i1 = srcRowOffset + srcX1 * 4;
                    const i2 = srcRowOffset + srcX2 * 4;
                    
                    // Direct access to avoid bounds checking in tight loop
                    const B1 = data[i1];
                    const G1 = data[i1 + 1];
                    const R1 = data[i1 + 2];
                    
                    const B2 = data[i2];
                    const G2 = data[i2 + 1];
                    const R2 = data[i2 + 2];
                    
                    // YUV conversion using integer math (faster than floating point)
                    // These coefficients are scaled by 1024 for fixed-point math
                    // Y = 0.299R + 0.587G + 0.114B
                    // U = -0.14713R - 0.28886G + 0.436B + 128
                    // V = 0.615R - 0.51499G - 0.10001B + 128
                    
                    const Y1 = (306 * R1 + 601 * G1 + 117 * B1) >> 10;
                    const Y2 = (306 * R2 + 601 * G2 + 117 * B2) >> 10;
                    
                    // Average the two pixels for chroma
                    const Ravg = (R1 + R2) >> 1;
                    const Gavg = (G1 + G2) >> 1;
                    const Bavg = (B1 + B2) >> 1;
                    
                    const U = ((-151 * Ravg - 296 * Gavg + 447 * Bavg) >> 10) + 128;
                    const V = ((629 * Ravg - 527 * Gavg - 102 * Bavg) >> 10) + 128;
                    
                    // Calculate destination index
                    const j = destRowOffset + x * 2;
                    
                    // Write UYVY format
                    newData[j] = Math.min(255, Math.max(0, U));
                    newData[j + 1] = Math.min(255, Math.max(0, Y1));
                    newData[j + 2] = Math.min(255, Math.max(0, V));
                    newData[j + 3] = Math.min(255, Math.max(0, Y2));
                }
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
        
        // Pre-calculate source row offsets
        const srcRowOffsets = new Array(targetHeight);
        for (let y = 0; y < targetHeight; y++) {
            const srcY = Math.min(Math.floor(y * yRatio), srcHeight - 1);
            srcRowOffsets[y] = srcY * srcWidth * 4;
        }
        
        // Process in chunks for better cache performance
        const CHUNK_HEIGHT = 16;
        
        for (let chunkY = 0; chunkY < targetHeight; chunkY += CHUNK_HEIGHT) {
            const endY = Math.min(chunkY + CHUNK_HEIGHT, targetHeight);
            
            for (let y = chunkY; y < endY; y++) {
                const destRowOffset = y * targetWidth * 2;
                const srcRowOffset = srcRowOffsets[y];
                
                for (let x = 0; x < targetWidth; x += 2) {
                    const srcX1 = Math.min(Math.floor(x * xRatio), srcWidth - 1);
                    const srcX2 = Math.min(Math.floor((x + 1) * xRatio), srcWidth - 1);
                    
                    const i1 = srcRowOffset + srcX1 * 4;
                    const i2 = srcRowOffset + srcX2 * 4;
                    
                    // ARGB format - different indices
                    const R1 = data[i1 + 1];
                    const G1 = data[i1 + 2];
                    const B1 = data[i1 + 3];
                    
                    const R2 = data[i2 + 1];
                    const G2 = data[i2 + 2];
                    const B2 = data[i2 + 3];
                    
                    // Same YUV conversion using integer math
                    const Y1 = (306 * R1 + 601 * G1 + 117 * B1) >> 10;
                    const Y2 = (306 * R2 + 601 * G2 + 117 * B2) >> 10;
                    
                    const Ravg = (R1 + R2) >> 1;
                    const Gavg = (G1 + G2) >> 1;
                    const Bavg = (B1 + B2) >> 1;
                    
                    const U = ((-151 * Ravg - 296 * Gavg + 447 * Bavg) >> 10) + 128;
                    const V = ((629 * Ravg - 527 * Gavg - 102 * Bavg) >> 10) + 128;
                    
                    const j = destRowOffset + x * 2;
                    
                    // Write UYVY format
                    newData[j] = Math.min(255, Math.max(0, U));
                    newData[j + 1] = Math.min(255, Math.max(0, Y1));
                    newData[j + 2] = Math.min(255, Math.max(0, V));
                    newData[j + 3] = Math.min(255, Math.max(0, Y2));
                }
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
        
        // For v210 format, each 6 pixels takes 16 bytes (4 words), resulting in 8/3 bytes per pixel on average
        // We'll round up to ensure we have enough space
        const bytesPerGroup = 16;  // 4 words per 6 pixels
        const pixelsPerGroup = 6;  // 6 pixels per 4 words
        const totalGroups = Math.ceil((targetWidth * targetHeight) / pixelsPerGroup);
        const yuvSize = totalGroups * bytesPerGroup;
        
        const newData = Buffer.alloc(yuvSize);
        
        // Calculate scaling ratios - only do this once
        const xRatio = srcWidth / targetWidth;
        const yRatio = srcHeight / targetHeight;
        
        // Pre-calculate source row offsets for better cache locality
        const srcRowOffsets = new Array(targetHeight);
        for (let y = 0; y < targetHeight; y++) {
            const srcY = Math.min(Math.floor(y * yRatio), srcHeight - 1);
            srcRowOffsets[y] = srcY * srcWidth * 4;
        }
        
        // Process in chunks for better performance
        const CHUNK_HEIGHT = 8;  // Process 8 rows at a time (reduced from 16 for higher bit depth)
        
        // The v210 format packs 6 pixels into 4 32-bit words:
        // Word 0: Cr0 + Y0 + Cb0
        // Word 1: Y1 + Cb1 + Y2
        // Word 2: Cr1 + Y3 + Cb2  
        // Word 3: Y4 + Cr2 + Y5
        
        for (let chunkY = 0; chunkY < targetHeight; chunkY += CHUNK_HEIGHT) {
            const endY = Math.min(chunkY + CHUNK_HEIGHT, targetHeight);
            
            for (let y = chunkY; y < endY; y++) {
                const destRowOffset = Math.floor((y * targetWidth) / pixelsPerGroup) * bytesPerGroup;
                const srcRowOffset = srcRowOffsets[y];
                
                // Process groups of 6 pixels (for v210 format)
                for (let x = 0; x < targetWidth; x += 6) {
                    // We'll process up to 6 pixels at a time, but handle edge cases
                    const remainingPixels = Math.min(6, targetWidth - x);
                    
                    // Array to hold YUV values for the group of pixels
                    const Y = new Uint16Array(6);
                    const U = new Uint16Array(3);
                    const V = new Uint16Array(3);
                    
                    // Process each pixel in the group
                    for (let i = 0; i < remainingPixels; i++) {
                        const srcX = Math.min(Math.floor((x + i) * xRatio), srcWidth - 1);
                        const srcIdx = srcRowOffset + srcX * 4;
                        
                        // BGRA format
                        const B = data[srcIdx];
                        const G = data[srcIdx + 1];
                        const R = data[srcIdx + 2];
                        
                        // Calculate 10-bit YUV using fixed-point math (BT.709 coefficients)
                        // Scale by 1024 for fixed-point, then shift back by 10 bits
                        Y[i] = Math.min(1023, Math.max(0, (218 * ((306 * R + 601 * G + 117 * B) >> 10) >> 8) + 64));
                        
                        // Chroma subsampling is 4:2:2, so we need a U and V for every 2 pixels
                        if (i % 2 === 0) {
                            const uIdx = i >> 1;
                            // U calculation: -0.1146R - 0.3854G + 0.5B (scaled and with offset)
                            U[uIdx] = Math.min(1023, Math.max(0, 
                                (224 * (((-151 * R - 296 * G + 447 * B) >> 10) + 128) >> 8) + 64));
                            // V calculation: 0.5R - 0.4542G - 0.0458B (scaled and with offset)
                            V[uIdx] = Math.min(1023, Math.max(0, 
                                (224 * (((629 * R - 527 * G - 102 * B) >> 10) + 128) >> 8) + 64));
                        }
                    }
                    
                    // Fill in any missing values at the edge
                    for (let i = remainingPixels; i < 6; i++) {
                        Y[i] = 64; // Black level for 10-bit
                        if (i % 2 === 0) {
                            U[i >> 1] = 512; // Middle value for 10-bit
                            V[i >> 1] = 512; // Middle value for 10-bit
                        }
                    }
                    
                    // Calculate destination index for this group
                    const groupIdx = destRowOffset + Math.floor(x / 6) * bytesPerGroup;
                    
                    // Pack as v210 format (each component is 10 bits)
                    // Word 0: [Cr0(10) Y0(10) Cb0(10) XX(2)]
                    const word0 = (V[0] << 20) | (Y[0] << 10) | U[0];
                    
                    // Word 1: [Y2(10) Cb1(10) Y1(10) XX(2)]
                    const word1 = (Y[2] << 20) | (U[1] << 10) | Y[1];
                    
                    // Word 2: [Cb2(10) Y3(10) Cr1(10) XX(2)]
                    const word2 = (U[2] << 20) | (Y[3] << 10) | V[1];
                    
                    // Word 3: [Y5(10) Cr2(10) Y4(10) XX(2)]
                    const word3 = (Y[5] << 20) | (V[2] << 10) | Y[4];
                    
                    // Write the 32-bit words in little-endian format
                    newData.writeUInt32LE(word0, groupIdx);
                    newData.writeUInt32LE(word1, groupIdx + 4);
                    newData.writeUInt32LE(word2, groupIdx + 8);
                    newData.writeUInt32LE(word3, groupIdx + 12);
                }
            }
        }
        
        return newData;
    }

    static ARGBtoYUV(data: Buffer, { width: srcWidth, height: srcHeight }: Size, targetDims?: { width: number, height: number }) {
        // Similar implementation as BGRAtoYUV but with ARGB pixel format
        const targetWidth = targetDims?.width || srcWidth;
        const targetHeight = targetDims?.height || srcHeight;
        
        // Same v210 format calculation
        const bytesPerGroup = 16;  // 4 words per 6 pixels
        const pixelsPerGroup = 6;  // 6 pixels per 4 words
        const totalGroups = Math.ceil((targetWidth * targetHeight) / pixelsPerGroup);
        const yuvSize = totalGroups * bytesPerGroup;
        
        const newData = Buffer.alloc(yuvSize);
        
        // Calculate scaling ratios
        const xRatio = srcWidth / targetWidth;
        const yRatio = srcHeight / targetHeight;
        
        // Pre-calculate source row offsets
        const srcRowOffsets = new Array(targetHeight);
        for (let y = 0; y < targetHeight; y++) {
            const srcY = Math.min(Math.floor(y * yRatio), srcHeight - 1);
            srcRowOffsets[y] = srcY * srcWidth * 4;
        }
        
        const CHUNK_HEIGHT = 8;
        
        for (let chunkY = 0; chunkY < targetHeight; chunkY += CHUNK_HEIGHT) {
            const endY = Math.min(chunkY + CHUNK_HEIGHT, targetHeight);
            
            for (let y = chunkY; y < endY; y++) {
                const destRowOffset = Math.floor((y * targetWidth) / pixelsPerGroup) * bytesPerGroup;
                const srcRowOffset = srcRowOffsets[y];
                
                for (let x = 0; x < targetWidth; x += 6) {
                    const remainingPixels = Math.min(6, targetWidth - x);
                    
                    const Y = new Uint16Array(6);
                    const U = new Uint16Array(3);
                    const V = new Uint16Array(3);
                    
                    for (let i = 0; i < remainingPixels; i++) {
                        const srcX = Math.min(Math.floor((x + i) * xRatio), srcWidth - 1);
                        const srcIdx = srcRowOffset + srcX * 4;
                        
                        // ARGB format - different indices
                        const R = data[srcIdx + 1];
                        const G = data[srcIdx + 2];
                        const B = data[srcIdx + 3];
                        
                        // Same YUV conversion for 10-bit
                        Y[i] = Math.min(1023, Math.max(0, (218 * ((306 * R + 601 * G + 117 * B) >> 10) >> 8) + 64));
                        
                        if (i % 2 === 0) {
                            const uIdx = i >> 1;
                            U[uIdx] = Math.min(1023, Math.max(0, 
                                (224 * (((-151 * R - 296 * G + 447 * B) >> 10) + 128) >> 8) + 64));
                            V[uIdx] = Math.min(1023, Math.max(0, 
                                (224 * (((629 * R - 527 * G - 102 * B) >> 10) + 128) >> 8) + 64));
                        }
                    }
                    
                    // Fill in any missing values
                    for (let i = remainingPixels; i < 6; i++) {
                        Y[i] = 64;
                        if (i % 2 === 0) {
                            U[i >> 1] = 512;
                            V[i >> 1] = 512;
                        }
                    }
                    
                    const groupIdx = destRowOffset + Math.floor(x / 6) * bytesPerGroup;
                    
                    // Pack as v210 format
                    const word0 = (V[0] << 20) | (Y[0] << 10) | U[0];
                    const word1 = (Y[2] << 20) | (U[1] << 10) | Y[1];
                    const word2 = (U[2] << 20) | (Y[3] << 10) | V[1];
                    const word3 = (Y[5] << 20) | (V[2] << 10) | Y[4];
                    
                    newData.writeUInt32LE(word0, groupIdx);
                    newData.writeUInt32LE(word1, groupIdx + 4);
                    newData.writeUInt32LE(word2, groupIdx + 8);
                    newData.writeUInt32LE(word3, groupIdx + 12);
                }
            }
        }
        
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
