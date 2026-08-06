import { describe, expect, it } from "vitest"
import type { RtmpData } from "../../../types/Output"
import { getUnhealthyDestinations, hasStreamableDestination, migrateOutputsRtmp, migrateRtmpData } from "./rtmpDestinations"

describe("migrateRtmpData", () => {
    it("folds a legacy url/key pair into one destination", () => {
        const migrated = migrateRtmpData({ url: "rtmp://a.rtmp.youtube.com/live2", key: "abc-123", fps: 30, bitrate: 4000 })

        expect(migrated?.destinations).toHaveLength(1)
        expect(migrated?.destinations?.[0]).toMatchObject({ url: "rtmp://a.rtmp.youtube.com/live2", key: "abc-123", enabled: true })
        expect(migrated?.fps).toBe(30)
        expect(migrated?.bitrate).toBe(4000)
    })

    it("drops the legacy fields once migrated", () => {
        const migrated = migrateRtmpData({ url: "rtmp://x/y", key: "k" })

        expect(migrated).not.toHaveProperty("url")
        expect(migrated).not.toHaveProperty("key")
    })

    it("is idempotent", () => {
        const once = migrateRtmpData({ url: "rtmp://x/y", key: "k" })
        const twice = migrateRtmpData(once)

        expect(twice).toBe(once)
        expect(twice?.destinations).toHaveLength(1)
    })

    it("leaves already-migrated data untouched", () => {
        const data: RtmpData = { destinations: [{ id: "a", name: "YouTube", url: "rtmp://x/y", key: "k", enabled: true }] }

        expect(migrateRtmpData(data)).toBe(data)
    })

    it("does not clobber existing destinations when legacy fields linger", () => {
        const migrated = migrateRtmpData({
            url: "rtmp://legacy/one",
            key: "legacy",
            destinations: [{ id: "a", name: "YouTube", url: "rtmp://x/y", key: "k", enabled: true }]
        })

        expect(migrated?.destinations).toHaveLength(1)
        expect(migrated?.destinations?.[0].url).toBe("rtmp://x/y")
        expect(migrated).not.toHaveProperty("url")
    })

    it("creates no destination when the legacy url was never set", () => {
        expect(migrateRtmpData({ url: "", key: "" })?.destinations).toBeUndefined()
    })

    it("passes undefined through", () => {
        expect(migrateRtmpData(undefined)).toBeUndefined()
    })
})

describe("migrateOutputsRtmp", () => {
    it("migrates every output and reports that it changed something", () => {
        const outputs: { [id: string]: { rtmpData?: RtmpData } } = {
            a: { rtmpData: { url: "rtmp://one", key: "1" } },
            b: { rtmpData: { url: "rtmp://two", key: "2" } },
            c: {}
        }

        expect(migrateOutputsRtmp(outputs)).toBe(true)
        expect(outputs.a.rtmpData?.destinations?.[0].url).toBe("rtmp://one")
        expect(outputs.b.rtmpData?.destinations?.[0].url).toBe("rtmp://two")
    })

    it("reports no change on a second pass", () => {
        const outputs: { [id: string]: { rtmpData?: RtmpData } } = { a: { rtmpData: { url: "rtmp://one", key: "1" } } }

        migrateOutputsRtmp(outputs)
        expect(migrateOutputsRtmp(outputs)).toBe(false)
    })

    it("gives migrated destinations distinct ids", () => {
        const outputs: { [id: string]: { rtmpData?: RtmpData } } = {
            a: { rtmpData: { url: "rtmp://one", key: "1" } },
            b: { rtmpData: { url: "rtmp://two", key: "2" } }
        }
        migrateOutputsRtmp(outputs)

        expect(outputs.a.rtmpData?.destinations![0].id).not.toBe(outputs.b.rtmpData?.destinations![0].id)
    })
})

describe("hasStreamableDestination", () => {
    const destination = { id: "a", name: "n", url: "rtmp://x/y", key: "k", enabled: true }

    it("requires at least one enabled destination with a url", () => {
        expect(hasStreamableDestination({ destinations: [destination] })).toBe(true)
        expect(hasStreamableDestination({ destinations: [{ ...destination, enabled: false }] })).toBe(false)
        expect(hasStreamableDestination({ destinations: [{ ...destination, url: "" }] })).toBe(false)
        expect(hasStreamableDestination({ destinations: [] })).toBe(false)
        expect(hasStreamableDestination(undefined)).toBe(false)
    })

    it("is true when only one of several destinations is usable", () => {
        expect(hasStreamableDestination({ destinations: [{ ...destination, enabled: false }, destination] })).toBe(true)
    })

    it("does not require a stream key, since some servers embed it in the url", () => {
        expect(hasStreamableDestination({ destinations: [{ ...destination, key: "" }] })).toBe(true)
    })
})

describe("getUnhealthyDestinations", () => {
    const data = {
        destinations: [
            { id: "a", name: "YouTube", url: "rtmp://a", key: "", enabled: true },
            { id: "b", name: "Twitch", url: "rtmp://b", key: "", enabled: true },
            { id: "c", name: "Disabled", url: "rtmp://c", key: "", enabled: false }
        ]
    }

    it("names only the destinations that are not live", () => {
        const status = { a: { state: "live" as const }, b: { state: "reconnecting" as const } }
        expect(getUnhealthyDestinations(data, status)).toEqual(["Twitch"])
    })

    it("is empty when everything is live", () => {
        const status = { a: { state: "live" as const }, b: { state: "live" as const } }
        expect(getUnhealthyDestinations(data, status)).toEqual([])
    })

    it("ignores disabled destinations even when they report a state", () => {
        const status = { a: { state: "live" as const }, b: { state: "live" as const }, c: { state: "error" as const } }
        expect(getUnhealthyDestinations(data, status)).toEqual([])
    })

    it("does not flag a recovered destination that has restarts on record", () => {
        const status = { a: { state: "live" as const, restarts: 4, lastIssue: "too slow" }, b: { state: "live" as const } }
        expect(getUnhealthyDestinations(data, status)).toEqual([])
    })

    it("reports nothing before any status has arrived", () => {
        expect(getUnhealthyDestinations(data, undefined)).toEqual([])
    })
})
