import { splitIntoRows, type EditBoxSection } from "./boxes"

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
    { value: "ridge", label: "borders.ridge" }
]

const backdropFilters = splitIntoRows([
    { id: "backdrop-filter", key: "hue-rotate", type: "number", value: 0, extension: "deg", values: { label: "filter.hue-rotate", defaultValue: 0, step: 5, max: 360, showSlider: true, sliderValues: { step: 1 } } },
    { id: "backdrop-filter", key: "invert", type: "number", value: 0, multiplier: 10, values: { label: "filter.invert", defaultValue: 0, max: 10, showSlider: true } },
    { id: "backdrop-filter", key: "blur", type: "number", value: 0, extension: "px", values: { label: "filter.blur", defaultValue: 0, max: 100, showSlider: true, sliderValues: { max: 50 } } },
    { id: "backdrop-filter", key: "grayscale", type: "number", value: 0, multiplier: 10, values: { label: "filter.grayscale", defaultValue: 0, max: 10, showSlider: true } },
    // { id: "backdrop-filter", key: "sepia", type: "number", value: 0, multiplier: 10, values: { label: "filter.sepia", defaultValue: 0, max: 10, showSlider: true } },
    { id: "backdrop-filter", key: "brightness", type: "number", value: 1, multiplier: 10, values: { label: "filter.brightness", defaultValue: 10, max: 100, showSlider: true, sliderValues: { min: 2, max: 18 } } },
    { id: "backdrop-filter", key: "contrast", type: "number", value: 1, multiplier: 10, values: { label: "filter.contrast", defaultValue: 10, max: 100, showSlider: true, sliderValues: { min: 2, max: 18 } } },
    { id: "backdrop-filter", key: "saturate", type: "number", value: 1, multiplier: 10, values: { label: "filter.saturate", defaultValue: 10, max: 100, showSlider: true, sliderValues: { max: 20 } } }
    // { id: "backdrop-filter", key: "opacity", type: "number", value: 1, multiplier: 100, values: { label: "filter.opacity", defaultValue: 100, step: 10, max: 100, showSlider: true, sliderValues: { step: 1 } } }
])

export const itemSections: { [key: string]: EditBoxSection } = {
    default: {
        inputs: splitIntoRows([
            { id: "style", key: "background-color", type: "color", value: "", values: { label: "edit.background_color", allowGradients: true, allowOpacity: true, allowEmpty: true, noLabel: true } },
            { id: "style", key: "padding", type: "number", value: 0, extension: "px", values: { label: "edit.padding", step: 5, max: 300, showSlider: true, sliderValues: { step: 1, max: 100 } } },
            { id: "style", key: "border-radius", type: "number", value: 0, multiplier: 0.1, values: { label: "edit.corner_radius", step: 2, max: 500, showSlider: true, sliderValues: { step: 1, max: 50 } }, extension: "px" }
        ])
    },
    position: {
        noReset: true,
        inputs: [
            [
                { id: "style", key: "left", type: "number", value: 2.5, extension: "px", values: { label: "edit.x (%)", min: -200, max: 200 } },
                { id: "style", key: "top", type: "number", value: 11, extension: "px", values: { label: "edit.y (%)", min: -200, max: 200 } }
            ],
            [
                { id: "style", key: "width", type: "number", value: 95, extension: "px", values: { label: "edit.width (%)", min: 2, max: 200 } },
                { id: "style", key: "height", type: "number", value: 78, extension: "px", values: { label: "edit.height (%)", min: 2, max: 200 } }
            ]
        ]
    },
    transform: {
        inputs: splitIntoRows([
            { id: "style", key: "opacity", type: "number", value: 1, multiplier: 100, values: { label: "edit.opacity", step: 10, min: 1, max: 100, showSlider: true, sliderValues: { step: 1 } } },
            { id: "transform", key: "rotate", type: "number", value: 0, extension: "deg", values: { label: "edit.rotation", max: 360, showSlider: true } },
            { id: "transform", key: "scaleX", type: "number", value: 1, multiplier: 10, values: { label: "media.flip", min: -10, max: 10, showSlider: true } },
            { id: "transform", key: "rotateX", type: "number", value: 0, extension: "deg", values: { label: "edit.tilt", max: 360, showSlider: true } },
            { id: "transform", key: "perspective", type: "number", value: 0, extension: "px", values: { label: "edit.perspective", max: 5000, showSlider: true, sliderValues: { max: 100 } } }
        ])
    },
    border: {
        expandAutoValue: {
            "border-width": 5
        },
        inputs: [
            [
                { id: "style", key: "border-width", type: "number", value: 0, extension: "px", values: { label: "edit.width", max: 500, style: "flex: 4;" } },
                { id: "style", key: "border-color", type: "color", value: "#FFFFFF", values: { label: "edit.color", allowOpacity: true, noLabel: true, style: "flex: 1;" } }
            ],
            [{ id: "style", key: "border-style", type: "dropdown", value: "solid", values: { label: "edit.style", options: borderOptions } }]
        ]
    },
    shadow: {
        expandAutoValue: {
            "box-shadow": "2px 2px 8px 0 rgb(0 0 0 / 0.5)"
        },
        inputs: [
            [
                { id: "style", key: "box-shadow", valueIndex: 2, type: "number", value: 0, extension: "px", values: { label: "edit.blur", style: "flex: 4;" } },
                { id: "style", key: "box-shadow", valueIndex: 4, type: "color", value: "#000000", values: { label: "edit.color", allowOpacity: true, noLabel: true, style: "flex: 1;" } }
            ],
            [
                { id: "style", key: "box-shadow", valueIndex: 0, type: "number", value: 0, extension: "px", values: { label: "edit.offsetX", min: -1000 } },
                { id: "style", key: "box-shadow", valueIndex: 1, type: "number", value: 0, extension: "px", values: { label: "edit.offsetY", min: -1000 } }
            ],
            [{ id: "style", key: "box-shadow", valueIndex: 3, type: "number", value: 0, extension: "px", values: { label: "edit.length", min: -100, style: "flex: 3;" } }],
            [{ id: "style", key: "box-shadow", type: "checkbox", value: false, values: { label: "edit.shadow_inset", style: "flex: 1;" } }]
        ]
    },
    backdrop_filters: {
        name: "edit.filters",
        inputs: backdropFilters
    },
    CSS: {
        noReset: true,
        inputs: [[{ id: "CSS_item", type: "textarea", value: "", values: { label: "CSS" } }]]
    }
}
