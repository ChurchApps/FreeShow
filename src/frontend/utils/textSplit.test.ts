import { describe, expect, it } from "vitest"
import { includeTrailingClosing, nearestPunctuationBreak } from "./textSplit"

const ASCII = [".", ",", "!", "?"]

describe("includeTrailingClosing", () => {
    it("moves past a closing quote so it is not orphaned", () => {
        const text = "神說：「要有光。」就有了光。"
        expect(includeTrailingClosing(text, text.indexOf("」"))).toBe(text.indexOf("」") + 1)
    })

    it("moves past several closing marks", () => {
        expect(includeTrailingClosing("甲。」）乙", 2)).toBe(4)
    })

    it("leaves positions that are not on a closing mark alone", () => {
        expect(includeTrailingClosing("起初神創造天地。", 3)).toBe(3)
    })

    it("never runs past the end of the text", () => {
        expect(includeTrailingClosing("甲。」", 2)).toBe(3)
    })
})

describe("nearestPunctuationBreak", () => {
    it("picks the candidate closest to the centre, not the last one", () => {
        //            0123456789...
        const text = "aa, bbbbbb, cccccc, dd"
        // centre is 11, which is the second comma
        expect(nearestPunctuationBreak(text, ASCII, 11, 11)).toBe(11)
    })

    it("stays within the margin", () => {
        expect(nearestPunctuationBreak("aaaa, bbbbbbbbbbbbbbbbbbbb", ASCII, 20, 3)).toBe(-1)
    })

    it("keeps a closing quote with the first half", () => {
        const text = "他說：「要有光。」於是就有了光，天地都被造成"
        const index = nearestPunctuationBreak(text, ["。"], 8, 4)
        expect(text.slice(0, index).endsWith("。」")).toBe(true)
    })

    it("skips a candidate that would leave the second half empty, and keeps looking", () => {
        // the final 。 is nearest to the centre for this margin but breaking there
        // yields nothing to move to the next slide — the earlier one must win
        const text = "耶和華是我的牧者，我必不致缺乏。"
        expect(nearestPunctuationBreak(text, ["，", "。"], 12, 12)).toBe(text.indexOf("，") + 1)
    })

    it("returns -1 when the only candidate ends the text", () => {
        expect(nearestPunctuationBreak("起初神創造天地。", ["。"], 4, 8)).toBe(-1)
    })

    it("returns -1 when there is no candidate at all", () => {
        expect(nearestPunctuationBreak("起初神創造天地", ["。"], 3, 3)).toBe(-1)
    })

    it("handles a fractional margin without skipping every index", () => {
        // margin used to be center/2, which made every loop index fractional and
        // text[i] always undefined for odd centres
        const text = "aaaaaaaaaaaaaa, bbbbbbbbbbbbbbb"
        expect(nearestPunctuationBreak(text, ASCII, 15, 7.5)).toBe(15)
    })
})
