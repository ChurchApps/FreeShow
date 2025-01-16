import { mediaFitOptions, type Box } from "./boxes"

export const mediaEdits: Box = {
    media: {
        name: "",
        icon: "",
        edit: {
            default: [
                {
                    name: "media.fit",
                    id: "fit",
                    input: "dropdown",
                    value: "",
                    values: {
                        options: [{ id: "", name: "$:themes.default:$" }, ...mediaFitOptions],
                    },
                },
                { name: "media.flip_horizontally", id: "flipped", input: "checkbox", value: false },
                { name: "media.flip_vertically", id: "flippedY", input: "checkbox", value: false },
            ],
        },
    },
}

export const videoEdit = [
    {
        name: "media.speed",
        id: "speed",
        input: "number",
        slider: true,
        value: 1,
        values: { min: 0.1, max: 15, step: 0.1, decimals: 1, fixed: 1 },
    },
    {
        name: "media.volume",
        id: "volume",
        input: "number",
        slider: true,
        value: 100,
        values: { max: 100 },
    },
    {
        name: "inputs.start",
        id: "fromTime",
        input: "number",
        value: 0,
        values: { max: 100000 },
    },
    {
        name: "inputs.end",
        id: "toTime",
        input: "number",
        value: 0,
        values: { max: 100000 },
    },
]

export const mediaFilters: Box = {
    media: {
        name: "",
        icon: "",
        edit: {
            default: [
                { name: "filter.hue-rotate", id: "filter", key: "hue-rotate", input: "number", slider: true, value: 0, values: { max: 360 }, extension: "deg" },
                { name: "filter.invert", id: "filter", key: "invert", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.blur", id: "filter", key: "blur", input: "number", slider: true, value: 0, values: { max: 100 }, extension: "px" },
                { name: "filter.grayscale", id: "filter", key: "grayscale", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.sepia", id: "filter", key: "sepia", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.brightness", id: "filter", key: "brightness", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.contrast", id: "filter", key: "contrast", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.saturate", id: "filter", key: "saturate", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.opacity", id: "filter", key: "opacity", input: "number", slider: true, value: 1, values: { max: 1, step: 0.02, decimals: 2, inputMultiplier: 100 } },
            ],
        },
    },
}
