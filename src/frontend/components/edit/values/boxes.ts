import type { ItemType } from "./../../../../types/Show"
import { captionLanguages } from "./captionLanguages"
import dayjs from "dayjs"
import localizedFormat from "dayjs/plugin/localizedFormat"
import extendedFormat from "dayjs/plugin/advancedFormat"

// Initialize plugins
dayjs.extend(localizedFormat)
dayjs.extend(extendedFormat)

export type Box = {
    [key in ItemType]?: BoxContent
}
type BoxContent = {
    name?: string
    icon: string
    edit: {
        [key: string]: EditInput[]
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
    disabled?: string | boolean
    valueIndex?: number
    values?: any
    popup?: string
    enableNoColor?: boolean
    slider?: boolean // include number slider
    sliderValues?: any // custom number slider values
    styleValue?: string // custom css styling
    title?: string // custom hover title
    relative?: boolean // updated values should be relative to each selected item (only for number px values)
    placeholder?: string
}

export function setBoxInputValue(box: BoxContent | { [key: string]: EditInput[] }, sectionId: string, inputId: string, key: keyof EditInput, value: any) {
    const newBox = (box.edit ? box : { edit: box, icon: "" }) as BoxContent

    if (!sectionId) sectionId = "default"
    if (!newBox?.edit?.[sectionId]) return

    const section = newBox.edit[sectionId]
    const keyIndex = section.findIndex((a) => (a.id === "style" ? a.key === inputId : a.id === inputId))
    if (keyIndex < 0) return

    section[keyIndex][key] = value
}

export const mediaFitOptions: any[] = [
    { id: "contain", name: "$:media.contain:$" },
    { id: "cover", name: "$:media.cover:$" },
    { id: "fill", name: "$:media.fill:$" },
    { id: "blur", name: "$:media.blur_fill:$" },
    // { id: "scale-down", name: "Scale down" },
]

export const trackerEdits = [
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
    { name: "edit.sub_indexes", input: "checkbox", id: "tracker.childProgress", value: false },
    { name: "edit.one_letter", input: "checkbox", id: "tracker.oneLetter", value: false },
]

const now = new Date(2025, 0, 10)

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
                { name: "letter_spacing", id: "style", key: "letter-spacing", input: "number", value: 0, values: { max: 100, min: -300 }, extension: "px" },
                { name: "word_spacing", id: "style", key: "word-spacing", input: "number", value: 0, values: { min: -100, max: 200 }, extension: "px" },
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
                // probably not needed as we have line and item background color
                // { name: "background_color", id: "style", key: "background-color", input: "color", value: "rgb(0 0 0 / 0)", enableNoColor: true },
                { name: "no_wrap", id: "nowrap", input: "checkbox", value: false },
            ],
            lines: [
                { name: "line_height", id: "style", key: "line-height", input: "number", value: 1.1, values: { max: 5, step: 0.1, decimals: 1, inputMultiplier: 10 }, extension: "em" },
                { name: "line_spacing", id: "specialStyle.lineGap", input: "number", value: 0, values: { max: 500 } },
                { name: "background_color", id: "specialStyle.lineBg", input: "color", value: "", enableNoColor: true },
                { name: "background_opacity", id: "specialStyle.opacity", input: "number", value: 1, values: { step: 0.1, decimals: 1, min: 0.1, max: 1, inputMultiplier: 10 } },
            ],
            list: [
                { name: "list", id: "list.enabled", input: "checkbox", value: false },
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
                    // disabled: "list.interval", // WIP still disabled when set back to 0
                    hidden: true,
                },
                // { name: "one_at_a_time", id: "one_at_a_time", input: "checkbox", value: false },
                // { name: "interval", id: "list.interval", input: "number", value: 0, hidden: true }, // slide timers can be user for this
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
                { name: "size", id: "chords.size", input: "number", value: 60, hidden: true },
                { name: "vertical_offset", id: "chords.offsetY", input: "number", value: 0, values: { min: -1000 }, hidden: true },
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
                { name: "scrolling_speed", id: "scrolling.speed", input: "number", value: 30, values: { min: 1, max: 100 } },
                { name: "press_action", id: "button.press", input: "action", value: "" },
                { name: "release_action", id: "button.release", input: "action", value: "" },
            ],
            CSS: [{ id: "text", input: "CSS" }],
        },
    },
    // list has moved to textbox, but some might still have the old item
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
        },
    },
    media: {
        icon: "image",
        edit: {
            default: [
                { id: "src", input: "media" },
                { name: "media.fit", id: "fit", input: "dropdown", value: "contain", values: { options: mediaFitOptions } },
                // { name: "popup.media_fit", id: "fit", input: "popup", popup: "media_fit" }, // WIP
                { name: "actions.mute", id: "muted", input: "checkbox", value: false }, // , hidden: true
                { name: "media.flip_horizontally", id: "flipped", input: "checkbox", value: false },
                { name: "media.flip_vertically", id: "flippedY", input: "checkbox", value: false },
                // WIP crop image
                // object-position: 20px 20px;
                // transform: scale(1.2) translate(0, 5%);
            ],
            // same as media.ts mediaFilters
            filters: [
                { name: "filter.hue-rotate", id: "filter", key: "hue-rotate", input: "number", slider: true, value: 0, values: { max: 360, step: 5 }, sliderValues: { step: 1 }, extension: "deg" },
                { name: "filter.invert", id: "filter", key: "invert", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.blur", id: "filter", key: "blur", input: "number", slider: true, value: 0, values: { max: 100 }, extension: "px", sliderValues: { max: 50 } },
                { name: "filter.grayscale", id: "filter", key: "grayscale", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.sepia", id: "filter", key: "sepia", input: "number", slider: true, value: 0, values: { max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 } },
                { name: "filter.brightness", id: "filter", key: "brightness", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0.2, max: 1.8 } },
                { name: "filter.contrast", id: "filter", key: "contrast", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0.2, max: 1.8 } },
                { name: "filter.saturate", id: "filter", key: "saturate", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { max: 2 } },
                { name: "filter.opacity", id: "filter", key: "opacity", input: "number", slider: true, value: 1, values: { max: 1, step: 0.1, decimals: 2, inputMultiplier: 100 }, sliderValues: { step: 0.01 } },
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
                { name: "media.fit", id: "fit", input: "dropdown", value: "contain", values: { options: mediaFitOptions.filter((a) => a.id !== "blur") } },
                { name: "media.flip_horizontally", id: "flipped", input: "checkbox", value: false },
                { name: "media.flip_vertically", id: "flippedY", input: "checkbox", value: false },
            ],
        },
    },
    timer: {
        icon: "timer",
        edit: {
            default: [
                { id: "timer.id", input: "editTimer" },
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
                { name: "timer.hours", id: "timer.showHours", input: "checkbox", value: true },
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
                            { id: "custom", name: "$:clock.custom:$" },
                        ],
                    },
                },
                {
                    name: "sort.date",
                    input: "dropdown",
                    id: "clock.dateFormat",
                    value: "none",
                    hidden: true,
                    values: {
                        options: [
                            { id: "none", name: "$:main.none:$" },
                            { id: "LL", name: `${dayjs(now).format("LL")}` }, // January 10, 2025
                            { id: "ll", name: `${dayjs(now).format("ll")}` }, // Jan 10, 2025
                            { id: "DD/MM/YYYY", name: `${dayjs(now).format("DD/MM/YYYY")}` }, // 10/01/2025
                            { id: "MM/DD/YYYY", name: `${dayjs(now).format("MM/DD/YYYY")}` }, // 01/10/2025
                            { id: "YYYY-MM-DD", name: `${dayjs(now).format("YYYY-MM-DD")}` }, // 2025-01-10
                        ],
                    },
                },
                {
                    name: "clock.show_time",
                    input: "checkbox",
                    id: "clock.showTime",
                    value: true,
                    hidden: true,
                },
                {
                    name: "clock.seconds",
                    input: "checkbox",
                    id: "clock.seconds",
                    value: false,
                    hidden: true,
                },
                {
                    name: "actions.format",
                    title: "Day: {DD}, Month: {MM}, Full year: {YYYY}, Hours: {hh}, Minutes: {mm}, Seconds: {ss}, AM/PM: {A}, Full date: {LLL}", // similar to getProjectName()
                    input: "text",
                    id: "clock.customFormat",
                    value: "hh:mm a",
                    hidden: true,
                    // input_placeholder: "Examples: LT, LLLL, MMMM D YYYY h:mm A",
                },
                {
                    name: "",
                    input: "tip",
                    values: { subtext: '<a href="https://day.js.org/docs/en/display/format#list-of-all-available-formats" class="open">List of day.js formats</a>' },
                    hidden: true,
                    disabled: "clock",
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
    // variable has moved to textbox, but some might still have the old item
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
