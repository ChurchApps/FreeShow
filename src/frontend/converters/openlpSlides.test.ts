import { describe, expect, it } from "vitest"
import { splitOpenLPSlideLines } from "./openlpSlides"

describe("splitOpenLPSlideLines", () => {
    it("turns an OpenLP forced split into separate slides", () => {
        expect(splitOpenLPSlideLines(["First part[--}{--]Second part"])).toEqual([["First part"], ["Second part"]])
    })

    it("handles a forced split on its own line", () => {
        expect(splitOpenLPSlideLines(["First line", "[--}{--]", "Second line"])).toEqual([["First line"], ["Second line"]])
    })

    it("keeps supporting OpenLyrics HTML page breaks", () => {
        expect(splitOpenLPSlideLines(['First part<p style="page-break-after: always;"/>Second part'])).toEqual([["First part"], ["Second part"]])
    })
})
