// Tiny TipTap extension: font size as a text-style mark (like color/font-family).
// TipTap has no official v2 font-size extension, so we extend TextStyle's
// global attributes — same trick the community kitchen uses.

import { Extension } from "@tiptap/core"
import type { Chain } from "@tiptap/core"

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        fontSize: {
            setFontSize: (fontSize: number) => ReturnType
            unsetFontSize: () => ReturnType
        }
    }
}

export const FontSize = Extension.create({
    name: "fontSize",

    addOptions() {
        return {
            types: ["textStyle"]
        }
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: (element: HTMLElement) => {
                            const size = element.style?.fontSize as string | undefined
                            if (!size) return null
                            // normalize px / em -> single px value so FreeShow's
                            // resolveFontSize (which reads the raw number) works
                            const px = Number.parseFloat(size)
                            if (Number.isNaN(px)) return null
                            if (/px/i.test(size)) return Math.round(px).toString()
                            return Math.round(px * 100).toString() // 1em = 100px baseline
                        },
                        renderHTML: (attributes: Record<string, unknown>) => {
                            if (!attributes.fontSize) return {}
                            return { style: `font-size:${attributes.fontSize}px;` }
                        }
                    }
                }
            }
        ]
    },

    addCommands() {
        return {
            setFontSize:
                (fontSize: number) =>
                ({ chain }: { chain: Chain }) =>
                    chain()
                        .setMark("textStyle", { fontSize: Math.max(8, Math.round(fontSize)).toString() })
                        .run(),
            unsetFontSize:
                () =>
                ({ chain }: { chain: Chain }) =>
                    chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run()
        }
    }
})
