import type { EditInput } from "../../edit/values/boxes"

export const textEdits: { [key: string]: EditInput[] } = {
    chords: [
        { name: "chords", id: "chords", input: "checkbox", value: false },
        { name: "color", id: "chordsData.color", input: "color", value: "#FF851B", hidden: true },
        { name: "size", id: "chordsData.size", input: "number", value: 30, hidden: true },
    ],
    font: [
        { name: "family", id: "style", key: "font-family", input: "fontDropdown", value: "Arial" },
        { name: "color", id: "style", key: "color", input: "color", value: "#FFFFFF" },
        { name: "size", id: "style", key: "font-size", input: "number", value: 100, extension: "px", disabled: "auto" },
        { name: "auto_size", id: "auto", input: "checkbox", value: true },
    ],
    style: [
        { input: "font-style" },
        { name: "line_spacing", id: "style", key: "line-height", input: "number", value: 1.1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, extension: "em" },
        { name: "letter_spacing", id: "style", key: "letter-spacing", input: "number", value: 0, values: { max: 100, min: -1000 }, extension: "px" },
        { name: "word_spacing", id: "style", key: "word-spacing", input: "number", value: 0, values: { min: -100 }, extension: "px" },
    ],
    // align: [{ input: "align-x" }, { input: "align-y" }],
    outline: [
        { name: "color", id: "style", key: "-webkit-text-stroke-color", input: "color", value: "#000000" },
        { name: "width", id: "style", key: "-webkit-text-stroke-width", input: "number", value: 0, values: { max: 100 }, extension: "px" },
    ],
    shadow: [
        { name: "color", id: "style", key: "text-shadow", valueIndex: 3, input: "color", value: "#000000" },
        { name: "offsetX", id: "style", key: "text-shadow", valueIndex: 0, input: "number", value: 2, values: { min: -1000 }, extension: "px" },
        { name: "offsetY", id: "style", key: "text-shadow", valueIndex: 1, input: "number", value: 2, values: { min: -1000 }, extension: "px" },
        { name: "blur", id: "style", key: "text-shadow", valueIndex: 2, input: "number", value: 10, extension: "px" },
    ],
}
