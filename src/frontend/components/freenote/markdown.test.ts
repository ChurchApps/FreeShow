import { describe, expect, it, vi } from "vitest"
import { blockToItem, parseInlineMarkdown, renderMarkdown, showToMarkdown, splitBlocks } from "./markdown"

// dompurify's node build exports a factory (no window). Stub sanitize so the
// preview pipeline can be tested without a DOM.
vi.mock("dompurify", () => ({
    default: { sanitize: (html: string) => String(html) }
}))

describe("splitBlocks", () => {
    it("splits on --- separators", () => {
        const blocks = splitBlocks("Hello\n---\nSecond slide")
        expect(blocks).toHaveLength(2)
        expect(blocks[0]).toBe("Hello")
        expect(blocks[1]).toBe("Second slide")
    })

    it("returns a single block when no separator", () => {
        expect(splitBlocks("One\nTwo")).toEqual(["One\nTwo"])
    })

    it("filters out empty blocks", () => {
        expect(splitBlocks("A\n---\n---\nB")).toEqual(["A", "B"])
    })

    it("handles non-string input", () => {
        expect(splitBlocks(null as unknown as string)).toEqual([])
    })
})

describe("renderMarkdown", () => {
    it("returns empty string for empty input", () => {
        expect(renderMarkdown("")).toBe("")
        expect(renderMarkdown("   ")).toBe("")
    })

    it("renders markdown to html", () => {
        const html = renderMarkdown("# Hello **world**")
        expect(html).toContain("<h1>")
        expect(html).toContain("<strong>world</strong>")
    })

    it("passes output through the sanitizer", () => {
        const result = renderMarkdown("<script>alert(1)</script>")
        expect(typeof result).toBe("string")
    })

    it("expands size and font tokens into styled spans (no literal brackets)", () => {
        const html = renderMarkdown("[size:140]bigger[/size] and [font:'Georgia']serif[/font]")
        expect(html).not.toContain("[size:")
        expect(html).not.toContain("[font:")
        expect(html).toContain('font-size:140px')
        expect(html).toContain("font-family:'Georgia'")
    })
})

describe("parseInlineMarkdown", () => {
    it("returns plain text unchanged", () => {
        expect(parseInlineMarkdown("Hello")).toEqual([{ value: "Hello", style: "" }])
    })

    it("parses bold", () => {
        expect(parseInlineMarkdown("**strong**")).toEqual([{ value: "strong", style: "font-weight:bold;" }])
    })

    it("parses italic", () => {
        expect(parseInlineMarkdown("*em*")).toEqual([{ value: "em", style: "font-style:italic;" }])
    })

    it("parses underline", () => {
        expect(parseInlineMarkdown("__under__")).toEqual([{ value: "under", style: "text-decoration:underline;" }])
    })

    it("parses code", () => {
        expect(parseInlineMarkdown("`code`")).toEqual([{ value: "code", style: "font-family:monospace;" }])
    })

    it("parses inline font size", () => {
        expect(parseInlineMarkdown("[size:140]bigger[/size]")).toEqual([{ value: "bigger", style: "font-size:140px;" }])
    })

    it("parses inline font family", () => {
        expect(parseInlineMarkdown("[font:Georgia]serif[/font]")).toEqual([{ value: "serif", style: "font-family:Georgia;" }])
    })

    it("mixes inline segments", () => {
        const segments = parseInlineMarkdown("a **b** c")
        expect(segments).toEqual([
            { value: "a ", style: "" },
            { value: "b", style: "font-weight:bold;" },
            { value: " c", style: "" }
        ])
    })

    it("keeps each segment's own style inside a line", () => {
        const item = blockToItem("hello **bold**")
        const texts = item.lines[0].text
        expect(texts[0]).toEqual({ value: "hello ", style: "" })
        expect(texts[1]).toEqual({ value: "bold", style: "font-weight:bold;" })

        const sized = blockToItem("hello [size:140]bigger[/size]")
        expect(sized.lines[0].text[0].style).toBe("")
        expect(sized.lines[0].text[1].style).toBe("font-size:140px;")
    })
})

describe("blockToItem", () => {
    it("builds a full-screen text item", () => {
        const item = blockToItem("Welcome home")
        expect(item.type).toBe("text")
        expect(item.textFit).toBe("none")
        expect(item.lines).toHaveLength(1)
        expect(item.lines[0].text[0].value).toBe("Welcome home")
        expect(item.style).toContain("height:904px;")
    })

    it("turns headings into bold lines", () => {
        const item = blockToItem("# Title")
        expect(item.lines[0].text[0].style).toContain("font-weight:bold;")
        expect(item.lines[0].text[0].value).toBe("Title")
    })

    it("makes h1 bigger than h4, both bigger than normal text", () => {
        const h1 = blockToItem("# Big")
        const h4 = blockToItem("#### Small")
        const plain = blockToItem("Normal")
        expect(h1.lines[0].text[0].style).toContain("font-size:360px;")
        expect(h4.lines[0].text[0].style).toContain("font-size:140px;")
        expect(plain.lines[0].text[0].style).not.toContain("font-size:")
        expect(h1.lines[0].text[0].style).not.toBe(h4.lines[0].text[0].style)
    })

    it("uses template alignment as default", () => {
        const template = {
            id: "full_announcement",
            name: "Full Announcement",
            backgroundColor: "",
            textAlign: "text-align:center;"
        }
        const item = blockToItem("Hello", template)
        expect(item.lines[0].align).toBe("text-align:center;")
    })

    it("positions each line independently with a per-line align token", () => {
        const item = blockToItem("[align:left]One\n[align:center]Two\n[align:right]Three")
        expect(item.lines[0].align).toBe("text-align:left;")
        expect(item.lines[0].text[0].value).toBe("One")
        expect(item.lines[1].align).toBe("text-align:center;")
        expect(item.lines[1].text[0].value).toBe("Two")
        expect(item.lines[2].align).toBe("text-align:right;")
        // a line without the token keeps the default alignment
        expect(blockToItem("[align:right]A\nB").lines[1].align).toBe("text-align:center;")
    })

    it("places the text block vertically via item.align", () => {
        const template = { id: "x", name: "x", backgroundColor: "", textAlign: "text-align:center;" }
        expect(blockToItem("Hello", template, "top").align).toBe("align-items:flex-start;")
        expect(blockToItem("Hello", template, "bottom").align).toBe("align-items:flex-end;")
        expect(blockToItem("Hello", template, "center").align).toBeUndefined()
    })

    it("positions the text block horizontally via item.align", () => {
        const template = { id: "x", name: "x", backgroundColor: "", textAlign: "text-align:center;" }
        expect(blockToItem("Hello", template, "", "left").align).toBe("justify-content:flex-start;")
        expect(blockToItem("Hello", template, "", "right").align).toBe("justify-content:flex-end;")
        // center (default) => nothing set
        expect(blockToItem("Hello", template, "", "center").align).toBeUndefined()
        // combines with vertical
        expect(blockToItem("Hello", template, "top", "right").align).toBe("align-items:flex-start;justify-content:flex-end;")
    })

    it("turns list items into bullets", () => {
        const item = blockToItem("- One\n- Two")
        expect(item.lines[0].text[0].value).toBe("• One")
        expect(item.lines[1].text[0].value).toBe("• Two")
    })

    it("applies template styles", () => {
        const item = blockToItem("Notice", {
            id: "emergency_banner",
            name: "Emergency Banner",
            backgroundColor: "#c00000",
            itemStyle: "top:0px;left:0px;height:1080px;width:1920px;",
            textAlign: "text-align:center;",
            textColor: "#ffffff",
            fontSize: "2.2em"
        })
        expect(item.style).toContain("height:1080px;")
        expect(item.style).toContain("color:#ffffff;")
        expect(item.style).toContain("font-size:2.2em;")
        expect(item.lines[0].align).toBe("text-align:center;")
    })

    it("turns blank lines into vertical spacing", () => {
        const item = blockToItem("A\n\n\nB")
        // each blank line becomes an empty (spacer) line, only `---` splits slides
        expect(item.lines).toHaveLength(4)
        expect(item.lines[0].text[0].value).toBe("A")
        expect(item.lines[1].text[0].value).toBe("\u00A0")
        expect(item.lines[2].text[0].value).toBe("\u00A0")
        expect(item.lines[3].text[0].value).toBe("B")
    })
})

describe("showToMarkdown", () => {
    it("returns empty for a show without slides", () => {
        expect(showToMarkdown({} as any)).toBe("")
    })

    it("reverses text items into markdown blocks separated by ---", () => {
        const show: any = {
            settings: { activeLayout: "l1" },
            layouts: { l1: { slides: [{ id: "s1" }, { id: "s2" }] } },
            slides: {
                s1: {
                    items: [
                        {
                            type: "text",
                            lines: [{ text: [{ value: "Headline", style: "font-size:360px;font-weight:bold;" }] }]
                        }
                    ]
                },
                s2: {
                    items: [
                        {
                            type: "text",
                            lines: [
                                { text: [{ value: "Bold", style: "font-weight:bold;" }] },
                                { text: [{ value: "Normal", style: "" }] }
                            ]
                        }
                    ]
                }
            }
        }
        expect(showToMarkdown(show)).toBe("[size:360]Headline[/size]\n---\n**Bold**\nNormal")
    })

    it("skips media items", () => {
        const show: any = {
            settings: { activeLayout: "l1" },
            layouts: { l1: { slides: [{ id: "s1" }] } },
            slides: {
                s1: {
                    items: [{ type: "video", src: "clip.mp4" }, { type: "text", lines: [{ text: [{ value: "Hi", style: "" }] }] }]
                }
            }
        }
        expect(showToMarkdown(show)).toBe("Hi")
    })
})
