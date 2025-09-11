import { splitIntoRows, textSections, type EditBoxSection } from "../../edit/values/boxes"

export const slideTextSections: { [key: string]: EditBoxSection } = {
    default: {
        inputs: splitIntoRows([
            { id: "slideOffset", type: "number", value: 0, values: { label: "edit.slide_offset", min: -10, max: 20 } },
            { id: "lineCount", type: "number", value: 0, values: { label: "edit.max_lines", } },
            { id: "includeMedia", type: "checkbox", value: false, values: { label: "edit.includeMedia", } },
            { id: "keepStyle", type: "checkbox", value: false, values: { label: "edit.keepStyle", } },
            { id: "itemNumber", type: "number", value: 0, values: { label: "edit.item_number", } },
            { id: "invertItems", type: "checkbox", value: false, values: { label: "edit.invert_items", } },
        ])
    },
    font: {
        noReset: true,
        inputs: textSections.default.inputs
    },
    align: textSections.align,
    text: textSections.text,
    // lines: textSections.lines,
    outline: textSections.outline,
    shadow: textSections.shadow,
    chords: textSections.chords,
    special: textSections.special,
    // CSS: textSections.CSS,
}