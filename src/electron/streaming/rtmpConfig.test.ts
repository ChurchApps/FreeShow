import { describe, expect, it } from "vitest"
import { buildDestinationUrl, configRequiresRestart, type StreamConfig } from "./rtmpConfig"

const base: StreamConfig = { width: 1920, height: 1080, fps: 30, bitrate: 4000, enableAudio: true, encoder: "auto" }

describe("configRequiresRestart", () => {
    it("is false for an unchanged config", () => {
        expect(configRequiresRestart(base, { ...base })).toBe(false)
    })

    it.each([
        ["width", { width: 1280 }],
        ["height", { height: 720 }],
        ["fps", { fps: 60 }],
        ["bitrate", { bitrate: 6000 }],
        ["enableAudio", { enableAudio: false }],
        ["encoder", { encoder: "x264" }]
    ])("is true when %s changes", (_name, change) => {
        expect(configRequiresRestart(base, { ...base, ...change })).toBe(true)
    })
})

describe("buildDestinationUrl", () => {
    it("joins url and key", () => {
        expect(buildDestinationUrl({ url: "rtmp://a.rtmp.youtube.com/live2", key: "abc" })).toBe("rtmp://a.rtmp.youtube.com/live2/abc")
    })

    it("does not double up on a trailing slash", () => {
        expect(buildDestinationUrl({ url: "rtmp://host/app/", key: "abc" })).toBe("rtmp://host/app/abc")
    })

    it("leaves the url alone when there is no key", () => {
        expect(buildDestinationUrl({ url: "rtmp://host/app/embedded-key", key: "" })).toBe("rtmp://host/app/embedded-key")
    })
})
