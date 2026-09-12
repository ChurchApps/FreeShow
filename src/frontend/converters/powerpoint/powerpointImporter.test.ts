import { describe, expect, it } from "vitest"
import { mergeAdjacentTextRuns } from "./powerpointTextRuns"

describe("PowerPoint run merging", () => {
    it("merges adjacent same-style runs but preserves explicit line breaks", () => {
        const runs = [
            { value: "err=", style: "color: #000000; font-size: 24px;" },
            { value: "1", style: "color: #000000; font-size: 24px;" },
            { value: "<br>", style: "color: #000000; font-size: 24px;" },
            { value: "next", style: "color: #000000; font-size: 24px;" },
            { value: " line", style: "color: #ff0000; font-size: 24px;" }
        ]

        expect(mergeAdjacentTextRuns(runs)).toEqual([
            { value: "err=1", style: "color: #000000; font-size: 24px;" },
            { value: "<br>", style: "color: #000000; font-size: 24px;" },
            { value: "next", style: "color: #000000; font-size: 24px;" },
            { value: " line", style: "color: #ff0000; font-size: 24px;" }
        ])
    })
})
