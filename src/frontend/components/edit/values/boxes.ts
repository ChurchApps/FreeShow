import type { ItemType } from "./../../../../types/Show"
import { captionLanguages } from "./captionLanguages"

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
    icon?: string
    key?: string
    input: string
    value?: string | number | boolean | any[]
    extension?: string
    hidden?: boolean
    disabled?: string
    valueIndex?: number
    values?: any
    popup?: string
    enableNoColor?: boolean
    relative?: boolean // updated values should be relative to each selected item (only for number px values)
}

export const mediaFitOptions: any[] = [
    { id: "contain", name: "$:media.contain:$" },
    { id: "cover", name: "$:media.cover:$" },
    { id: "fill", name: "$:media.fill:$" },
    // { id: "scale-down", name: "Scale down" },
]

export let trackerEdits = [
    {
        name: "clock.type",
        input: "dropdown",
        id: "tracker.type",
        value: "number",
        values: {
            options: [
                { id: "number", name: "$:variables.number:$" },
                { id: "bar", name: "$:edit.progress_bar:$" },
                { id: "group", name: "$:tools.groups:$" },
            ],
        },
    },
    {
        name: "edit.accent_color",
        input: "color",
        id: "tracker.accent",
        value: "#F0008C",
    },
]

export const boxes: Box = {
    text: {
        // name: "items.text",
        icon: "text",
        edit: {
            default: [
                { name: "family", id: "style", key: "font-family", input: "fontDropdown", value: "CMGSans" },
                { name: "text_color", id: "style", key: "color", input: "color", value: "#FFFFFF" },
                { name: "font_size", id: "style", key: "font-size", input: "number", value: 100, extension: "px" },
                { name: "auto_size", id: "auto", input: "checkbox", value: false },
                {
                    name: "text_fit",
                    id: "textFit",
                    input: "dropdown",
                    value: "shrinkToFit",
                    values: {
                        options: [
                            { id: "shrinkToFit", name: "$:edit.shrink_to_fit:$" },
                            { id: "growToFit", name: "$:edit.grow_to_fit:$" },
                        ],
                    },
                },
                { input: "font-style" },
            ],
            align: [{ input: "align-x" }, { input: "align-y" }],
            text: [
                { name: "letter_spacing", id: "style", key: "letter-spacing", input: "number", value: 0, values: { max: 100, min: -1000 }, extension: "px" },
                { name: "word_spacing", id: "style", key: "word-spacing", input: "number", value: 0, values: { min: -100 }, extension: "px" },
                {
                    name: "text_transform",
                    input: "dropdown",
                    id: "style",
                    key: "text-transform",
                    value: "none",
                    values: {
                        options: [
                            { id: "none", name: "$:main.none:$" },
                            { id: "uppercase", name: "$:edit.uppercase:$" },
                            { id: "lowercase", name: "$:edit.lowercase:$" },
                            { id: "capitalize", name: "$:edit.capitalize:$" },
                        ],
                    },
                },
                { name: "background_color", id: "style", key: "background-color", input: "color", value: "rgb(0 0 0 / 0)", enableNoColor: true },
                { name: "no_wrap", id: "nowrap", input: "checkbox", value: false },
            ],
            lines: [
                { name: "line_height", id: "style", key: "line-height", input: "number", value: 1.1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, extension: "em" },
                { name: "line_spacing", id: "specialStyle.lineGap", input: "number", value: 0, values: { max: 500 } },
                { name: "background_color", id: "specialStyle.lineBg", input: "color", value: "", enableNoColor: true },
                { name: "background_opacity", id: "specialStyle.opacity", input: "number", value: 1, values: { step: 0.1, decimals: 1, max: 1, inputMultiplier: 10 } },
            ],
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
            chords: [
                { name: "chords", id: "chords.enabled", input: "checkbox", value: false },
                { name: "color", id: "chords.color", input: "color", value: "#FF851B", hidden: true },
                { name: "size", id: "chords.size", input: "number", value: 30, hidden: true },
            ],
            special: [
                {
                    name: "scrolling",
                    input: "dropdown",
                    id: "scrolling.type",
                    value: "none",
                    values: {
                        options: [
                            { id: "none", name: "$:main.none:$" },
                            { id: "top_bottom", name: "$:edit.top_bottom:$" },
                            { id: "bottom_top", name: "$:edit.bottom_top:$" },
                            { id: "left_right", name: "$:edit.left_right:$" },
                            { id: "right_left", name: "$:edit.right_left:$" },
                        ],
                    },
                },
                { name: "scrolling_speed", id: "scrolling.speed", input: "number", value: 15, values: { min: 1, max: 100 } },
            ],
            CSS: [{ id: "text", input: "CSS" }],
        },
    },
    list: {
        icon: "list",
        edit: {
            default: [
                { name: "edit_list", input: "popup", popup: "edit_list", id: "list.items", icon: "list" },
                {
                    name: "style",
                    input: "dropdown",
                    id: "list.style",
                    value: "disc",
                    values: {
                        options: [
                            // common
                            { id: "disc", name: "$:list.disc:$" },
                            { id: "circle", name: "$:list.circle:$" },
                            { id: "square", name: "$:list.square:$" },
                            { id: "disclosure-closed", name: "$:list.disclosure-closed:$" },
                            { id: "disclosure-open", name: "$:list.disclosure-open:$" },
                            // numbers
                            { id: "decimal", name: "$:list.decimal:$" },
                            { id: "decimal-leading-zero", name: "$:list.decimal-leading-zero:$" },
                            // alpha
                            { id: "lower-alpha", name: "$:list.lower-alpha:$" }, // same as latin
                            { id: "upper-alpha", name: "$:list.upper-alpha:$" }, // same as latin
                            { id: "lower-roman", name: "$:list.lower-roman:$" },
                            { id: "upper-roman", name: "$:list.upper-roman:$" },
                            { id: "lower-greek", name: "$:list.lower-greek:$" },
                            // special
                            // {id: "bengali", name: "$:list.bengali:$" },
                            // {id: "cambodian", name: "$:list.cambodian:$" },
                            // {id: "devanagari", name: "$:list.devanagari:$" },
                        ],
                    },
                    disabled: "list.interval",
                },
                // { name: "one_at_a_time", id: "one_at_a_time", input: "checkbox", value: false },
                { name: "interval", id: "list.interval", input: "number", value: 0 },
            ],
            font: [
                { name: "family", id: "style", key: "font-family", input: "fontDropdown", value: "CMGSans" },
                { name: "color", id: "style", key: "color", input: "color", value: "#FFFFFF" },
                { name: "size", id: "style", key: "font-size", input: "number", value: 100, extension: "px" }, // , disabled: "item.autoSize"
                { name: "auto_size", id: "auto", input: "checkbox", value: false },
            ],
            text: [
                { input: "font-style" },
                { name: "line_spacing", id: "style", key: "line-height", input: "number", value: 1.1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, extension: "em" },
                { name: "letter_spacing", id: "style", key: "letter-spacing", input: "number", value: 0, values: { max: 100, min: -1000 }, extension: "px" },
                { name: "word_spacing", id: "style", key: "word-spacing", input: "number", value: 0, values: { min: -100 }, extension: "px" },
            ],
            // align: [{ input: "align-x" }, { input: "align-y" }],
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
                { name: "actions.mute", id: "muted", input: "checkbox", value: false },
                { name: "media.flip_horizontally", id: "flipped", input: "checkbox", value: false },
                { name: "media.flip_vertically", id: "flippedY", input: "checkbox", value: false },
                // WIP crop image
                // object-position: 20px 20px;
                // transform: scale(1.2) translate(0, 5%);
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
    camera: {
        icon: "camera",
        edit: {
            default: [
                { name: "choose_camera", id: "device", input: "popup", popup: "choose_camera", icon: "camera" },
                { name: "media.fit", id: "fit", input: "dropdown", value: "contain", values: { options: mediaFitOptions } },
                { name: "media.flip_horizontally", id: "flipped", input: "checkbox", value: false },
                { name: "media.flip_vertically", id: "flippedY", input: "checkbox", value: false },
            ],
            // filters: [
            //     { name: "filter.hue-rotate", id: "filter", key: "hue-rotate", input: "number", value: 0, values: { max: 360 }, extension: "deg" },
            //     { name: "filter.invert", id: "filter", key: "invert", input: "number", value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
            //     { name: "filter.blur", id: "filter", key: "blur", input: "number", value: 0, values: { max: 100 }, extension: "px" },
            //     { name: "filter.grayscale", id: "filter", key: "grayscale", input: "number", value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
            //     { name: "filter.sepia", id: "filter", key: "sepia", input: "number", value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
            //     { name: "filter.brightness", id: "filter", key: "brightness", input: "number", value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
            //     { name: "filter.contrast", id: "filter", key: "contrast", input: "number", value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
            //     { name: "filter.saturate", id: "filter", key: "saturate", input: "number", value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
            //     { name: "filter.opacity", id: "filter", key: "opacity", input: "number", value: 1, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
            // ],
        },
    },
    timer: {
        icon: "timer",
        edit: {
            default: [
                { id: "timerId", input: "editTimer" },
                {
                    name: "clock.type",
                    input: "dropdown",
                    id: "timer.viewType",
                    value: "time",
                    values: {
                        options: [
                            { id: "time", name: "$:timer.time:$" },
                            { id: "line", name: "$:timer.line:$" },
                            { id: "circle", name: "$:list.circle:$" },
                        ],
                    },
                },
                { name: "timer.mask", id: "timer.circleMask", input: "checkbox", value: false },
            ],
            // font: [
            //     { name: "family", id: "style", key: "font-family", input: "fontDropdown", value: "CMGSans" },
            //     { name: "color", id: "style", key: "color", input: "color", value: "#FFFFFF" },
            // ],
            // style: [
            //     { input: "font-style" }
            //     { name: "letter_spacing", id: "style", key: "letter-spacing", input: "number", value: 0, values: { max: 100, min: -1000 }, extension: "px" }
            // ],

            font: [
                { name: "family", id: "style", key: "font-family", input: "fontDropdown", value: "CMGSans" },
                { name: "color", id: "style", key: "color", input: "color", value: "#FFFFFF" },
                { name: "size", id: "style", key: "font-size", input: "number", value: 100, extension: "px", disabled: "auto" },
                { name: "auto_size", id: "auto", input: "checkbox", value: true },
                { input: "font-style" },
            ],
            align: [{ input: "align-x" }], // , { input: "align-y" }
            style: [
                { name: "letter_spacing", id: "style", key: "letter-spacing", input: "number", value: 0, values: { max: 100, min: -1000 }, extension: "px" },
                { name: "line_height", id: "style", key: "line-height", input: "number", value: 1.1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, extension: "em" },
                // { name: "background_color", id: "specialStyle.lineBg", input: "color", value: "", enableNoColor: true },
                // { name: "background_opacity", id: "specialStyle.opacity", input: "number", value: 1, values: { step: 0.1, decimals: 1, max: 1, inputMultiplier: 10 } },
            ],

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
    clock: {
        icon: "clock",
        edit: {
            default: [
                {
                    name: "clock.type",
                    input: "dropdown",
                    id: "clock.type",
                    value: "digital",
                    values: {
                        options: [
                            { id: "digital", name: "$:clock.digital:$" },
                            { id: "analog", name: "$:clock.analog:$" },
                            { id: "custom", name: "$:clock.custom:$" }
                        ],
                    },
                },
                { name: "clock.seconds", id: "clock.seconds", input: "checkbox", value: false, hidden: false },
                {
                    name: "clock.format",
                    input: "text",
                    id: "clock.format",
                    value: "HH:mm",
                    hidden: false
                },
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
            CSS: [{ id: "text", input: "CSS" }],
        },
    },
    events: {
        icon: "calendar",
        edit: {
            default: [
                { name: "max_events", id: "events.maxEvents", input: "number", value: 5, values: { max: 20 } },
                { name: "start_days_from_today", id: "events.startDaysFromToday", disabled: "events.enableStartDate", input: "number", value: 0, values: { max: 10000 } },
                { name: "just_one_day", id: "events.justOneDay", input: "checkbox", value: false },
                { name: "enable_start_date", id: "events.enableStartDate", input: "checkbox", value: false },
                { name: "calendar.from_date", id: "events.startDate", hidden: true, input: "date" },
                { name: "calendar.from_time", id: "events.startTime", hidden: true, input: "time" },
            ],
            font: [
                { name: "family", id: "style", key: "font-family", input: "fontDropdown", value: "CMGSans" },
                { name: "color", id: "style", key: "color", input: "color", value: "#FFFFFF" },
                { name: "size", id: "style", key: "font-size", input: "number", value: 80, extension: "px" }, // , disabled: "item.autoSize"
                // { name: "auto_size", id: "auto", input: "checkbox", value: false },
            ],
            text: [
                { input: "font-style" },
                { name: "line_spacing", id: "style", key: "line-height", input: "number", value: 0.9, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, extension: "em" },
                { name: "letter_spacing", id: "style", key: "letter-spacing", input: "number", value: 0, values: { max: 100, min: -1000 }, extension: "px" },
                { name: "word_spacing", id: "style", key: "word-spacing", input: "number", value: 0, values: { min: -100 }, extension: "px" },
                {
                    name: "text_transform",
                    input: "dropdown",
                    id: "style",
                    key: "text-transform",
                    value: "none",
                    values: {
                        options: [
                            { id: "none", name: "$:main.none:$" },
                            { id: "uppercase", name: "$:edit.uppercase:$" },
                            { id: "lowercase", name: "$:edit.lowercase:$" },
                            { id: "capitalize", name: "$:edit.capitalize:$" },
                        ],
                    },
                },
            ],
            // align: [{ input: "align-x" //, value: "left" }, { input: "align-y" }],
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
    variable: {
        icon: "variable",
        edit: {
            default: [
                {
                    name: "popup.variable",
                    input: "selectVariable",
                    id: "variable.id",
                    value: "",
                },
            ],
            font: [
                { name: "family", id: "style", key: "font-family", input: "fontDropdown", value: "CMGSans" },
                { name: "color", id: "style", key: "color", input: "color", value: "#FFFFFF" },
                { name: "size", id: "style", key: "font-size", input: "number", value: 0, extension: "px", values: { max: 5000 } },
            ],
            style: [{ input: "font-style" }, { name: "letter_spacing", id: "style", key: "letter-spacing", input: "number", value: 0, values: { max: 100, min: -1000 }, extension: "px" }],
            align: [{ input: "align-x" }],
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
    web: {
        icon: "web",
        edit: {
            default: [
                { name: "inputs.url", id: "web.src", input: "text", value: "" },
                { name: "disable_navigation", id: "web.noNavigation", input: "checkbox", value: false },
            ],
        },
    },
    // mirror other shows content on the same slide index
    mirror: {
        icon: "mirror",
        edit: {
            // TODO: select show popup
            default: [
                { name: "enable_stage", id: "mirror.enableStage", input: "checkbox", value: false },
                { name: "next_slide", id: "mirror.nextSlide", input: "checkbox", value: false },
                { name: "popup.select_show", id: "mirror.show", input: "dropdown", value: "", values: { options: [] } },
                { name: "use_slide_index", id: "mirror.useSlideIndex", input: "checkbox", value: true },
                { name: "slide_index", disabled: "mirror.useSlideIndex", id: "mirror.index", input: "number", value: 0 },
            ],
            // template, item index
        },
    },
    slide_tracker: {
        icon: "percentage",
        edit: {
            default: trackerEdits,
            font: [
                { name: "family", id: "style", key: "font-family", input: "fontDropdown", value: "CMGSans" },
                { name: "text_color", id: "style", key: "color", input: "color", value: "#FFFFFF" },
                { name: "font_size", id: "style", key: "font-size", input: "number", value: 100, extension: "px", disabled: "auto" },
                { name: "auto_size", id: "auto", input: "checkbox", value: false },
                { input: "font-style" },
            ],
        },
    },
    visualizer: {
        icon: "visualizer",
        edit: {
            default: [
                { name: "color", id: "visualizer.color", input: "color", value: "rgb(0 0 0 / 0)", enableNoColor: true },
                { name: "padding", id: "visualizer.padding", input: "number", value: 0 },
            ],
            // filters: [
            //     { name: "filter.hue-rotate", id: "filter", key: "hue-rotate", input: "number", value: 0, values: { max: 360 }, extension: "deg" },
            //     { name: "filter.invert", id: "filter", key: "invert", input: "number", value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
            //     { name: "filter.blur", id: "filter", key: "blur", input: "number", value: 0, values: { max: 100 }, extension: "px" },
            //     { name: "filter.grayscale", id: "filter", key: "grayscale", input: "number", value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
            //     { name: "filter.sepia", id: "filter", key: "sepia", input: "number", value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
            //     { name: "filter.brightness", id: "filter", key: "brightness", input: "number", value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
            //     { name: "filter.contrast", id: "filter", key: "contrast", input: "number", value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
            //     { name: "filter.saturate", id: "filter", key: "saturate", input: "number", value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 } },
            //     { name: "filter.opacity", id: "filter", key: "opacity", input: "number", value: 1, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
            // ],
        },
    },
    captions: {
        icon: "captions",
        edit: {
            default: [
                { name: "captions.language", id: "captions.language", input: "dropdown", value: "en-US", values: { options: captionLanguages } },
                // this is very limited
                // { name: "captions.translate", id: "captions.translate", input: "dropdown", value: "en-US", values: { options: captionTranslateLanguages } },
                { name: "captions.showtime", id: "captions.showtime", input: "number", value: 5, values: { min: 1, max: 60 } },
                // label?
                { name: "captions.powered_by", values: { subtext: "CAPTION.Ninja" }, input: "tip" },
            ],
            // WIP custom inputs for the css
            // https://github.com/steveseguin/captionninja?tab=readme-ov-file#changing-the-font-size-and-more
            CSS: [{ id: "captions.style", input: "CSS" }],
        },
    },
    icon: {
        icon: "star",
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
