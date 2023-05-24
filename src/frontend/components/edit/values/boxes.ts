import type { ItemType } from "./../../../../types/Show"

export type Box = {
    [key in ItemType]?: {
        name?: string
        icon: string
        edit: {
            [key: string]: EditInput[]
        }
    }
}

export type EditInput = {
    name?: string
    id?: string
    key?: string
    input: string
    value?: string | number | boolean | string[]
    extension?: string
    disabled?: string
    valueIndex?: number
    values?: any
}

const mediaFitOptions: any[] = [
    { id: "contain", name: "$:media.contain:$" },
    { id: "cover", name: "$:media.cover:$" },
    { id: "fill", name: "$:media.fill:$" },
    // { id: "scale-down", name: "Scale down" },
]

export const boxes: Box = {
    text: {
        // name: "items.text",
        icon: "text",
        edit: {
            font: [
                { name: "family", id: "style", key: "font-family", input: "fontDropdown", value: "CMGSans" },
                { name: "color", id: "style", key: "color", input: "color", value: "#FFFFFF" },
                { name: "size", id: "style", key: "font-size", input: "number", value: 100, extension: "px" }, // , disabled: "item.autoSize"
                { name: "auto_size", id: "auto", input: "checkbox", value: false },
            ],
            style: [
                { input: "font-style" },
                { name: "line_spacing", id: "style", key: "line-height", input: "number", value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, extension: "em" },
                { name: "letter_spacing", id: "style", key: "letter-spacing", input: "number", value: 0, values: { max: 100, min: -1000 }, extension: "px" },
                { name: "word_spacing", id: "style", key: "word-spacing", input: "number", value: 0, values: { min: -100 }, extension: "px" },
            ],
            align: [{ input: "align-x" }, { input: "align-y" }],
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
            CSS: [{ id: "text", input: "CSS" }],
        },
    },
    media: {
        icon: "image",
        edit: {
            default: [
                { id: "src", input: "media" },
                { name: "media.fit", id: "fit", input: "dropdown", value: "contain", values: { options: mediaFitOptions } },
                { name: "media.flip", id: "flipped", input: "checkbox", value: false },
            ],
            filters: [
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
            // shadow: [
            //   { name: "color", id: "style", key: "text-shadow", valueIndex: 3, input: "color", value: "#000000" },
            //   { name: "offsetX", id: "style", key: "text-shadow", valueIndex: 0, input: "number", value: 2, values: { min: -1000 }, extension: "px" },
            //   { name: "offsetY", id: "style", key: "text-shadow", valueIndex: 1, input: "number", value: 2, values: { min: -1000 }, extension: "px" },
            //   { name: "blur", id: "style", key: "text-shadow", valueIndex: 2, input: "number", value: 10, extension: "px" },
            // ],
        },
    },
    timer: {
        icon: "timer",
        edit: {
            default: [{ input: "editTimer" }],
            font: [
                { name: "family", id: "style", key: "font-family", input: "fontDropdown", value: "CMGSans" },
                { name: "color", id: "style", key: "color", input: "color", value: "#FFFFFF" },
            ],
            style: [{ input: "font-style" }, { name: "letter_spacing", id: "style", key: "letter-spacing", input: "number", value: 0, values: { max: 100, min: -1000 }, extension: "px" }],
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
        },
    },
    clock: {
        icon: "clock",
        edit: {
            default: [
                // TODO: clock = { type: "digital", seconds: false }
                {
                    name: "clock.type",
                    input: "dropdown",
                    id: "clock.type",
                    value: "digital",
                    values: {
                        options: [
                            { id: "digital", name: "$:clock.digital:$" },
                            { id: "analog", name: "$:clock.analog:$" },
                        ],
                    },
                },
                { name: "clock.seconds", id: "clock.seconds", input: "checkbox", value: false },
            ],
            font: [
                { name: "family", id: "style", key: "font-family", input: "fontDropdown", value: "CMGSans" },
                { name: "color", id: "style", key: "color", input: "color", value: "#FFFFFF" },
            ],
            style: [{ input: "font-style" }, { name: "letter_spacing", id: "style", key: "letter-spacing", input: "number", value: 0, values: { max: 100, min: -1000 }, extension: "px" }],
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
        },
    },
    // mirror other shows content on the same slide index
    mirror: {
        icon: "mirror",
        edit: {
            default: [{ name: "remote.show", id: "mirror", key: "show", input: "dropdown", value: "", values: { options: [] } }],
            // template, item index
        },
    },
    icon: {
        icon: "icon",
        edit: {
            default: [{ name: "color", id: "style", key: "color", input: "color", value: "#FFFFFF" }],
        },
    },
    // item: {
    //   icon: "item",
    //   edit: {
    //     element: [{

    //     }]
    //   }
    // }
}
