import { describe, expect, it } from "vitest"
import { appendTailWords, trimRepeatedLeadWords } from "./seam"

describe("trimRepeatedLeadWords", () => {
    it("drops a leading run that repeats the emitted tail", () => {
        expect(trimRepeatedLeadWords(["let", "your", "house", "be", "covered."], "be covered. You're going in place.")).toBe("You're going in place.")
    })

    it("matches punctuation & case insensitively", () => {
        expect(trimRepeatedLeadWords(["in", "the", "name", "of", "Jesus."], "Jesus, we block it now!")).toBe("we block it now!")
    })

    it("keeps text with no repeated run", () => {
        expect(trimRepeatedLeadWords(["in", "the", "beginning"], "God created the heaven")).toBe("God created the heaven")
    })

    it("prefers the longest repeated run", () => {
        // "the" alone also matches the tail - the full three word run must win
        expect(trimRepeatedLeadWords(["and", "God", "said", "let", "there"], "let there be light")).toBe("be light")
    })

    it("returns an empty string when everything was already emitted", () => {
        expect(trimRepeatedLeadWords(["for", "God", "so", "loved"], "so loved")).toBe("")
    })

    it("passes text through when nothing was emitted yet", () => {
        expect(trimRepeatedLeadWords([], "In the beginning")).toBe("In the beginning")
    })
})

describe("appendTailWords", () => {
    it("keeps only the newest words up to the match window", () => {
        let tail: string[] = []
        tail = appendTailWords(tail, "In the beginning God created")
        tail = appendTailWords(tail, "the heaven and the earth")
        expect(tail).toHaveLength(8)
        expect(tail[tail.length - 1]).toBe("earth")
        expect(tail[0]).toBe("beginning")
    })
})
