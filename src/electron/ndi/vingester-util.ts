// @ts-nocheck
/*
 **  Vingester ~ Ingest Web Contents as Video Streams
 **  Copyright (c) 2021-2022 Dr. Ralf S. Engelschall <rse@engelschall.com>
 **  Licensed under GPL 3.0 <https://spdx.org/licenses/GPL-3.0-only>
 */

/*  helper class for weighted average calculations  */
class WeightedAverage {
    constructor(len, every) {
        this.len = len
        this.every = every
        this.val = []
        this.cnt = 0
        this.max = Number.NEGATIVE_INFINITY
        this.min = Number.POSITIVE_INFINITY
        for (let i = 0; i < len; i++) this.val[i] = 0
    }
    record(val, callback) {
        this.val.pop()
        this.val.unshift(val)
        let avg = 0
        let div = 0
        let max = Number.NEGATIVE_INFINITY
        let min = Number.POSITIVE_INFINITY
        for (let i = 0; i < this.len; i++) {
            if (max < this.val[i]) max = this.val[i]
            if (min > this.val[i]) min = this.val[i]
            const k = this.len - i
            avg += this.val[i] * k
            div += k
        }
        avg /= div
        if (this.max < max) this.max = max
        if (this.min > max) this.min = max
        if (this.cnt++ > this.every) {
            this.cnt = 0
            callback({
                avg,
                min,
                max,
                tmin: this.min,
                tmax: this.max,
            })
        }
    }
}

/*  helper class for actions per time  */
class ActionsPerTime {
    constructor(ms) {
        this.ms = ms
        this.last = Math.round(Date.now() / this.ms)
        this.count = 0
    }
    record(callback) {
        this.count++
        const now = Math.round(Date.now() / this.ms)
        if (now > this.last) {
            callback(this.count)
            this.last = now
            this.count = 0
        }
    }
}

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

/*  helper class for determining displays  */
class AvailableDisplays {
    static determine(electron) {
        let i = 0
        const pd = electron.screen.getPrimaryDisplay()
        let displays = [{ num: i++, x: pd.bounds.x, y: pd.bounds.y, w: pd.bounds.width, h: pd.bounds.height }]
        displays = displays.concat(
            electron.screen
                .getAllDisplays()
                .filter((d) => d.id !== pd.id)
                .map((d) => ({ x: d.bounds.x, y: d.bounds.y, w: d.bounds.width, h: d.bounds.height }))
                .sort((d1, d2) => d1.x - d2.x)
                .sort((d1, d2) => d1.y - d2.y)
                .map((d) => {
                    d.num = i++
                    return d
                })
        )
        return displays
    }
}

export default {
    WeightedAverage,
    ActionsPerTime,
    ImageBufferAdjustment,
    AvailableDisplays,
}
