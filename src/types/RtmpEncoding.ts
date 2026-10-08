export type RtmpRateControl = "cbr" | "vbr"

/** Rates are in kbps. A VBR peak must exceed the target: QSV selects CBR when they are equal. */
export function getRtmpBitrates(mode: RtmpRateControl | undefined, bitrate: number, maxBitrate?: number): { bitrate: number; maxBitrate: number } {
    bitrate = Number.isFinite(bitrate) && Math.round(bitrate) > 0 ? Math.round(bitrate) : 4000
    const peak = maxBitrate !== undefined && Number.isFinite(maxBitrate) ? Math.round(maxBitrate) : 0
    return { bitrate, maxBitrate: mode === "vbr" ? (peak > bitrate ? peak : bitrate * 2) : bitrate }
}
