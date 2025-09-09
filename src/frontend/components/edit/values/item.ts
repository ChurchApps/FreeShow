import { splitIntoRows, type EditBoxSection, type EditInput } from "./boxes"

export const sectionColors = {
    font: "#f079b4",
    align: "#f079b2",
    text: "#e490c9",
    lines: "#ffb6e7",
    list: "#a16adb",
    outline: "#d8d8d8",
    border: "#d8d8d8",
    shadow: "#9e9e9e",
    chords: "#ffbe86",
    scrolling: "#ceffbe",
    special: "#e9e495",
    position: "#f079b4",
    transform: "#f079b2",
    backdrop_filters: "#ceffbe",
    filters: "#ceffbe"
}

const borderOptions = [
    { value: "solid", label: "borders.solid" },
    { value: "dashed", label: "borders.dashed" },
    { value: "dotted", label: "borders.dotted" },
    { value: "double", label: "borders.double" },
    { value: "inset", label: "borders.inset" },
    { value: "outset", label: "borders.outset" },
    { value: "groove", label: "borders.groove" },
    { value: "ridge", label: "borders.ridge" },
]

const backdropFilters = splitIntoRows([
    { id: "backdrop-filter", key: "hue-rotate", type: "number", value: 0, extension: "deg", values: { label: "filter.hue-rotate", defaultValue: 0, step: 5, max: 360, showSlider: true, sliderValues: { step: 1 } } },
    { id: "backdrop-filter", key: "invert", type: "number", value: 0, multiplier: 10, values: { label: "filter.invert", defaultValue: 0, max: 10, showSlider: true } },
    { id: "backdrop-filter", key: "blur", type: "number", value: 0, extension: "px", values: { label: "filter.blur", defaultValue: 0, max: 100, showSlider: true, sliderValues: { max: 50 } } },
    { id: "backdrop-filter", key: "grayscale", type: "number", value: 0, multiplier: 10, values: { label: "filter.grayscale", defaultValue: 0, max: 10, showSlider: true } },
    // { id: "backdrop-filter", key: "sepia", type: "number", value: 0, multiplier: 10, values: { label: "filter.sepia", defaultValue: 0, max: 10, showSlider: true } },
    { id: "backdrop-filter", key: "brightness", type: "number", value: 1, multiplier: 10, values: { label: "filter.brightness", defaultValue: 10, max: 100, showSlider: true, sliderValues: { min: 2, max: 18 } } },
    { id: "backdrop-filter", key: "contrast", type: "number", value: 1, multiplier: 10, values: { label: "filter.contrast", defaultValue: 10, max: 100, showSlider: true, sliderValues: { min: 2, max: 18 } } },
    { id: "backdrop-filter", key: "saturate", type: "number", value: 1, multiplier: 10, values: { label: "filter.saturate", defaultValue: 10, max: 100, showSlider: true, sliderValues: { max: 20 } } },
    // { id: "backdrop-filter", key: "opacity", type: "number", value: 1, multiplier: 100, values: { label: "filter.opacity", defaultValue: 100, step: 10, max: 100, showSlider: true, sliderValues: { step: 1 } } }
])

export const itemSections: { [key: string]: EditBoxSection } = {
    default: {
        inputs: splitIntoRows([
            { id: "style", key: "background-color", type: "color", value: "", values: { label: "edit.background_color", allowGradients: true, allowOpacity: true, allowEmpty: true, noLabel: true } },
            // { id: "background-opacity", type: "number", value: 0, values: {label: "edit.background_opacity", step: 0.1, decimals: 1, min: 0.1, max: 1, inputMultiplier: 10 } },
            { id: "style", key: "opacity", type: "number", value: 1, multiplier: 100, values: { label: "edit.opacity", step: 10, min: 1, max: 100, showSlider: true, sliderValues: { step: 1 } } },
            { id: "style", key: "padding", type: "number", value: 0, extension: "px", values: { label: "edit.padding", step: 5, max: 300, showSlider: true, sliderValues: { step: 1 } } },
            { id: "style", key: "border-radius", type: "number", value: 0, multiplier: 0.1, values: { label: "edit.corner_radius", step: 2, max: 500, showSlider: true, sliderValues: { step: 1, max: 50 } }, extension: "px" },
        ])
    },
    position: {
        noReset: true,
        inputs: [[
            { id: "style", key: "left", type: "number", value: 2.5, extension: "px", values: { label: "edit.x", min: -200, max: 200 } },
            { id: "style", key: "top", type: "number", value: 11, extension: "px", values: { label: "edit.y", min: -200, max: 200 } },
        ], [
            { id: "style", key: "width", type: "number", value: 95, extension: "px", values: { label: "edit.width", min: 2, max: 200 } },
            { id: "style", key: "height", type: "number", value: 78, extension: "px", values: { label: "edit.height", min: 2, max: 200 } },
        ]]
    },
    transform: {
        inputs: splitIntoRows([
            { id: "transform", key: "rotate", type: "number", value: 0, extension: "deg", values: { label: "edit.rotation", max: 360, showSlider: true } },
            { id: "transform", key: "scaleX", type: "number", value: 1, multiplier: 10, values: { label: "media.flip", min: -10, max: 10, showSlider: true } },
            { id: "transform", key: "rotateX", type: "number", value: 0, extension: "deg", values: { label: "edit.tilt", max: 360, showSlider: true } },
            { id: "transform", key: "perspective", type: "number", value: 0, extension: "px", values: { label: "edit.perspective", max: 5000, showSlider: true, sliderValues: { max: 100 } } },
        ])
    },
    border: {
        expandAutoValue: {
            "border-width": 5
        },
        inputs: [[
            { id: "style", key: "border-width", type: "number", value: 0, extension: "px", values: { label: "edit.width", max: 500, style: "flex: 4;" } },
            { id: "style", key: "border-color", type: "color", value: "#FFFFFF", values: { label: "edit.color", allowOpacity: true, noLabel: true, style: "flex: 1;" } },
        ], [
            { id: "style", key: "border-style", type: "dropdown", value: "solid", values: { label: "edit.style", options: borderOptions } },
        ]]
    },
    shadow: {
        expandAutoValue: {
            "box-shadow": "2px 2px 8px 0 rgb(0 0 0 / 0.5)"
        },
        inputs: [[
            { id: "style", key: "box-shadow", valueIndex: 2, type: "number", value: 0, extension: "px", values: { label: "edit.blur", style: "flex: 4;" } },
            { id: "style", key: "box-shadow", valueIndex: 4, type: "color", value: "#000000", values: { label: "edit.color", allowOpacity: true, noLabel: true, style: "flex: 1;" } },
        ], [
            { id: "style", key: "box-shadow", valueIndex: 3, type: "number", value: 0, extension: "px", values: { label: "edit.length", min: -100 } },
        ], [
            { id: "style", key: "box-shadow", valueIndex: 0, type: "number", value: 0, extension: "px", values: { label: "edit.offsetX", min: -1000 } },
            { id: "style", key: "box-shadow", valueIndex: 1, type: "number", value: 0, extension: "px", values: { label: "edit.offsetY", min: -1000 } },
        ]]
    },
    // TODO: inset shadow
    backdrop_filters: {
        inputs: backdropFilters,
    },
    CSS: {
        noReset: true,
        inputs: [[
            { id: "CSS_item", type: "textarea", value: "", values: { label: "CSS" } }
        ]]
    },
}

export const itemEdits: { [key: string]: EditInput[] } = {
    default: [
        { name: "background_color", id: "style", key: "background-color", input: "color", value: "", values: { allowGradients: true, enableNoColor: true } },
        { name: "background_opacity", id: "background-opacity", input: "number", value: 0, values: { step: 0.1, decimals: 1, min: 0.1, max: 1, inputMultiplier: 10 } },
        { name: "opacity", id: "style", key: "opacity", input: "number", value: 1, values: { step: 0.1, decimals: 1, min: 0.1, max: 1, inputMultiplier: 10 } },
        { name: "padding", id: "style", key: "padding", input: "number", value: 0, extension: "px", values: { max: 300 } },
        { name: "corner_radius", id: "style", key: "border-radius", input: "number", value: 0, values: { step: 10, max: 500, inputMultiplier: 0.1 }, extension: "px" },
    ],
    position: [
        { name: "x", id: "style", key: "left", input: "number", value: 0, values: { min: -200, max: 200, decimals: 2 }, extension: "px", relative: true },
        { name: "y", id: "style", key: "top", input: "number", value: 0, values: { min: -200, max: 200, decimals: 2 }, extension: "px", relative: true },
        { name: "width", id: "style", key: "width", input: "number", value: 0, values: { min: 2, max: 200, decimals: 2 }, extension: "px", relative: true },
        { name: "height", id: "style", key: "height", input: "number", value: 0, values: { min: 2, max: 200, decimals: 2 }, extension: "px", relative: true },
    ],
    transform: [
        { name: "rotation", id: "transform", key: "rotate", input: "number", value: 0, values: { max: 360 }, extension: "deg" },
        { name: "media.flip", id: "transform", key: "scaleX", input: "number", value: 1, values: { min: -1, max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
        { name: "tilt", id: "transform", key: "rotateX", input: "number", value: 0, values: { max: 360 }, extension: "deg" },
        { name: "perspective", id: "transform", key: "perspective", input: "number", value: 0, values: { max: 5000 }, extension: "px" },
    ],
    // style: [],
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
    backdrop_filters: [
        { name: "filter.hue-rotate", id: "backdrop-filter", key: "hue-rotate", input: "number", value: 0, values: { max: 360 }, extension: "deg" },
        { name: "filter.invert", id: "backdrop-filter", key: "invert", input: "number", value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
        { name: "filter.blur", id: "backdrop-filter", key: "blur", input: "number", value: 0, values: { max: 100 }, extension: "px" },
        { name: "filter.grayscale", id: "backdrop-filter", key: "grayscale", input: "number", value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
        { name: "filter.brightness", id: "backdrop-filter", key: "brightness", input: "number", value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
        { name: "filter.contrast", id: "backdrop-filter", key: "contrast", input: "number", value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
        { name: "filter.saturate", id: "backdrop-filter", key: "saturate", input: "number", value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
    ],
    CSS: [{ id: "CSS", input: "CSS" }],
}
