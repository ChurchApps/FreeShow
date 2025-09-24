import type { MediaType } from "../../../../types/Show"
import { filterSection, mediaFitOptions, mediaFitOptionsNoBlur, splitIntoRows, type BoxContent2, type EditBoxSection } from "./boxes"

export const filterSections: { [key: string]: EditBoxSection } = {
    default: { inputs: filterSection }
}

const croppingRows = splitIntoRows([
    { id: "cropping.top", type: "number", value: 0, values: { label: "screen.top", max: 10000, showSlider: true, sliderValues: { max: 500 } } },
    { id: "cropping.right", type: "number", value: 0, values: { label: "screen.right", max: 10000, showSlider: true, sliderValues: { max: 500 } } },
    { id: "cropping.bottom", type: "number", value: 0, values: { label: "screen.bottom", max: 10000, showSlider: true, sliderValues: { max: 500 } } },
    { id: "cropping.left", type: "number", value: 0, values: { label: "screen.left", max: 10000, showSlider: true, sliderValues: { max: 500 } } }
])

const defaultMedia = splitIntoRows([
    {
        id: "videoType", // can be image as well
        type: "dropdown",
        value: "",
        values: {
            label: "clock.type",
            defaultValue: "",
            options: [
                { value: "", label: "example.default" },
                { value: "background", label: "preview.background" }, // muted, looping
                { value: "foreground", label: "preview.foreground" } // unmuted, not looping, will display even when the "Background" layer is turned off.
            ]
        }
    },
    { id: "fit", type: "dropdown", value: "", values: { label: "media.fit", defaultValue: "", options: [{ value: "", label: "themes.default" }, ...mediaFitOptions] } },
    { id: "flipped", type: "checkbox", value: false, values: { label: "media.flip_horizontally", } },
    { id: "flippedY", type: "checkbox", value: false, values: { label: "media.flip_vertically", } }
])

export const mediaBoxes: { [key in MediaType]?: BoxContent2 } = {
    video: {
        icon: "video",
        sections: {
            default: {
                inputs: defaultMedia
            },
            video: {
                alwaysOpen: true,
                inputs: splitIntoRows([
                    { id: "speed", type: "number", value: 1, values: { label: "media.speed", min: 0.1, max: 15, step: 0.1, showSlider: true } },
                    { id: "volume", type: "number", value: 100, values: { label: "media.volume", max: 100, showSlider: true, } },
                    { id: "fromTime", type: "number", value: 0, values: { label: "inputs.start", max: 100000, showSlider: true } },
                    { id: "toTime", type: "number", value: 0, values: { label: "inputs.end", max: 100000, showSlider: true } }
                ])
            }
        }
    },
    image: {
        icon: "image",
        sections: {
            default: {
                inputs: defaultMedia
            },
            cropping: {
                inputs: croppingRows
            }
        }
    },
    camera: {
        icon: "music",
        sections: {
            default: {
                inputs: splitIntoRows([
                    { id: "fit", type: "dropdown", value: "", values: { label: "media.fit", defaultValue: "", options: [{ value: "", label: "themes.default" }, ...mediaFitOptionsNoBlur] } },
                    { id: "flipped", type: "checkbox", value: false, values: { label: "media.flip_horizontally", } },
                    { id: "flippedY", type: "checkbox", value: false, values: { label: "media.flip_vertically", } }
                ])
            },
        }
    }
}

// AUDIO //

export const audioSections: { [key: string]: EditBoxSection } = {
    default: {
        inputs: splitIntoRows([
            {
                id: "audioType",
                type: "dropdown",
                value: "",
                values: {
                    label: "clock.type",
                    defaultValue: "",
                    options: [
                        { value: "", label: "example.default" },
                        { value: "music", label: "audio.type_music" }, // normal playback
                        { value: "effect", label: "audio.type_effect" } // can be stacked
                    ]
                }
            },
            // { id: "speed", type: "number", value: 1, values: { label: "media.speed", min: 0.1, max: 15, step: 0.1, showSlider: true } },
            { id: "volume", type: "number", value: 1, multiplier: 100, values: { label: "media.volume", min: 1, max: 100, showSlider: true, } },
            { id: "fromTime", type: "number", value: 0, values: { label: "inputs.start", max: 100000, showSlider: true } },
            { id: "toTime", type: "number", value: 0, values: { label: "inputs.end", max: 100000, showSlider: true } }
        ])
    }
}