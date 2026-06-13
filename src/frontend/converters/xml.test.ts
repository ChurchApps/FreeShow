// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { xml2json } from "./xml"

describe("xml2json", () => {
    it("parses nested elements into a JSON object", () => {
        expect(xml2json("<root><a>1</a><b>2</b></root>")).toEqual({ root: { a: "1", b: "2" } })
    })

    it("captures attributes with an @ prefix", () => {
        expect(xml2json('<root id="5"><a>x</a></root>')).toEqual({ root: { "@id": "5", a: "x" } })
    })

    it("collapses repeated elements into an array", () => {
        expect(xml2json("<root><a>1</a><a>2</a></root>")).toEqual({ root: { a: ["1", "2"] } })
    })

    it("strips the XML declaration header before parsing", () => {
        expect(xml2json('<?xml version="1.0" encoding="UTF-8"?>\n<root><a>hi</a></root>')).toEqual({ root: { a: "hi" } })
    })
})
