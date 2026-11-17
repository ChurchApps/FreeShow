import { describe, expect, it } from "vitest"
import { mergeForTest } from "../../../../config/testing/templateMergeFixture"

function textbox(option: boolean | undefined, background?: string) {
    return { type: "text", style: "width:1500px;height:220px;", specialStyle: { ...(background ? { lineBg: background, lineGap: 20 } : {}), ...(option === undefined ? {} : { separateWrappedLines: option }) }, lines: [{ align: "text-align:center;", text: [{ value: "Existing text that wraps to another row", style: "font-size:60px;line-height:1.5em;" }] }] }
}

describe("wrapped-line option through output templates", () => {
    it.each([true, false])("preserves explicit slide setting %s when an older output template has no setting", (option) => {
        const slide = textbox(option)
        const template = textbox(undefined, "#000000")
        const merged = mergeForTest([slide], [template], true, true, false, "", {}, true)
        expect(merged[0].specialStyle).toEqual({ lineBg: "#000000", lineGap: 20, separateWrappedLines: option })
        expect(slide.specialStyle.separateWrappedLines).toBe(option)
        expect(template.specialStyle.separateWrappedLines).toBeUndefined()
    })

    it.each([true, false])("honors an explicit output-template setting %s", (option) => {
        const merged = mergeForTest([textbox(!option)], [textbox(option, "#000000")], true, true, false, "", {}, true)
        expect(merged[0].specialStyle.separateWrappedLines).toBe(option)
    })

    it("keeps legacy defaults and intentional Apply template replacement unchanged", () => {
        const template = textbox(undefined, "#000000")
        expect(mergeForTest([textbox(undefined)], [template], true, true, false, "", {}, true)[0].specialStyle.separateWrappedLines).toBeUndefined()
        expect(mergeForTest([textbox(true)], [template], false, true, true)[0].specialStyle.separateWrappedLines).toBeUndefined()
    })
})
