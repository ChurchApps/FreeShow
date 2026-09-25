/**
 * Utility functions for audio gain and dB (decibel) conversions.
 */

export const MIN_DB = -60
export const MAX_DB = 6

/**
 * Convert linear gain (0.0 to N) to decibels (dB).
 * 0 gain maps to -Infinity dB (or MIN_DB threshold).
 */
export function gainToDb(gain: number): number {
    if (gain <= 0.00001) return -Infinity
    return 20 * Math.log10(gain)
}

/**
 * Convert decibels (dB) to linear gain (0.0 to N).
 * -Infinity dB (or <= -60 dB when clamped) maps to 0 gain.
 */
export function dbToGain(db: number): number {
    if (db <= MIN_DB || db === -Infinity) return 0
    return Math.pow(10, db / 20)
}

/**
 * Maps linear gain to a normalized slider position (0.0 to 1.0)
 * using a piecewise fader curve:
 * - Slider 0.0 -> -60 dB (0 gain)
 * - Slider 0.8 -> 0 dB (1.0 gain, unit unity)
 * - Slider 1.0 -> +6 dB (~2.0 gain)
 */
export function gainToSlider(gain: number): number {
    if (gain <= 0.00001) return 0
    const db = gainToDb(gain)
    if (db <= MIN_DB) return 0
    if (db <= 0) {
        return ((db - MIN_DB) / -MIN_DB) * 0.8
    }
    return 0.8 + (Math.min(db, MAX_DB) / MAX_DB) * 0.2
}

/**
 * Maps normalized slider position (0.0 to 1.0) to linear gain.
 */
export function sliderToGain(sliderPos: number): number {
    if (sliderPos <= 0) return 0
    let db: number
    if (sliderPos <= 0.8) {
        db = MIN_DB + (sliderPos / 0.8) * -MIN_DB
    } else {
        db = ((sliderPos - 0.8) / 0.2) * MAX_DB
    }
    return dbToGain(db)
}

/**
 * Maps a decibel value (e.g. -60 dB to 0 dB) to a normalized 0.0 to 1.0 position ratio.
 */
export function dbToLinear(db: number, minDb: number = MIN_DB, maxDb: number = 0): number {
    if (db <= minDb) return 0
    if (db >= maxDb) return 1
    return (db - minDb) / (maxDb - minDb)
}

/**
 * Calculates peak amplitude dBFS from time domain Float32Array PCM audio buffer.
 */
export function calculatePeakDb(buffer: Float32Array): number {
    let maxPeak = 0
    const len = buffer.length
    for (let j = 0; j < len; j++) {
        const abs = Math.abs(buffer[j])
        if (abs > maxPeak) maxPeak = abs
    }
    return maxPeak > 0.000001 ? Math.max(MIN_DB, Math.min(12, 20 * Math.log10(maxPeak))) : MIN_DB
}

/**
 * Formats a linear gain value as a user-friendly dB string (e.g., "-∞ dB", "0.0 dB", "+3.2 dB").
 */
export function formatDb(gain: number): string {
    if (gain <= 0.00001) return "-∞ dB"
    const db = gainToDb(gain)
    if (db <= -59.5) return "-∞ dB"
    const prefix = db > 0.05 ? "+" : ""
    return `${prefix}${db.toFixed(1)} dB`
}
