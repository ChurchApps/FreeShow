import type { Box } from "./boxes"

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
                    value: "contain",
                    values: {
                        options: [
                            { id: "contain", name: "$:media.contain:$", translate: true },
                            { id: "cover", name: "$:media.cover:$", translate: true },
                            { id: "fill", name: "$:media.fill:$", translate: true },
                        ],
                    },
                },
                { name: "media.flip", id: "flipped", input: "checkbox", value: false },
            ],
        },
    },
}

export const videoEdit = [
    {
        name: "media.speed",
        id: "speed",
        input: "dropdown",
        value: "1",
        values: {
            options: [
                { id: "0.1", name: "0.1" },
                { id: "0.25", name: "0.25" },
                { id: "0.5", name: "0.5" },
                { id: "1", name: "1" },
                { id: "1.5", name: "1.5" },
                { id: "2", name: "2" },
                { id: "5", name: "5" },
                { id: "10", name: "10" },
                { id: "15", name: "15" },
            ],
        },
    },
    {
        name: "timer.from",
        id: "fromTime",
        input: "number",
        value: 0,
        values: { max: 100000 },
    },
    {
        name: "timer.to",
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
                { name: "filter.hue-rotate", id: "filter", key: "hue-rotate", input: "number", value: 0, values: { max: 360 }, extension: "deg" },
                { name: "filter.invert", id: "filter", key: "invert", input: "number", value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.blur", id: "filter", key: "blur", input: "number", value: 0, values: { max: 100 }, extension: "px" },
                { name: "filter.grayscale", id: "filter", key: "grayscale", input: "number", value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.sepia", id: "filter", key: "sepia", input: "number", value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.brightness", id: "filter", key: "brightness", input: "number", value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.contrast", id: "filter", key: "contrast", input: "number", value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.saturate", id: "filter", key: "saturate", input: "number", value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.opacity", id: "filter", key: "opacity", input: "number", value: 1, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
            ],
        },
    },
}
