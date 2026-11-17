import { describe, expect, it } from "vitest"
import { hasVisibleLineText } from "./lineBackground"

describe("line background visibility", () => {
    it.each(["", " ", "\n\t\r", "\u00a0", "\u200b\u200c\u200d\u2060\ufeff", "<br>", "<br />\n<br>", "<span></span>", "<span> &nbsp; </span>", "&#160;", "&#xA0;", "&#32;", "&ensp;&emsp;&thinsp;"])("does not draw a background for a blank rendered line: %j", (value) => {
        expect(hasVisibleLineText(value)).toBe(false)
    })

    it.each(["Amazing grace", "Kasih-Mu", "祢的恩典", "🎵", "<span>Lyric</span><br>", " &nbsp; Lyric &nbsp; ", "&amp;", "&lt;br&gt;", "&#60;br&#62;", "<3", "&#1114112;"])("retains the background for visible rendered text: %j", (value) => {
        expect(hasVisibleLineText(value)).toBe(true)
    })
})
