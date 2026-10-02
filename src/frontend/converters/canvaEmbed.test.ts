import { describe, expect, it, vi } from "vitest"

vi.mock("../classes/Show", () => ({ ShowObj: class {} }))
vi.mock("../components/helpers/history", () => ({ history: vi.fn() }))
vi.mock("../components/helpers/show", () => ({ checkName: (name: string) => name }))
vi.mock("../stores", () => ({ activeProject: { subscribe: () => () => {} } }))

const { parseCanvaLink } = await import("./canvaEmbed")

const EMBED = "https://www.canva.com/design/DAGabc123/AbCdEfGh/view?embed"

describe("parseCanvaLink", () => {
    it("keeps a smart embed link", () => {
        expect(parseCanvaLink(EMBED)).toEqual({ url: EMBED, designId: "DAGabc123" })
    })

    it("converts a public view link", () => {
        const link = "https://www.canva.com/design/DAGabc123/AbCdEfGh/view?utm_content=DAGabc123&utm_campaign=designshare&utm_medium=link&utm_source=publishsharelink"
        expect(parseCanvaLink(link)).toEqual({ url: EMBED, designId: "DAGabc123" })
    })

    it("converts a shared view link", () => {
        expect(parseCanvaLink("https://www.canva.com/design/DAGxyz789/Q1w2E3r4T5y6U7i8O9p0aS/view")).toEqual({ url: "https://www.canva.com/design/DAGxyz789/Q1w2E3r4T5y6U7i8O9p0aS/view?embed", designId: "DAGxyz789" })
    })

    it("reads the src of embed code", () => {
        const code = `<div style="position: relative; width: 100%;"><iframe loading="lazy" style="position: absolute;" src="https:&#x2F;&#x2F;www.canva.com&#x2F;design&#x2F;DAGabc123&#x2F;AbCdEfGh&#x2F;view?embed" allowfullscreen="allowfullscreen" allow="fullscreen"></iframe></div>`
        expect(parseCanvaLink(code.replaceAll("&#x2F;", "/"))).toEqual({ url: EMBED, designId: "DAGabc123" })
    })

    it("handles links without protocol, share token or with watch", () => {
        expect(parseCanvaLink("canva.com/design/DAGabc123/view")).toEqual({ url: "https://www.canva.com/design/DAGabc123/view?embed", designId: "DAGabc123" })
        expect(parseCanvaLink("https://www.canva.com/design/DAGabc123/AbCdEfGh/watch")).toEqual({ url: "https://www.canva.com/design/DAGabc123/AbCdEfGh/watch?embed", designId: "DAGabc123" })
    })

    it("rejects edit, short and other links", () => {
        expect(parseCanvaLink("https://www.canva.com/design/DAGabc123/AbCdEfGh/edit")).toEqual({ error: "edit" })
        expect(parseCanvaLink("https://canva.link/abc123")).toEqual({ error: "short" })
        expect(parseCanvaLink("https://example.com/design/DAGabc123/view")).toEqual({ error: "invalid" })
        expect(parseCanvaLink("https://www.canva.com/folder/123")).toEqual({ error: "invalid" })
        expect(parseCanvaLink("")).toEqual({ error: "invalid" })
    })
})
