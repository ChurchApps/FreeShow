// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { chunkRichHtml, getProjectionStyle, htmlToItems, htmlToMarkdown, sanitizeRich } from "./rich"
import { blockToItem } from "./markdown"

describe("sanitizeRich (XSS gate)", () => {
    it("strips scripts and event handlers", () => {
        const out = sanitizeRich('<p onclick="alert(1)">hi</p><script>alert(2)</script><img src=x onerror="alert(3)">')
        expect(out).not.toContain("<script")
        expect(out).not.toContain("onclick")
        expect(out).not.toContain("onerror")
        expect(out).toContain("hi")
    })

    it("keeps allowed formatting markup", () => {
        const out = sanitizeRich('<p><strong>bold</strong> <span style="color:red">red</span></p>')
        expect(out).toContain("<strong>bold</strong>")
        expect(out).toContain("color:red")
    })

    it("does not allow ids/classes to leak through", () => {
        const out = sanitizeRich('<p id="x" class="y" style="font-size:20px">ok</p>')
        expect(out).toContain("font-size:20px")
        expect(out).not.toContain("id=")
        expect(out).not.toContain('class="')
    })

    it("strips dangerous CSS properties and javascript/expression payloads", () => {
        const out = sanitizeRich('<p style="position:fixed;left:0;background-image:url(javascript:alert(1));width:expression(alert(1));color:red">ok</p>')
        expect(out).not.toContain("position:")
        expect(out).not.toContain("javascript:")
        expect(out).not.toContain("expression(")
        expect(out).not.toContain("background-image")
        expect(out).toContain("color:red")
    })

    it("keeps allowed style properties", () => {
        const out = sanitizeRich('<p style="font-family:Georgia;font-size:40px;text-align:center;color:#fff;background-color:#000">ok</p>')
        expect(out).toContain("font-family:Georgia;")
        expect(out).toContain("font-size:40px;")
        expect(out).toContain("text-align:center;")
        expect(out).toContain("color:#fff;")
        expect(out).toContain("background-color:#000;")
    })
})

describe("chunkRichHtml", () => {
    it("splits the document into slides on horizontal rules", () => {
        const chunks = chunkRichHtml("<p>One</p><hr><p>Two</p><hr><p>Three</p>")
        expect(chunks).toEqual(["<p>One</p>", "<p>Two</p>", "<p>Three</p>"])
    })

    it("returns a single chunk without separators", () => {
        expect(chunkRichHtml("<p>Only</p>")).toEqual(["<p>Only</p>"])
    })

    it("drops empty chunks", () => {
        expect(chunkRichHtml("<p>a</p><hr><p></p><hr>")).toEqual(["<p>a</p>"])
    })
})

describe("htmlToItems", () => {
    const template = { id: "full_announcement", name: "Full Announcement", backgroundColor: "", textAlign: "text-align:center;" }

    it("builds a text item with one line per paragraph", () => {
        const items = htmlToItems("<p>Hello</p><p>World</p>", template)
        expect(items).toHaveLength(1)
        expect(items[0].type).toBe("text")
        expect(items[0].textFit).toBe("none")
        expect(items[0].lines).toHaveLength(2)
        expect(items[0].lines[0].text[0].value).toBe("Hello")
        expect(items[0].lines[1].text[0].value).toBe("World")
    })

    it("uses the template default alignment", () => {
        const items = htmlToItems("<p>Hello</p>", template)
        expect(items[0].lines[0].align).toBe("text-align:center;")
    })

    it("respects per-paragraph text-align", () => {
        const items = htmlToItems('<p style="text-align: left">Left</p>', template)
        expect(items[0].lines[0].align).toBe("text-align:left;")
    })

    it("maps headings to large bold lines", () => {
        const items = htmlToItems("<h1>Title</h1><h4>Small</h4>")
        expect(items[0].lines[0].text[0].value).toBe("Title")
        expect(items[0].lines[0].text[0].style).toContain("font-size:360px;")
        expect(items[0].lines[0].text[0].style).toContain("font-weight:bold;")
        expect(items[0].lines[1].text[0].style).toContain("font-size:140px;")
    })

    it("keeps inline marks on their own segments", () => {
        const items = htmlToItems("<p>a <strong>bold</strong> <em>it</em> <u>un</u></p>")
        const text = items[0].lines[0].text
        expect(text[0].value).toBe("a ")
        expect(text[1]).toEqual({ value: "bold", style: "font-weight:bold;" })
        expect(text[2].value).toBe(" ")
        expect(text[3]).toEqual({ value: "it", style: "font-style:italic;" })
        expect(text[5]).toEqual({ value: "un", style: "text-decoration:underline;" })
    })

    it("combines nested span and mark styles", () => {
        const items = htmlToItems('<p><span style="font-size: 60px"><strong>big</strong></span></p>')
        expect(items[0].lines[0].text[0]).toEqual({ value: "big", style: "font-size:60px;font-weight:bold;" })
    })

    it("applies the default font only when the segment has no font-family", () => {
        const items = htmlToItems('<p>plain <span style="font-family: Georgia">serif</span></p>', null, "", "", "'CMGSans'")
        const text = items[0].lines[0].text
        expect(text[0].value).toBe("plain ")
        expect(text[0].style).toContain("font-family:'CMGSans';")
        expect(text[1].value).toBe("serif")
        expect(text[1].style).toContain("font-family:Georgia;")
        expect(text[1].style).not.toContain("'CMGSans'")
    })

    it("expands <br> into separate lines", () => {
        const items = htmlToItems("<p>One<br>Two<br>Three</p>")
        expect(items[0].lines.map((l) => l.text[0].value)).toEqual(["One", "Two", "Three"])
    })

    it("turns lists into bullet/ordered lines", () => {
        const items = htmlToItems("<ul><li>One</li><li>Two</li></ul><ol><li>First</li><li>Second</li></ol>")
        const values = items[0].lines.map((l) => l.text.map((t) => t.value).join(""))
        expect(values).toEqual(["• One", "• Two", "1. First", "2. Second"])
    })

    it("builds a native table item", () => {
        const items = htmlToItems("<table><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>")
        const table = items.find((item) => item.type === "table")
        expect(table?.type).toBe("table")
        expect(table?.table?.rows).toHaveLength(2)
        expect(table?.table?.rows[0].cells[0].text).toBe("A")
        expect(table?.table?.rows[0].cells[0].style).toContain("font-weight:bold;")
        expect(table?.table?.rows[1].cells[1].text).toBe("2")
    })

    it("returns [] for empty content", () => {
        expect(htmlToItems("", template)).toEqual([])
    })

    it("lets a nested block's own text-align override an inherited parent alignment", () => {
        const items = htmlToItems('<div style="text-align: center"><p style="text-align: left">Left</p></div>', template)
        expect(items[0].lines[0].align).toBe("text-align:left;")
    })

    it("renders links with a link color", () => {
        const items = htmlToItems('<p>read <a href="https://example.com">more</a></p>', template)
        const seg = items[0].lines[0].text[1]
        expect(seg.value).toBe("more")
        expect(seg.style).toContain("color:")
    })

    it("renders sub and sup scripts", () => {
        const items = htmlToItems("<p>H<sub>2</sub>O and e<sup>x</sup></p>", template)
        const text = items[0].lines[0].text
        expect(text[1]).toEqual({ value: "2", style: "vertical-align:sub;" })
        expect(text[3]).toEqual({ value: "x", style: "vertical-align:super;" })
    })

    it("renders blockquotes as plain lines", () => {
        const items = htmlToItems("<blockquote>A quote</blockquote>", template)
        expect(items[0].lines[0].text[0].value).toBe("A quote")
    })

    it("renders pre blocks as plain lines", () => {
        const items = htmlToItems("<pre>line1\nline2</pre>", template)
        expect(items[0].lines[0].text[0].value).toContain("line1")
    })
})

describe("projection style", () => {
    it("gives css for each projection preset", () => {
        expect(getProjectionStyle("outline")).toContain("text-stroke")
        expect(getProjectionStyle("shadow")).toContain("text-shadow")
        expect(getProjectionStyle("contrast")).toContain("text-stroke")
        expect(getProjectionStyle("none")).toBe("")
        expect(getProjectionStyle("bogus")).toBe("")
    })

    it("applies the projection style to built lines", () => {
        const items = htmlToItems("<p>Note</p>", null, "", "", "", "outline")
        expect(items[0].lines[0].text[0].style).toContain("-webkit-text-stroke-width:2px;")
    })
})

describe("htmlToMarkdown", () => {
    it("emits real markdown (headings, bold, bullets) split into --- slides", () => {
        expect(htmlToMarkdown("<h1>Title</h1><hr><p>Body with <strong>bold</strong> and <em>it</em> and <u>un</u></p>")).toBe("# Title\n---\nBody with **bold** and *it* and __un__")
    })

    it("converts lists, blockquotes, links, and font-size tokens", () => {
        const md = htmlToMarkdown('<ul><li>One</li><li>Two</li></ul><ol><li>First</li></ol><blockquote>A quote</blockquote><p>See <a href="https://example.com">here</a></p><p><span style="font-size: 60px">Big</span></p>')
        expect(md).toContain("- One")
        expect(md).toContain("- Two")
        expect(md).toContain("1. First")
        // blockquote emits plain text: the FreeNote compiler wouldn't strip `>`
        expect(md).toContain("A quote")
        expect(md).not.toContain("> A quote")
        expect(md).toContain("[here](https://example.com)")
        expect(md).toContain("[size:60]Big[/size]")
    })

    it("preserves br line breaks within a paragraph", () => {
        const md = htmlToMarkdown("<p>line1<br>line2</p>")
        expect(md).toBe("line1\nline2")
    })

    it("emits sub/sup/strike/highlight as plain text (compiler cannot round-trip those tokens)", () => {
        const md = htmlToMarkdown("<p>H<sub>2</sub>O and e<sup>x</sup> and <s>old</s> and <mark>hi</mark></p>")
        expect(md).toBe("H2O and ex and old and hi")
        expect(md).not.toContain("~")
        expect(md).not.toContain("^")
        expect(md).not.toContain("~~")
        expect(md).not.toContain("==")
    })

    it("round-trips through the markdown compiler without literal token junk", () => {
        const md = htmlToMarkdown("<p>H<sub>2</sub>O, <s>old</s>, <blockquote>quote</blockquote></p>")
        const item = blockToItem(md)
        const text = item.lines.map((l) => l.text.map((t) => t.value).join("")).join(" ")
        expect(text).not.toMatch(/[~^=]/)
        expect(text).not.toContain("> ")
        expect(text).toContain("H2O")
        expect(text).toContain("old")
        expect(text).toContain("quote")
    })

    it("preserves paragraph alignment as [align:] tokens", () => {
        const md = htmlToMarkdown('<p style="text-align: right">Right</p>')
        expect(md).toBe("[align:right]Right")
    })

    it("flattens tables to pipe rows", () => {
        const md = htmlToMarkdown("<table><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>")
        expect(md).toBe("A | B\n1 | 2")
    })

    it("returns empty for empty input", () => {
        expect(htmlToMarkdown("")).toBe("")
        expect(htmlToMarkdown("<p></p><hr>")).toBe("")
    })
})
