import { describe, expect, it } from "vitest"
import { getUrlTimestamp, parseTimestamp, trimPlayerId } from "./playerHelper"

describe("parseTimestamp", () => {
    it("parses URL and typed timestamps", () => {
        expect(parseTimestamp("1234")).toBe(1234)
        expect(parseTimestamp("1234s")).toBe(1234)
        expect(parseTimestamp("20m15s")).toBe(1215)
        expect(parseTimestamp("1h2m3s")).toBe(3723)
        expect(parseTimestamp("1h")).toBe(3600)
        expect(parseTimestamp("45m")).toBe(2700)
        expect(parseTimestamp("1:02:03")).toBe(3723)
        expect(parseTimestamp("20:15")).toBe(1215)
    })

    it("returns 0 for empty or invalid values", () => {
        expect(parseTimestamp("")).toBe(0)
        expect(parseTimestamp("abc")).toBe(0)
        expect(parseTimestamp("1:2:3:4")).toBe(0)
    })
})

describe("getUrlTimestamp", () => {
    it("reads the timestamp from YouTube and Vimeo links", () => {
        expect(getUrlTimestamp("https://www.youtube.com/live/X-AJdKty74M?si=abc&t=1234")).toBe(1234)
        expect(getUrlTimestamp("https://youtu.be/X-AJdKty74M?t=1234")).toBe(1234)
        expect(getUrlTimestamp("youtu.be/X-AJdKty74M?si=abc&t=1h2m3s")).toBe(3723)
        expect(getUrlTimestamp("https://www.youtube.com/watch?v=X-AJdKty74M&t=754s")).toBe(754)
        expect(getUrlTimestamp("https://www.youtube.com/embed/X-AJdKty74M?start=90")).toBe(90)
        expect(getUrlTimestamp("https://vimeo.com/76979871#t=1m30s")).toBe(90)
    })

    it("returns 0 when there is no timestamp", () => {
        expect(getUrlTimestamp("https://www.youtube.com/live/X-AJdKty74M?si=abc")).toBe(0)
        expect(getUrlTimestamp("https://www.youtube.com/watch?v=X-AJdKty74M&feature=share&at=5")).toBe(0)
        expect(getUrlTimestamp("X-AJdKty74M")).toBe(0)
    })

    it("still extracts the clean video ID from timestamped links", () => {
        expect(trimPlayerId("https://www.youtube.com/live/X-AJdKty74M?si=abc&t=1234", "youtube")).toBe("X-AJdKty74M")
        expect(trimPlayerId("https://youtu.be/X-AJdKty74M?t=1234", "youtube")).toBe("X-AJdKty74M")
    })
})
