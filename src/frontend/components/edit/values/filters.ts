import { splitIntoRows, type Box, type EditBoxSection } from "./boxes"

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

export const slideFilters: Box = {
    media: {
        name: "",
        icon: "",
        edit: {
            // default: [
            //     {
            //         name: "edit.filter_active",
            //         id: "filter_active",
            //         input: "multiselect",
            //         value: ["background"],
            //         values: [
            //             { id: "background", name: "preview.background" },
            //             { id: "foreground", name: "preview.foreground" },
            //         ],
            //     },
            // ],
            // background
            filters: [
                { name: "filter.hue-rotate", id: "filter", key: "hue-rotate", input: "number", slider: true, value: 0, values: { max: 360, step: 5 }, sliderValues: { step: 1 }, extension: "deg" },
                { name: "filter.invert", id: "filter", key: "invert", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.blur", id: "filter", key: "blur", input: "number", slider: true, value: 0, values: { max: 100 }, extension: "px", sliderValues: { max: 50 } },
                // { name: "filter.grayscale", id: "filter", key: "grayscale", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                // { name: "filter.sepia", id: "filter", key: "sepia", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.brightness", id: "filter", key: "brightness", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0.2, max: 1.8 } },
                { name: "filter.contrast", id: "filter", key: "contrast", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0.2, max: 1.8 } },
                { name: "filter.saturate", id: "filter", key: "saturate", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { max: 2 } },
                { name: "filter.opacity", id: "filter", key: "opacity", input: "number", slider: true, value: 1, values: { max: 1, step: 0.1, decimals: 2, inputMultiplier: 100 }, sliderValues: { step: 0.01 } }
            ],
            // foreground
            backdrop_filters: [
                { name: "filter.hue-rotate", id: "backdrop-filter", key: "hue-rotate", input: "number", slider: true, value: 0, values: { max: 360, step: 5 }, sliderValues: { step: 1 }, extension: "deg" },
                { name: "filter.invert", id: "backdrop-filter", key: "invert", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.blur", id: "backdrop-filter", key: "blur", input: "number", slider: true, value: 0, values: { max: 100 }, extension: "px", sliderValues: { max: 50 } },
                // { name: "filter.grayscale", id: "backdrop-filter", key: "grayscale", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                // { name: "filter.sepia", id: "backdrop-filter", key: "sepia", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.brightness", id: "backdrop-filter", key: "brightness", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0.2, max: 1.8 } },
                { name: "filter.contrast", id: "backdrop-filter", key: "contrast", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0.2, max: 1.8 } },
                { name: "filter.saturate", id: "backdrop-filter", key: "saturate", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { max: 2 } },
                { name: "filter.opacity", id: "backdrop-filter", key: "opacity", input: "number", slider: true, value: 1, values: { max: 1, step: 0.1, decimals: 2, inputMultiplier: 100 }, sliderValues: { step: 0.01 } }
            ]
        }
    }
}
