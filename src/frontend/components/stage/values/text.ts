import type { EditInput } from "../../edit/values/boxes"

export const slideTextEdits: EditInput[] = [
    { name: "slide_offset", id: "slideOffset", input: "number", value: 0, values: { min: -10, max: 20 } },
    { name: "max_lines", id: "lineCount", input: "number", value: 0 },
    { name: "includeMedia", id: "includeMedia", input: "checkbox", value: false },
    { name: "keepStyle", id: "keepStyle", input: "checkbox", value: false },
    { name: "invert_items", id: "invertItems", input: "checkbox", value: false },
]

export const slideNotesEdit: EditInput[] = [{ name: "slide_offset", id: "slideOffset", input: "number", value: 0, values: { min: -10, max: 20 } }]

export const variableEdits: EditInput[] = [
    {
        name: "popup.variable",
        input: "selectVariable",
        id: "variable.id",
        value: "",
    },
]
