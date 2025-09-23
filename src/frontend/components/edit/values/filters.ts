import { splitIntoRows, type EditBoxSection } from "./boxes"

export const slideFilterSections: { [key: string]: EditBoxSection } = {
    // background
    filters: {
        name: "preview.background",
        alwaysOpen: true,
        inputs: splitIntoRows([
            { id: "filter", key: "hue-rotate", type: "number", value: 0, extension: "deg", values: { label: "filter.hue-rotate", defaultValue: 0, step: 5, max: 360, showSlider: true, sliderValues: { step: 1 } } },
            { id: "filter", key: "invert", type: "number", value: 0, multiplier: 10, values: { label: "filter.invert", defaultValue: 0, max: 10, showSlider: true } },
            { id: "filter", key: "blur", type: "number", value: 0, extension: "px", values: { label: "filter.blur", defaultValue: 0, max: 100, showSlider: true, sliderValues: { max: 50 } } },
            // { id: "filter", key: "grayscale", type: "number", value: 0, multiplier: 10, values: { label: "filter.grayscale", defaultValue: 0, max: 10, showSlider: true } },
            // { id: "filter", key: "sepia", type: "number", value: 0, multiplier: 10, values: { label: "filter.sepia", defaultValue: 0, max: 10, showSlider: true } },
            { id: "filter", key: "brightness", type: "number", value: 1, multiplier: 10, values: { label: "filter.brightness", defaultValue: 10, max: 100, showSlider: true, sliderValues: { min: 2, max: 18 } } },
            { id: "filter", key: "contrast", type: "number", value: 1, multiplier: 10, values: { label: "filter.contrast", defaultValue: 10, max: 100, showSlider: true, sliderValues: { min: 2, max: 18 } } },
            { id: "filter", key: "saturate", type: "number", value: 1, multiplier: 10, values: { label: "filter.saturate", defaultValue: 10, max: 100, showSlider: true, sliderValues: { max: 20 } } },
            // { id: "filter", key: "opacity", type: "number", value: 1, multiplier: 100, values: { label: "filter.opacity", defaultValue: 100, step: 10, max: 100, showSlider: true, sliderValues: { step: 1 } } }
        ])
    },
    // foreground
    backdrop_filters: {
        alwaysOpen: true,
        inputs: splitIntoRows([
            { id: "backdrop-filter", key: "hue-rotate", type: "number", value: 0, extension: "deg", values: { label: "filter.hue-rotate", defaultValue: 0, step: 5, max: 360, showSlider: true, sliderValues: { step: 1 } } },
            { id: "backdrop-filter", key: "invert", type: "number", value: 0, multiplier: 10, values: { label: "filter.invert", defaultValue: 0, max: 10, showSlider: true } },
            { id: "backdrop-filter", key: "blur", type: "number", value: 0, extension: "px", values: { label: "filter.blur", defaultValue: 0, max: 100, showSlider: true, sliderValues: { max: 50 } } },
            // { id: "backdrop-filter", key: "grayscale", type: "number", value: 0, multiplier: 10, values: { label: "filter.grayscale", defaultValue: 0, max: 10, showSlider: true } },
            // { id: "backdrop-filter", key: "sepia", type: "number", value: 0, multiplier: 10, values: { label: "filter.sepia", defaultValue: 0, max: 10, showSlider: true } },
            { id: "backdrop-filter", key: "brightness", type: "number", value: 1, multiplier: 10, values: { label: "filter.brightness", defaultValue: 10, max: 100, showSlider: true, sliderValues: { min: 2, max: 18 } } },
            { id: "backdrop-filter", key: "contrast", type: "number", value: 1, multiplier: 10, values: { label: "filter.contrast", defaultValue: 10, max: 100, showSlider: true, sliderValues: { min: 2, max: 18 } } },
            { id: "backdrop-filter", key: "saturate", type: "number", value: 1, multiplier: 10, values: { label: "filter.saturate", defaultValue: 10, max: 100, showSlider: true, sliderValues: { max: 20 } } },
            // { id: "backdrop-filter", key: "opacity", type: "number", value: 1, multiplier: 100, values: { label: "filter.opacity", defaultValue: 100, step: 10, max: 100, showSlider: true, sliderValues: { step: 1 } } }
        ])
    }
}