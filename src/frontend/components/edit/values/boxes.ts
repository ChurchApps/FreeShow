import dayjs from "dayjs"
import extendedFormat from "dayjs/plugin/advancedFormat"
import localizedFormat from "dayjs/plugin/localizedFormat"
import { clone } from "../../helpers/array"
import type { ItemType } from "./../../../../types/Show"
import { captionLanguages } from "./captionLanguages"

// Initialize plugins
dayjs.extend(localizedFormat)
dayjs.extend(extendedFormat)

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
    slider?: boolean // include number slider
    sliderValues?: any // custom number slider values
    styleValue?: string // custom css styling
    title?: string // custom hover title
    relative?: boolean // updated values should be relative to each selected item (only for number px values)
    placeholder?: string
}

export function setBoxInputValue(box: BoxContent2 | { [key: string]: EditBoxSection }, sectionId: string, inputId: string, key: keyof EditInput | string, value: any) {
    const newBox = (box?.sections ? box.sections : box) as { [key: string]: EditBoxSection }

    if (!sectionId) sectionId = "default"
    if (!newBox?.[sectionId]) return

    const inputs = newBox[sectionId].inputs.flat()
    const keyIndex = inputs.findIndex(a => a.key === inputId || a.id === inputId)
    if (keyIndex < 0) return

    if (key === "values") {
        inputs[keyIndex].values = { ...inputs[keyIndex].values, ...value }
    } else if (key === "default") {
        inputs[keyIndex].value = value
    } else if (key === "value" || key === "name" || key === "disabled" || key === "options") {
        inputs[keyIndex].values[key] = value
    } else {
        inputs[keyIndex][key] = value
    }
}

const now = new Date(2025, 0, 10)

type Box2 = {
    [key in ItemType]?: BoxContent2
}
export type BoxContent2 = {
    name?: string
    icon: string
    sections: { [key: string]: EditBoxSection }
}
export type EditBoxSection = {
    // openApplyValue?: boolean // show apply value button
    inputs: EditInput2[][]
    name?: string
    noReset?: boolean
    alwaysOpen?: boolean
    defaultValues?: any[]
    expandAutoValue?: { [key: string]: any }
}
export type EditInput2 = {
    id: string
    key?: string
    valueIndex?: number // css key subvalue (e.g. box-shadow)
    type: string
    value: string | number | boolean
    values: { [key: string]: any }
    hidden?: boolean
    disabled?: boolean

    // special
    extension?: string
    styleValue?: string
    multiplier?: number // number input
}

///

export const mediaFitOptions = [
    { value: "contain", label: "media.contain" },
    { value: "cover", label: "media.cover" },
    { value: "fill", label: "media.fill" },
    { value: "blur", label: "media.blur_fill" }
]
export const mediaFitOptionsNoBlur = [
    { value: "contain", label: "media.contain" },
    { value: "cover", label: "media.cover" },
    { value: "fill", label: "media.fill" }
]

export const filterSection = splitIntoRows([
    { id: "filter", key: "hue-rotate", type: "number", value: 0, extension: "deg", values: { label: "filter.hue-rotate", defaultValue: 0, step: 5, max: 360, showSlider: true, sliderValues: { step: 1 } } },
    { id: "filter", key: "invert", type: "number", value: 0, multiplier: 10, values: { label: "filter.invert", defaultValue: 0, max: 10, showSlider: true } },
    { id: "filter", key: "blur", type: "number", value: 0, extension: "px", values: { label: "filter.blur", defaultValue: 0, max: 100, showSlider: true, sliderValues: { max: 50 } } },
    { id: "filter", key: "grayscale", type: "number", value: 0, multiplier: 10, values: { label: "filter.grayscale", defaultValue: 0, max: 10, showSlider: true } },
    { id: "filter", key: "sepia", type: "number", value: 0, multiplier: 10, values: { label: "filter.sepia", defaultValue: 0, max: 10, showSlider: true } },
    { id: "filter", key: "brightness", type: "number", value: 1, multiplier: 10, values: { label: "filter.brightness", defaultValue: 10, max: 100, showSlider: true, sliderValues: { min: 2, max: 18 } } },
    { id: "filter", key: "contrast", type: "number", value: 1, multiplier: 10, values: { label: "filter.contrast", defaultValue: 10, max: 100, showSlider: true, sliderValues: { min: 2, max: 18 } } },
    { id: "filter", key: "saturate", type: "number", value: 1, multiplier: 10, values: { label: "filter.saturate", defaultValue: 10, max: 100, showSlider: true, sliderValues: { max: 20 } } },
    { id: "filter", key: "opacity", type: "number", value: 1, multiplier: 100, values: { label: "filter.opacity", defaultValue: 100, step: 10, max: 100, showSlider: true, sliderValues: { step: 1 } } }
])

///

const alignX = [
    { id: "style", key: "text-align", type: "radio", value: "left", values: { label: "edit._title_left", icon: "alignLeft" } },
    { id: "style", key: "text-align", type: "radio", value: "center", values: { label: "edit._title_center", icon: "alignCenter" } },
    { id: "style", key: "text-align", type: "radio", value: "right", values: { label: "edit._title_right", icon: "alignRight" } }
]
const alignTextX = [...alignX, { id: "style", key: "text-align", type: "radio", value: "justify", values: { label: "edit._title_justify", icon: "alignJustify" } }]
const alignY = [
    { id: "style", key: "align-items", type: "radio", value: "flex-start", values: { label: "edit.align_start", icon: "alignTop" } },
    { id: "style", key: "align-items", type: "radio", value: "center", values: { label: "edit.align_center", icon: "alignMiddle" } },
    { id: "style", key: "align-items", type: "radio", value: "flex-end", values: { label: "edit.align_end", icon: "alignBottom" } }
]

export const textSections: { [key: string]: EditBoxSection } = {
    default: {
        // WIP icon color..?

        inputs: [
            [
                { id: "style", key: "font-family", type: "fontDropdown", value: "CMGSans", styleValue: "", values: { label: "edit.family", style: "flex: 4;max-width: 80%;" } },
                { id: "style", key: "color", type: "color", value: "#FFFFFF", values: { label: "edit.text_color", allowGradients: true, allowOpacity: true, noLabel: true, style: "flex: 1;" } }
            ],
            [
                { id: "style", key: "font-size", type: "number", value: 100, extension: "px", values: { label: "edit.font_size", style: "flex: 1;" } },
                {
                    id: "textFit",
                    type: "dropdown",
                    value: "none",
                    values: {
                        // label: "edit.text_fit",
                        label: "edit.auto_size",
                        options: [
                            { value: "none", label: "main.none" },
                            { value: "shrinkToFit", label: "edit.shrink_to_fit" },
                            { value: "growToFit", label: "edit.grow_to_fit" }
                        ],
                        style: "width: 50%;"
                    }
                }
            ],
            [
                { id: "style", key: "font-weight", type: "toggle", value: "bold", values: { label: "edit._title_bold", icon: "bold" } },
                { id: "style", key: "font-style", type: "toggle", value: "italic", values: { label: "edit._title_italic", icon: "italic" } },
                { id: "style", key: "text-decoration", type: "toggle", value: "underline", values: { label: "edit._title_underline", icon: "underline" } },
                { id: "style", key: "text-decoration", type: "toggle", value: "line-through", values: { label: "edit._title_strikethrough", icon: "strikethrough" } }
            ]
        ]
    },
    align: {
        defaultValues: ["center", "center"],
        inputs: [alignTextX, alignY]
    },
    text: {
        inputs: [
            [
                { id: "style", key: "letter-spacing", type: "number", value: 0, values: { label: "edit.letter_spacing", max: 100, min: -300 }, extension: "px" },
                { id: "style", key: "word-spacing", type: "number", value: 0, values: { label: "edit.word_spacing", min: -100, max: 200 }, extension: "px" }
            ],
            [
                {
                    id: "style",
                    key: "text-transform",
                    type: "dropdown",
                    value: "",
                    values: {
                        label: "edit.text_transform",
                        options: [
                            { label: "edit.uppercase", value: "uppercase", style: "text-transform: uppercase;" },
                            { label: "edit.lowercase", value: "lowercase", style: "text-transform: lowercase;" },
                            { label: "edit.capitalize", value: "capitalize", style: "text-transform: capitalize;" }
                        ],
                        allowEmpty: true
                    }
                }
            ],
            [
                // probably not needed as we have line and item background color
                // { label: "background_color", id: "style", key: "background-color", type: "color", value: "rgb(0 0 0 / 0)", values: { enableNoColor: true } },
                { id: "nowrap", type: "checkbox", value: false, values: { label: "edit.no_wrap" } }
            ]
        ]
    },
    lines: {
        inputs: [
            [
                { id: "style", key: "line-height", type: "number", value: 1.1, multiplier: 10, extension: "em", values: { label: "edit.line_height", max: 50 } },
                { id: "specialStyle.lineGap", type: "number", value: 0, values: { label: "edit.line_spacing", max: 500 } }
            ],
            [
                { id: "specialStyle.lineBg", type: "color", value: "", values: { label: "edit.background_color", allowGradients: true, allowOpacity: true, allowEmpty: true, noLabel: true } }
                // { id: "specialStyle.opacity", type: "number", value: 1, values: { label: "edit.background_opacity", step: 0.1, decimals: 1, min: 0.1, max: 1, inputMultiplier: 10 } }
            ],
            [{ id: "specialStyle.lineRadius", type: "number", value: 0, values: { label: "edit.line_radius", max: 100 } }]
        ]
    },
    list: {
        expandAutoValue: {
            "list.enabled": true
        },
        inputs: [
            [{ id: "list.enabled", type: "checkbox", value: false, values: { label: "edit.list" } }],
            [
                {
                    type: "dropdown",
                    id: "list.style",
                    value: "disc",
                    values: {
                        label: "edit.style",
                        options: [
                            // common
                            { value: "disc", label: "list.disc" },
                            { value: "circle", label: "list.circle" },
                            { value: "square", label: "list.square" },
                            { value: "disclosure-closed", label: "list.disclosure-closed" },
                            { value: "disclosure-open", label: "list.disclosure-open" },
                            // numbers
                            { value: "decimal", label: "list.decimal" },
                            { value: "decimal-leading-zero", label: "list.decimal-leading-zero" },
                            // alpha
                            { value: "lower-alpha", label: "list.lower-alpha" }, // same as latin
                            { value: "upper-alpha", label: "list.upper-alpha" }, // same as latin
                            { value: "lower-roman", label: "list.lower-roman" },
                            { value: "upper-roman", label: "list.upper-roman" },
                            { value: "lower-greek", label: "list.lower-greek" }
                            // special
                            // {value: "bengali", label: "list.bengali" },
                            // {value: "cambodian", label: "list.cambodian" },
                            // {value: "devanagari", label: "list.devanagari" },
                        ]
                    }
                }
            ]
        ]
    },
    outline: {
        expandAutoValue: {
            "-webkit-text-stroke-width": 2
        },
        inputs: [
            [
                { id: "style", key: "-webkit-text-stroke-width", type: "number", value: 0, extension: "px", values: { label: "edit.width", max: 100, style: "flex: 4;" } },
                { id: "style", key: "-webkit-text-stroke-color", type: "color", value: "#000000", values: { label: "edit.color", allowOpacity: true, noLabel: true, style: "flex: 1;" } }
            ]
        ]
    },
    shadow: {
        expandAutoValue: {
            "text-shadow": "0 0 0 rgb(0 0 0 / 0)"
        },
        inputs: [
            [
                { id: "style", key: "text-shadow", valueIndex: 2, type: "number", value: 10, extension: "px", values: { label: "edit.blur", style: "flex: 4;" } },
                { id: "style", key: "text-shadow", valueIndex: 3, type: "color", value: "#000000", values: { label: "edit.color", allowOpacity: true, noLabel: true, style: "flex: 1;" } }
            ],
            [
                { id: "style", key: "text-shadow", valueIndex: 0, type: "number", value: 2, extension: "px", values: { label: "edit.offsetX", min: -1000 } },
                { id: "style", key: "text-shadow", valueIndex: 1, type: "number", value: 2, extension: "px", values: { label: "edit.offsetY", min: -1000 } }
            ]
        ]
    },
    chords: {
        expandAutoValue: {
            "chords.enabled": true
        },
        inputs: [
            [{ id: "chords.enabled", type: "checkbox", value: false, values: { label: "edit.chords" } }],
            [
                { id: "chords.size", type: "number", value: 60, values: { label: "edit.size", style: "flex: 4;" } },
                { id: "chords.color", type: "color", value: "#FF851B", values: { label: "edit.color", allowOpacity: true, noLabel: true, style: "flex: 1;" } }
            ],
            [{ id: "chords.offsetY", type: "number", value: 0, values: { label: "edit.vertical_offset", min: -1000 } }]
        ]
    },
    scrolling: {
        expandAutoValue: {
            "scrolling.type": "right_left"
        },
        inputs: [
            [
                {
                    id: "scrolling.type",
                    type: "dropdown",
                    value: "none",
                    values: {
                        label: "edit.scrolling",
                        options: [
                            { value: "none", label: "main.none" },
                            { value: "top_bottom", label: "edit.top_bottom" },
                            { value: "bottom_top", label: "edit.bottom_top" },
                            { value: "left_right", label: "edit.left_right" },
                            { value: "right_left", label: "edit.right_left" }
                        ]
                    }
                }
            ],
            [{ id: "scrolling.speed", type: "number", value: 30, values: { label: "edit.scrolling_speed", min: 1, max: 100 } }]
        ]
    },
    special: {
        inputs: [[{ id: "button.press", type: "dropdown", value: "", values: { label: "edit.press_action", options: "actions", allowEmpty: true } }], [{ id: "button.release", type: "dropdown", value: "", values: { label: "edit.release_action", options: "actions", allowEmpty: true } }]]
    },
    CSS: {
        noReset: true,
        inputs: [[{ id: "CSS_text", type: "textarea", value: "", values: { label: "CSS" } }]]
    }
}

const mediaSections: { [key: string]: EditBoxSection } = {
    default: {
        inputs: splitIntoRows([
            { id: "src", type: "media", value: "", values: { label: "items.media" } },
            { id: "fit", type: "dropdown", value: "contain", values: { label: "media.fit", defaultValue: "contain", options: mediaFitOptions } },
            // { name: "popup.media_fit", id: "fit", input: "popup", popup: "media_fit" }, // WIP
            { id: "muted", type: "checkbox", value: false, values: { label: "actions.mute" } }, // , hidden: true
            { id: "loop", type: "checkbox", value: true, values: { label: "media._loop" } },
            { id: "speed", type: "number", value: 1, values: { label: "media.speed", defaultValue: 1, step: 0.1, min: 0.1, max: 15, showSlider: true } },
            { id: "flipped", type: "checkbox", value: false, values: { label: "media.flip_horizontally" } },
            { id: "flippedY", type: "checkbox", value: false, values: { label: "media.flip_vertically" } }
            // WIP crop image
            // object-position: 20px 20px;
            // transform: scale(1.2) translate(0, 5%);
        ])
    },
    filters: {
        inputs: filterSection
    }
}

///

export function splitIntoRows(inputs: EditInput2[]) {
    return inputs.map(a => [a])
}

function eventText(defaultSection: any) {
    const defaultTextSection = clone(textSections.default)

    return clone({
        default: defaultSection,
        font: defaultTextSection,
        // align: textSections.align,
        text: textSections.text,
        lines: textSections.lines,
        outline: textSections.outline,
        shadow: textSections.shadow,
        CSS: textSections.CSS
    })
}

function nonTextboxTextStyle(defaultSection: EditBoxSection) {
    const defaultTextSection = clone(textSections.default)
    defaultTextSection.inputs[1][1].value = "growToFit"
    defaultTextSection.inputs[1][1].values.options.splice(1, 1)
    defaultTextSection.inputs[0][1].values.allowGradients = false
    // defaultTextSection.inputs[1][0].disabled = "auto"

    const letterSpacing = { id: "style", key: "letter-spacing", type: "number", value: 0, values: { label: "edit.letter_spacing", max: 100, min: -300 }, extension: "px" }

    return clone({
        default: defaultSection,
        font: defaultTextSection,
        align: { defaultValues: ["center"], inputs: [alignX] },
        text: { inputs: [[letterSpacing]] },
        outline: textSections.outline,
        shadow: textSections.shadow,
        CSS: textSections.CSS
    })
}

///

export const itemBoxes: Box2 = {
    text: {
        // name: "items.text",
        icon: "text",
        sections: textSections
    },
    media: {
        icon: "image",
        sections: mediaSections
    },
    web: {
        icon: "web",
        sections: {
            default: {
                inputs: splitIntoRows([
                    { id: "web.src", type: "string", value: "", values: { label: "inputs.url" } },
                    { id: "web.noNavigation", type: "checkbox", value: false, values: { label: "edit.disable_navigation" } }
                ])
            }
        }
    },
    timer: {
        icon: "timer",
        sections: {
            ...nonTextboxTextStyle({
                inputs: splitIntoRows([
                    { id: "timer.id", type: "dropdown", value: "", values: { label: "items.timer", options: "timers" } },
                    {
                        id: "timer.viewType",
                        type: "dropdown",
                        value: "time",
                        values: {
                            label: "clock.type",
                            options: [
                                { value: "time", label: "timer.time" },
                                { value: "line", label: "timer.line" },
                                { value: "circle", label: "list.circle" }
                            ]
                        }
                    },
                    { id: "timer.circleMask", type: "checkbox", value: false, values: { label: "timer.mask" } },
                    { id: "timer.showHours", type: "checkbox", value: true, values: { label: "timer.hours" } }
                ])
            })
        }
    },
    clock: {
        icon: "clock",
        sections: {
            ...nonTextboxTextStyle({
                inputs: splitIntoRows([
                    {
                        id: "clock.type",
                        type: "dropdown",
                        value: "digital",
                        values: {
                            label: "clock.type",
                            options: [
                                { value: "digital", label: "clock.digital" },
                                { value: "analog", label: "clock.analog" },
                                { value: "custom", label: "clock.custom" }
                            ]
                        }
                    },
                    {
                        id: "clock.dateFormat",
                        type: "dropdown",
                        value: "none",
                        hidden: true,
                        values: {
                            label: "sort.date",
                            options: [
                                { value: "none", label: "main.none" },
                                { value: "LL", label: `${dayjs(now).format("LL")}` }, // January 10, 2025
                                { value: "ll", label: `${dayjs(now).format("ll")}` }, // Jan 10, 2025
                                { value: "DD/MM/YYYY", label: `${dayjs(now).format("DD/MM/YYYY")}` }, // 10/01/2025
                                { value: "MM/DD/YYYY", label: `${dayjs(now).format("MM/DD/YYYY")}` }, // 01/10/2025
                                { value: "YYYY-MM-DD", label: `${dayjs(now).format("YYYY-MM-DD")}` } // 2025-01-10
                            ]
                        }
                    },
                    {
                        id: "clock.showTime",
                        type: "checkbox",
                        value: true,
                        values: {
                            label: "clock.show_time"
                        },
                        hidden: true
                    },
                    {
                        id: "clock.seconds",
                        type: "checkbox",
                        value: false,
                        values: {
                            label: "clock.seconds"
                        },
                        hidden: true
                    },
                    {
                        id: "clock.customFormat",
                        type: "string",
                        value: "hh:mm a",
                        hidden: true,
                        values: {
                            label: "actions.format",
                            title: "Day: {DD}, Month: {MM}, Full year: {YYYY}, Hours: {hh}, Minutes: {mm}, Seconds: {ss}, AM/PM: {A}, Full date: {LLL}", // similar to getProjectName()
                            defaultValue: "hh:mm a",
                            placeholder: "E.g.: LT, LLLL, MMMM D YYYY h:mm A"
                        }
                    },
                    {
                        id: "tip",
                        type: "tip",
                        hidden: true,
                        value: "",
                        values: {
                            label: "",
                            subtext: '<a href="https://day.js.org/docs/en/display/format#list-of-all-available-formats" class="open">List of day.js formats</a>'
                        }
                    }
                ])
            })
        }
    },
    camera: {
        icon: "camera",
        sections: {
            default: {
                inputs: splitIntoRows([
                    { id: "device", type: "popup", value: "", values: { label: "popup.choose_camera", icon: "camera", popupId: "choose_camera" } },
                    { id: "fit", type: "dropdown", value: "contain", values: { label: "media.fit", options: mediaFitOptions.filter(a => a.value !== "blur") } },
                    { id: "flipped", type: "checkbox", value: false, values: { label: "media.flip_horizontally" } },
                    { id: "flippedY", type: "checkbox", value: false, values: { label: "media.flip_vertically" } }
                ])
            }
        }
    },
    slide_tracker: {
        icon: "percentage",
        sections: {
            ...nonTextboxTextStyle({
                inputs: [
                    [
                        {
                            id: "tracker.type",
                            type: "dropdown",
                            value: "number",
                            values: {
                                label: "clock.type",
                                options: [
                                    { value: "number", label: "variables.number" },
                                    { value: "bar", label: "edit.progress_bar" },
                                    { value: "group", label: "tools.groups" }
                                ],
                                style: "flex: 4;"
                            }
                        },
                        {
                            id: "tracker.accent",
                            type: "color",
                            value: "#F0008C",
                            values: {
                                label: "edit.accent_color",
                                allowEmpty: true,
                                noLabel: true,
                                style: "flex: 1;"
                            }
                        }
                    ],
                    [{ type: "checkbox", id: "tracker.childProgress", value: false, values: { label: "edit.sub_indexes" } }],
                    [{ type: "checkbox", id: "tracker.oneLetter", value: false, values: { label: "edit.one_letter" } }]
                ]
            })
        }
    },
    events: {
        icon: "calendar",
        sections: {
            ...eventText({
                inputs: [
                    [{ id: "events.maxEvents", type: "number", value: 5, values: { label: "edit.max_events", max: 20 } }],
                    [{ id: "events.startDaysFromToday", type: "number", value: 0, values: { label: "edit.start_days_from_today", max: 10000 } }],
                    [{ id: "events.justOneDay", type: "checkbox", value: false, values: { label: "edit.just_one_day" } }],
                    [{ id: "events.enableStartDate", type: "checkbox", value: false, values: { label: "edit.enable_start_date" } }],
                    [
                        { id: "events.startDate", type: "date", hidden: true, value: "", values: { label: "calendar.from_date" } },
                        { id: "events.startTime", type: "time", hidden: true, value: "", values: { label: "calendar.from_time" } }
                    ]
                ]
            })
        }
    },
    weather: {
        icon: "cloud",
        sections: {
            default: {
                inputs: [
                    [{ id: "weather.size", type: "number", value: 100, values: { label: "edit.size", min: 0, max: 200 } }],
                    [
                        { id: "weather.latitude", type: "number", value: 0, values: { label: "edit.latitude", min: -90, max: 90 } },
                        { id: "weather.longitude", type: "number", value: 0, values: { label: "edit.longitude", min: -180, max: 180 } }
                        // {  id: "weather.altitude", type: "number", value: 0, values: { label: "edit.altitude", max: 5000 } },
                    ],
                    [{ id: "weather.useFahrenheit", type: "checkbox", value: false, values: { label: "edit.fahrenheit" } }],
                    [{ id: "weather.longRange", type: "checkbox", value: false, values: { label: "edit.longRange" } }]
                ]
            }
        }
    },
    visualizer: {
        icon: "visualizer",
        sections: {
            default: {
                inputs: [
                    [
                        { id: "visualizer.padding", type: "number", value: 0, values: { label: "edit.padding", style: "flex: 4;" } },
                        { id: "visualizer.color", type: "color", value: "", values: { label: "edit.color", allowEmpty: true, allowOpacity: true, noLabel: true, style: "flex: 1;" } }
                    ]
                ]
            }
        }
    },
    captions: {
        icon: "captions",
        sections: {
            default: {
                inputs: splitIntoRows([
                    { id: "captions.language", type: "dropdown", value: "en-US", values: { label: "captions.language", options: captionLanguages.map(a => ({ value: a.id, label: a.name })) } },
                    // this is very limited
                    // { id: "captions.translate", type: "dropdown", value: "en-US", values: { label: "captions.translate", options: captionTranslateLanguages } },
                    { id: "captions.showtime", type: "number", value: 5, values: { label: "captions.showtime", min: 1, max: 60 } },
                    { id: "", type: "tip", value: "", values: { label: "captions.powered_by", subtext: "CAPTION.Ninja" } }
                ])
            },
            // WIP custom inputs for the css
            // https://github.com/steveseguin/captionninja?tab=readme-ov-file#changing-the-font-size-and-more
            CSS: {
                noReset: true,
                inputs: [[{ id: "captions.style", type: "textarea", value: "", values: { label: "CSS" } }]]
            }
        }
    },
    current_output: {
        icon: "screen",
        sections: {
            default: {
                inputs: splitIntoRows([
                    { id: "currentOutput.source", type: "dropdown", value: "", values: { label: "show.source", options: "outputWindows", allowEmpty: true } },
                    { id: "currentOutput.showLabel", type: "checkbox", value: false, values: { label: "stage.labels" } }
                ])
            }
        }
    },
    icon: {
        icon: "star",
        sections: {
            default: { inputs: [[{ id: "style", key: "color", type: "color", value: "#FFFFFF", values: { label: "edit.color", allowOpacity: true } }]] }
        }
    }
}
