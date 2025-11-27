import { splitIntoRows, type EditBoxSection } from "./boxes"

export const effectSections: { [key: string]: EditBoxSection } = {
    stars: {
        inputs: splitIntoRows([
            { id: "count", type: "number", value: 800, values: { label: "edit.count", max: 10000, step: 100, showSlider: true, sliderValues: { step: 10, max: 2000 } } },
            { id: "size", type: "number", value: 1, multiplier: 10, values: { label: "edit.size", max: 100, decimals: 1, showSlider: true, sliderValues: { min: 0, max: 20 } } },
            { id: "speed", type: "number", value: 1, multiplier: 10, values: { label: "edit.speed", max: 1000, decimals: 1, showSlider: true, sliderValues: { min: 0, max: 40 } } }
        ])
    },
    galaxy: {
        inputs: splitIntoRows([
            { id: "count", type: "number", value: 1500, values: { label: "edit.count", max: 10000, step: 100, showSlider: true, sliderValues: { step: 10, max: 4000 } } },
            { id: "size", type: "number", value: 1.5, multiplier: 10, values: { label: "edit.size", min: 10, max: 100, decimals: 1, showSlider: true, sliderValues: { min: 0, max: 30 } } },
            { id: "swirlStrength", type: "number", value: 0.5, multiplier: 100, values: { label: "effect.swirl_strength", min: 0, max: 100, step: 10, decimals: 2, showSlider: true, sliderValues: { step: 1 } } },
            { id: "rotationSpeed", type: "number", value: 1, values: { label: "edit.speed", min: -1000, max: 1000, step: 10, showSlider: true, sliderValues: { min: 0, max: 100, step: 1 } } },
            { id: "armCount", type: "number", value: 5, values: { label: "effect.arm_count", min: 1, max: 20, showSlider: true, sliderValues: { min: 2, max: 8 } } }
            // { name: "nebula", id: "nebula", input: "checkbox", value: true }
        ])
    },

    rain: {
        inputs: splitIntoRows([
            { id: "count", type: "number", value: 500, values: { label: "edit.count", max: 10000, step: 100, showSlider: true, sliderValues: { max: 1000, step: 10 } } },
            { id: "length", type: "number", value: 10, values: { label: "edit.length", min: 1, max: 1000, showSlider: true, sliderValues: { max: 100 } } },
            { id: "width", type: "number", value: 1, values: { label: "edit.width", min: 1, max: 10, showSlider: true, sliderValues: { max: 5 } } },
            { id: "speed", type: "number", value: 10, values: { label: "edit.speed", min: -100, max: 100, showSlider: true, sliderValues: { min: 0, max: 20 } } },
            { id: "color", type: "color", value: "rgba(135,206,250,0.6)", values: { label: "edit.color", allowOpacity: true } }
        ])
    },
    snow: {
        inputs: splitIntoRows([
            { id: "count", type: "number", value: 300, values: { label: "edit.count", max: 10000, step: 100, showSlider: true, sliderValues: { max: 1000, step: 10 } } },
            { id: "size", type: "number", value: 2, values: { label: "edit.size", min: 1, max: 50, showSlider: true, sliderValues: { max: 10 } } },
            { id: "speed", type: "number", value: 1, values: { label: "edit.speed", min: -100, max: 100, showSlider: true, sliderValues: { min: 0, max: 20 } } },
            { id: "drift", type: "number", value: 2, values: { label: "effect.drift", max: 100, showSlider: true, sliderValues: { max: 10 } } },
            { id: "color", type: "color", value: "#ffffff", values: { label: "edit.color", allowOpacity: true } }
        ])
    },
    bubbles: {
        inputs: splitIntoRows([
            { id: "count", type: "number", value: 100, values: { label: "edit.count", max: 1000, step: 50, showSlider: true, sliderValues: { max: 200, step: 10 } } },
            { id: "size", type: "number", value: 20, values: { label: "edit.size", min: 1, max: 500, step: 10, showSlider: true, sliderValues: { max: 100, step: 1 } } },
            { id: "speed", type: "number", value: 1, multiplier: 10, values: { label: "edit.speed", min: -1000, max: 1000, decimals: 1, showSlider: true, sliderValues: { min: 0, max: 200, step: 1 } } },
            { id: "pulseSpeed", type: "number", value: 1, values: { label: "effect.pulse_speed", max: 500, showSlider: true, sliderValues: { max: 100 } } }
            // { name: "maxSizeVariation", id: "maxSizeVariation", input: "number", slider: true, value: 5, values: { min: 0, max: 1000 } },
            // color range omitted here; could be added as a custom UI
        ])
    },

    grass: {
        inputs: splitIntoRows([
            { id: "count", type: "number", value: 150, values: { label: "edit.count", max: 1000, step: 10, showSlider: true, sliderValues: { max: 500, step: 5 } } },
            { id: "height", type: "number", value: 60, values: { label: "edit.height", min: 10, max: 200, showSlider: true, sliderValues: { min: 20, max: 120 } } },
            { id: "width", type: "number", value: 2, values: { label: "edit.width", min: 1, max: 10, showSlider: true, sliderValues: { max: 6 } } },
            { id: "speed", type: "number", value: 1, multiplier: 10, values: { label: "edit.speed", min: 0, max: 50, decimals: 1, showSlider: true, sliderValues: { min: 0, max: 30 } } },
            { id: "color", type: "color", value: "#4a7c59", values: { label: "edit.color", allowOpacity: true } }
        ])
    },

    wave: {
        inputs: splitIntoRows([
            { id: "amplitude", type: "number", value: 10, values: { label: "edit.height", max: 500, step: 10, showSlider: true, sliderValues: { max: 200, step: 2 } } },
            { id: "wavelength", type: "number", value: 200, values: { label: "edit.length", min: 1, max: 10000, step: 100, showSlider: true, sliderValues: { max: 1000, step: 10 } } },
            { id: "speed", type: "number", value: 1, multiplier: 10, values: { label: "edit.speed", min: -1000, max: 1000, decimals: 1, showSlider: true, sliderValues: { min: 0, max: 50, step: 1 } } },
            // { name: "offset", id: "offset", input: "number", slider: true, value: 0.15, values: { min: 0, max: 1, step: 0.01, decimals: 10, inputMultiplier: 100 } },
            { id: "color", type: "color", value: "rgba(80, 140, 200, 0.4)", values: { label: "edit.color", allowOpacity: true } },

            {
                id: "side",
                type: "dropdown",
                value: "bottom",
                values: {
                    label: "edit.side",
                    options: [
                        { value: "bottom", label: "screen.bottom" },
                        { value: "top", label: "screen.top" },
                        { value: "left", label: "screen.left" },
                        { value: "right", label: "screen.right" }
                    ]
                }
            }
        ])
    },

    sun: {
        inputs: splitIntoRows([
            { id: "radius", type: "number", value: 60, values: { label: "edit.size", min: 1, max: 1000, showSlider: true, sliderValues: { max: 200 } } },
            // { name: "rayCount", id: "rayCount", input: "number", slider: true, value: 12, values: { min: 1, max: 100 } },
            // { name: "rayLength", id: "rayLength", input: "number", slider: true, value: 150, values: { min: 1, max: 1000 } },
            // { name: "rayWidth", id: "rayWidth", input: "number", slider: true, value: 5, values: { min: 1, max: 100 } },
            { id: "speed", type: "number", value: 0, multiplier: 10, values: { label: "edit.speed", min: -100, max: 100, decimals: 1, showSlider: true, sliderValues: { min: 0, max: 50, step: 1 } } },
            { id: "color", type: "color", value: "rgba(255, 223, 120, 0.8)", values: { label: "edit.color", allowOpacity: true } }
        ])
    },

    lens_flare: {
        inputs: splitIntoRows([
            { id: "flareDiscNum", type: "number", value: 8, values: { label: "edit.count", min: 2, max: 100, showSlider: true, sliderValues: { max: 20 } } },
            { id: "size", type: "number", value: 100, values: { label: "edit.size", min: 1, max: 1000, step: 100, showSlider: true, sliderValues: { max: 200, step: 10 } } }
        ])
    },

    lightning: {
        inputs: splitIntoRows([
            { id: "frequency", type: "number", value: 0.2, multiplier: 10, values: { label: "edit.speed", min: 1, max: 50, decimals: 1, showSlider: true, sliderValues: { max: 20 } } },
            { id: "color", type: "color", value: "#ffffff", values: { label: "edit.color", allowOpacity: true } }
        ])
    },

    spotlight: {
        inputs: splitIntoRows([
            { id: "length", type: "number", value: 2000, multiplier: 0.01, values: { label: "edit.length", max: 40, showSlider: true, sliderValues: { max: 20 } } },
            { id: "baseWidth", type: "number", value: 1000, multiplier: 0.01, values: { label: "edit.width", max: 100, showSlider: true, sliderValues: { max: 50 } } },
            { id: "swayAmplitude", type: "number", value: 0, multiplier: 10, values: { label: "edit.rotation", max: 100, decimals: 1, showSlider: true, sliderValues: { max: 20 } } },
            { id: "swaySpeed", type: "number", value: 0, multiplier: 10, values: { label: "edit.speed", max: 50, decimals: 1, showSlider: true, sliderValues: { max: 20 } } },
            { id: "color", type: "color", value: "rgba(234, 140, 255, 0.6)", values: { label: "edit.color" } }
        ])
    },

    aurora: {
        inputs: splitIntoRows([
            { id: "bandCount", type: "number", value: 5, values: { label: "edit.count", min: 1, max: 20, showSlider: true, sliderValues: { max: 10 } } },
            { id: "amplitude", type: "number", value: 50, values: { label: "edit.height", min: 1, max: 500, step: 10, showSlider: true, sliderValues: { max: 200 } } },
            { id: "wavelength", type: "number", value: 500, values: { label: "edit.length", max: 2000, step: 100, showSlider: true, sliderValues: { max: 1000, step: 10 } } },
            { id: "speed", type: "number", value: 1, multiplier: 10, values: { label: "edit.speed", min: -1000, max: 1000, decimals: 1, showSlider: true, sliderValues: { min: 0, max: 100 } } }
            // { name: "opacity", id: "opacity", input: "number", slider: true, value: 0.8, values: { min: 0, max: 1 } },
            // { name: "offset", id: "offset", input: "number", slider: true, value: 0, values: { min: 0, max: 1000 } }
            // colorStops is an array, might need custom UI, omitted here
        ])
    },

    bloom: {
        inputs: splitIntoRows([
            { id: "blobCount", type: "number", value: 5, values: { label: "edit.count", min: 1, max: 100, showSlider: true } },
            { id: "blurAmount", type: "number", value: 10, values: { label: "edit.blur", min: 0, max: 100, showSlider: true, sliderValues: { min: 10, max: 60 } } },
            { id: "speed", type: "number", value: 1, values: { label: "edit.speed", max: 100, showSlider: true, sliderValues: { max: 50 } } }
        ])
    },

    fog: {
        inputs: splitIntoRows([
            { id: "count", type: "number", value: 20, values: { label: "edit.count", min: 1, max: 200, showSlider: true, sliderValues: { max: 80 } } },
            { id: "size", type: "number", value: 100, values: { label: "edit.size", min: 1, max: 500, showSlider: true, sliderValues: { max: 200 } } },
            { id: "speed", type: "number", value: 2, values: { label: "edit.speed", min: -100, max: 100, showSlider: true, sliderValues: { min: 0, max: 50 } } },
            // { name: "opacity", id: "opacity", input: "number", slider: true, value: 0.1, values: { min: 0, max: 1 } },
            { id: "blur", type: "number", value: 50, values: { label: "edit.blur", min: 0, max: 100, showSlider: true, sliderValues: { max: 50 } } },
            { id: "spread", type: "number", value: 200, values: { label: "edit.height", min: 1, max: 1000, showSlider: true, sliderValues: { max: 400 } } },
            // { name: "offset", id: "offset", input: "number", slider: true, value: 0, values: { min: 0, max: 1000 } }
            { id: "color", type: "color", value: "rgba(255, 255, 255, 0.2)", values: { label: "edit.color", allowOpacity: true } }
        ])
    },

    city: {
        inputs: splitIntoRows([
            { id: "count", type: "number", value: 50, values: { label: "edit.count", min: 1, max: 200, showSlider: true, sliderValues: { max: 100 } } },

            { id: "height", type: "number", value: 200, values: { label: "edit.height", min: 10, max: 2000, step: 10, showSlider: true, sliderValues: { max: 400 } } },
            { id: "width", type: "number", value: 40, values: { label: "edit.width", min: 10, max: 2000, step: 10, showSlider: true, sliderValues: { max: 80 } } },

            // { name: "minWidth", id: "minWidth", input: "number", slider: true, value: 20, values: { min: 1, max: 500 } },
            // { name: "maxWidth", id: "maxWidth", input: "number", slider: true, value: 50, values: { min: 1, max: 1000 } },
            // { name: "minHeight", id: "minHeight", input: "number", slider: true, value: 100, values: { min: 1, max: 2000 } },
            // { name: "maxHeight", id: "maxHeight", input: "number", slider: true, value: 300, values: { min: 1, max: 3000 } },

            // { name: "night", id: "night", input: "checkbox", value: false },
            { id: "flickerSpeed", type: "number", value: 1, multiplier: 10, values: { label: "edit.speed", min: 0, max: 500, showSlider: true, sliderValues: { max: 100 } } },
            { id: "color", type: "color", value: "#222222", values: { label: "edit.color", allowOpacity: true } }
        ])
    },

    fireworks: {
        inputs: splitIntoRows([
            { id: "count", type: "number", value: 50, values: { label: "edit.count", min: 1, max: 200, showSlider: true, sliderValues: { max: 100 } } },
            { id: "size", type: "number", value: 1, multiplier: 10, values: { label: "edit.size", min: 1, max: 200, decimals: 1, showSlider: true, sliderValues: { max: 50 } } },
            { id: "speed", type: "number", value: 1, multiplier: 10, values: { label: "edit.speed", min: 1, max: 100, decimals: 1, showSlider: true, sliderValues: { max: 30 } } }
        ])
    },

    circle: {
        inputs: splitIntoRows([
            { id: "radius", type: "number", value: 200, values: { label: "edit.size", min: 1, max: 2000, showSlider: true, sliderValues: { max: 1000 } } },
            { id: "hollow", type: "checkbox", value: false, values: { label: "effect.hollow" } },
            { id: "thickness", type: "number", value: 10, values: { label: "edit.width", min: 1, max: 1000, showSlider: true, sliderValues: { max: 100 } } },
            { id: "speed", type: "number", value: 0, multiplier: 10, values: { label: "edit.speed", min: -10, max: 10, decimals: 1, showSlider: true, sliderValues: { min: 0 } } },
            { id: "gap", type: "number", value: 2, multiplier: 180, values: { label: "edit.angle", min: 0, max: 360, step: 18, decimals: 2, showSlider: true, sliderValues: { step: 0.01 } } },
            { id: "shadow", type: "number", value: 0, values: { label: "draw.glow", min: 0, max: 500, showSlider: true, sliderValues: { max: 100 } } },
            { id: "color", type: "color", value: "#00ddff", values: { label: "edit.color", allowGradients: true, allowOpacity: true } }
        ])
    },
    rectangle: {
        inputs: splitIntoRows([
            { id: "width", type: "number", value: 200, values: { label: "edit.width", min: 1, max: 2000, showSlider: true, sliderValues: { max: 1000 } } },
            { id: "height", type: "number", value: 200, values: { label: "edit.height", min: 1, max: 2000, showSlider: true, sliderValues: { max: 1000 } } },
            { id: "hollow", type: "checkbox", value: false, values: { label: "effect.hollow" } },
            { id: "thickness", type: "number", value: 10, values: { label: "edit.width", min: 1, max: 1000, showSlider: true, sliderValues: { max: 100 } } },
            { id: "speed", type: "number", value: 0, multiplier: 10, values: { label: "edit.speed", min: -10, max: 10, decimals: 1, showSlider: true, sliderValues: { min: 0 } } },
            { id: "shadow", type: "number", value: 0, values: { label: "draw.glow", min: 0, max: 500, showSlider: true, sliderValues: { max: 100 } } },
            { id: "color", type: "color", value: "#00ddff", values: { label: "edit.color", allowGradients: true, allowOpacity: true } }
        ])
    },
    triangle: {
        inputs: splitIntoRows([
            { id: "size", type: "number", value: 200, values: { label: "edit.size", min: 1, max: 2000, showSlider: true, sliderValues: { max: 1000 } } },
            { id: "hollow", type: "checkbox", value: false, values: { label: "effect.hollow" } },
            { id: "thickness", type: "number", value: 10, values: { label: "edit.width", min: 1, max: 1000, showSlider: true, sliderValues: { max: 100 } } },
            { id: "speed", type: "number", value: 0, multiplier: 10, values: { label: "edit.speed", min: -10, max: 10, decimals: 1, showSlider: true, sliderValues: { min: 0 } } },
            { id: "shadow", type: "number", value: 0, values: { label: "draw.glow", min: 0, max: 500, showSlider: true, sliderValues: { max: 100 } } },
            { id: "color", type: "color", value: "#00ddff", values: { label: "edit.color", allowGradients: true, allowOpacity: true } }
        ])
    },

    asset: {
        inputs: splitIntoRows([{ id: "size", type: "number", value: 1, multiplier: 10, values: { label: "edit.size", max: 100, decimals: 1, showSlider: true, sliderValues: { min: 0, max: 20 } } }])
    },

    rays: {
        inputs: splitIntoRows([
            { id: "numRays", type: "number", value: 8, values: { label: "edit.count", min: 1, max: 100, showSlider: true, sliderValues: { max: 20 } } },
            { id: "speed", type: "number", value: 1, multiplier: 10, values: { label: "edit.speed", min: -500, max: 500, decimals: 1, showSlider: true, sliderValues: { min: 0, max: 200 } } },
            { id: "color_1", type: "color", value: "#000", values: { label: "edit.color", allowOpacity: true } },
            { id: "color_2", type: "color", value: "#FFF", values: { label: "edit.color", allowOpacity: true } }
        ])
    },

    cycle: {
        inputs: splitIntoRows([
            { id: "speed", type: "number", value: 1, multiplier: 10, values: { label: "edit.speed", min: -500, max: 500, decimals: 1, showSlider: true, sliderValues: { min: 0, max: 200 } } }
            // phases!!!!
        ])
    }

    // smoke: [
    //     { name: "count", id: "count", input: "number", slider: true, value: 10, values: { min: 1, max: 1000 } },
    //     { name: "size", id: "size", input: "number", slider: true, value: 50, values: { min: 1, max: 1000 } },
    //     { name: "speed", id: "speed", input: "number", slider: true, value: 1, values: { min: -100, max: 100 } },
    //     { name: "opacity", id: "opacity", input: "number", slider: true, value: 0.5, values: { min: 0, max: 1 } },
    //     { name: "color", id: "color", input: "color", value: "#999999" }
    // ]
}
