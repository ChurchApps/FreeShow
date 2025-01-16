import type { Box } from "./boxes"

export const slideFilters: Box = {
    media: {
        name: "",
        icon: "",
        edit: {
            default: [
                {
                    name: "edit.filter_active",
                    id: "filter_active",
                    input: "multiselect",
                    value: ["background"],
                    values: [
                        { id: "background", name: "preview.background" },
                        { id: "foreground", name: "preview.foreground" },
                    ],
                },
            ],
            filters: [
                { name: "filter.hue-rotate", id: "filter", key: "hue-rotate", input: "number", slider: true, value: 0, values: { max: 360 }, extension: "deg" },
                { name: "filter.invert", id: "filter", key: "invert", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.blur", id: "filter", key: "blur", input: "number", slider: true, value: 0, values: { max: 100 }, extension: "px" },
                // { name: "filter.grayscale", id: "filter", key: "grayscale", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                // { name: "filter.sepia", id: "filter", key: "sepia", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.brightness", id: "filter", key: "brightness", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.contrast", id: "filter", key: "contrast", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.saturate", id: "filter", key: "saturate", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.opacity", id: "filter", key: "opacity", input: "number", slider: true, value: 1, values: { max: 1, step: 0.02, decimals: 2, inputMultiplier: 100 } },
            ],
            backdrop_filters: [
                { name: "filter.hue-rotate", id: "backdrop-filter", key: "hue-rotate", input: "number", slider: true, value: 0, values: { max: 360 }, extension: "deg" },
                { name: "filter.invert", id: "backdrop-filter", key: "invert", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.blur", id: "backdrop-filter", key: "blur", input: "number", slider: true, value: 0, values: { max: 100 }, extension: "px" },
                // { name: "filter.grayscale", id: "backdrop-filter", key: "grayscale", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                // { name: "filter.sepia", id: "backdrop-filter", key: "sepia", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.brightness", id: "backdrop-filter", key: "brightness", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.contrast", id: "backdrop-filter", key: "contrast", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.saturate", id: "backdrop-filter", key: "saturate", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.opacity", id: "backdrop-filter", key: "opacity", input: "number", slider: true, value: 1, values: { max: 1, step: 0.02, decimals: 2, inputMultiplier: 100 } },
            ],
        },
    },
}
