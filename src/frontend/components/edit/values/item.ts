import type { EditInput } from "./boxes"

const borderOptions: any[] = [
    { name: "$:borders.solid:$", id: "solid" },
    { name: "$:borders.dashed:$", id: "dashed" },
    { name: "$:borders.dotted:$", id: "dotted" },
    { name: "$:borders.double:$", id: "double" },
    { name: "$:borders.inset:$", id: "inset" },
    { name: "$:borders.outset:$", id: "outset" },
    { name: "$:borders.groove:$", id: "groove" },
    { name: "$:borders.ridge:$", id: "ridge" },
]

export const itemEdits: { [key: string]: EditInput[] } = {
    item: [
        { name: "x", id: "style", key: "left", input: "number", value: 0, values: { min: -100000, max: 100000 }, extension: "px" },
        { name: "y", id: "style", key: "top", input: "number", value: 0, values: { min: -100000, max: 100000 }, extension: "px" },
        { name: "width", id: "style", key: "width", input: "number", value: 0, values: { min: -100000, max: 100000 }, extension: "px" },
        { name: "height", id: "style", key: "height", input: "number", value: 0, values: { min: -100000, max: 100000 }, extension: "px" },
    ],
    transform: [
        { name: "rotation", id: "transform", key: "rotate", input: "number", value: 0, values: { max: 360 }, extension: "deg" },
        { name: "media.flip", id: "transform", key: "scaleX", input: "number", value: 1, values: { min: -1, max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
        { name: "tilt", id: "transform", key: "rotateX", input: "number", value: 0, values: { max: 360 }, extension: "deg" },
        { name: "perspective", id: "transform", key: "perspective", input: "number", value: 0, values: { max: 5000 }, extension: "px" },
    ],
    style: [
        { name: "background_color", id: "style", key: "background-color", input: "color", value: "rgb(0 0 0 / 0)", enableNoColor: true },
        { name: "background_opacity", id: "background-opacity", input: "number", value: 1, values: { step: 0.1, decimals: 1, max: 1, inputMultiplier: 10 } },
        { name: "opacity", id: "style", key: "opacity", input: "number", value: 1, values: { step: 0.1, decimals: 1, max: 1, inputMultiplier: 10 } },
        { name: "corner_radius", id: "style", key: "border-radius", input: "number", value: 0, values: { step: 10, max: 500, inputMultiplier: 0.1 }, extension: "px" },
    ],
    border: [
        { name: "color", id: "style", key: "border-color", input: "color", value: "#FFFFFF" },
        { name: "width", id: "style", key: "border-width", input: "number", value: 0, values: { max: 500 }, extension: "px" },
        { name: "style", id: "style", key: "border-style", input: "dropdown", value: "solid", values: { options: borderOptions } },
    ],
    shadow: [
        { name: "color", id: "style", key: "box-shadow", valueIndex: 4, input: "color", value: "#000000" },
        { name: "offsetX", id: "style", key: "box-shadow", valueIndex: 0, input: "number", value: 0, values: { min: -1000 }, extension: "px" },
        { name: "offsetY", id: "style", key: "box-shadow", valueIndex: 1, input: "number", value: 0, values: { min: -1000 }, extension: "px" },
        { name: "blur", id: "style", key: "box-shadow", valueIndex: 2, input: "number", value: 0, extension: "px" },
        { name: "length", id: "style", key: "box-shadow", valueIndex: 3, input: "number", value: 0, values: { min: -100 }, extension: "px" },
    ],
    // TODO: inset shadow
    // shadow_inset: [
    //   { name: "color", id: "style", key: "inset_box-shadow", valueIndex: 5, input: "color", value: "#000000" },
    //   { name: "offsetX", id: "style", key: "inset_box-shadow", valueIndex: 1, input: "number", value: 0, values: { min: -1000 }, extension: "px" },
    //   { name: "offsetY", id: "style", key: "inset_box-shadow", valueIndex: 2, input: "number", value: 0, values: { min: -1000 }, extension: "px" },
    //   { name: "blur", id: "style", key: "inset_box-shadow", valueIndex: 3, input: "number", value: 0, extension: "px" },
    //   { name: "length", id: "style", key: "inset_box-shadow", valueIndex: 4, input: "number", value: 0, values: { min: -100 }, extension: "px" },
    // ],
    CSS: [{ id: "item", input: "CSS" }],
}
