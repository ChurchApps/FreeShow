import { describe, expect, it } from "vitest"
import { getRtmpBitrates } from "./RtmpEncoding"

describe("RTMP bitrate normalization", () => {
    it("accepts custom target and VBR peak", () => {
        expect(getRtmpBitrates("vbr", 3500, 6500)).toEqual({ bitrate: 3500, maxBitrate: 6500 })
    })
    it("ignores a saved VBR peak in CBR mode", () => {
        expect(getRtmpBitrates("cbr", 3500, 6500)).toEqual({ bitrate: 3500, maxBitrate: 3500 })
    })
    it.each([0, -1, NaN, Infinity, 0.1])("repairs an invalid target %s before FFmpeg sees it", (bitrate) => {
        expect(getRtmpBitrates("cbr", bitrate).bitrate).toBe(4000)
    })
    it.each([undefined, 0, -1, NaN, Infinity, 3500, 3000])("keeps the VBR peak above the target for QSV (%s)", (maxBitrate) => {
        expect(getRtmpBitrates("vbr", 3500, maxBitrate).maxBitrate).toBe(7000)
    })
})
