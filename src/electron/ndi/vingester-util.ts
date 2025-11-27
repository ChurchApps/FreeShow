// @ts-nocheck
/*
 **  Vingester ~ Ingest Web Contents as Video Streams
 **  Copyright (c) 2021-2022 Dr. Ralf S. Engelschall <rse@engelschall.com>
 **  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
 */

/*  helper class for adjusting image buffer byte orders  */
class ImageBufferAdjustment {
    /*  convert between ARGB and BGRA  */
    static ARGBtoBGRA(data) {
        for (let i = 0; i < data.length; i += 4) {
            const A = data[i]
            data[i] = data[i + 3]
            data[i + 3] = A
            const R = data[i + 1]
            data[i + 1] = data[i + 2]
            data[i + 2] = R
        }
    }

    /*  convert from ARGB to RGBA  */
    static ARGBtoRGBA(data) {
        for (let i = 0; i < data.length; i += 4) {
            const A = data[i]
            data[i] = data[i + 1]
            data[i + 1] = data[i + 2]
            data[i + 2] = data[i + 3]
            data[i + 3] = A
        }
    }

    /*  convert from BGRA to RGBA  */
    static BGRAtoRGBA(data) {
        for (let i = 0; i < data.length; i += 4) {
            const B = data[i]
            data[i] = data[i + 2]
            data[i + 2] = B
        }
    }

    /*  convert from BGRA to BGRX  */
    static BGRAtoBGRX(data) {
        for (let i = 0; i < data.length; i += 4) data[i + 3] = 255
    }
}

export default {
    ImageBufferAdjustment
}
