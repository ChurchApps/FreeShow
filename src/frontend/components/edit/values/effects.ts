export const effectEdits = {
    stars: [
        { name: "count", id: "count", input: "number", slider: true, value: 1000, values: { max: 10000, step: 100 }, sliderValues: { step: 10, max: 2000 } },
        { name: "size", id: "size", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0, max: 2 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 1, values: { max: 100, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0, max: 4 } }
    ],
    galaxy: [
        { name: "count", id: "count", input: "number", slider: true, value: 2000, values: { max: 10000, step: 100 }, sliderValues: { step: 10, max: 4000 } },
        { name: "size", id: "size", input: "number", slider: true, value: 1.5, values: { min: 1, max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0, max: 3 } },
        { name: "effect.swirl_strength", id: "swirlStrength", input: "number", slider: true, value: 0.5, values: { min: 0, max: 1, step: 0.1, decimals: 2, inputMultiplier: 100 }, sliderValues: { step: 0.01 } },
        { name: "speed", id: "rotationSpeed", input: "number", slider: true, value: 1, values: { min: -1000, max: 1000, step: 10 }, sliderValues: { min: 0, max: 100, step: 1 } },
        { name: "effect.arm_count", id: "armCount", input: "number", slider: true, value: 5, values: { min: 1, max: 20 }, sliderValues: { min: 2, max: 8 } }
        // { name: "nebula", id: "nebula", input: "checkbox", value: true }
    ],

    rain: [
        { name: "count", id: "count", input: "number", slider: true, value: 500, values: { max: 10000, step: 100 }, sliderValues: { max: 1000, step: 10 } },
        { name: "length", id: "length", input: "number", slider: true, value: 10, values: { min: 1, max: 1000 }, sliderValues: { max: 100 } },
        { name: "width", id: "width", input: "number", slider: true, value: 1, values: { min: 1, max: 10 }, sliderValues: { max: 5 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 10, values: { min: -100, max: 100 }, sliderValues: { min: 0, max: 20 } },
        { name: "color", id: "color", input: "color", value: "rgba(135,206,250,0.6)" }
    ],
    snow: [
        { name: "count", id: "count", input: "number", slider: true, value: 300, values: { max: 10000, step: 100 }, sliderValues: { max: 1000, step: 10 } },
        { name: "size", id: "size", input: "number", slider: true, value: 2, values: { min: 1, max: 50 }, sliderValues: { max: 10 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 1, values: { min: -100, max: 100 }, sliderValues: { min: 0, max: 20 } },
        { name: "effect.drift", id: "drift", input: "number", slider: true, value: 2, values: { max: 100 }, sliderValues: { max: 10 } },
        { name: "color", id: "color", input: "color", value: "#ffffff" }
    ],

    bubbles: [
        { name: "count", id: "count", input: "number", slider: true, value: 100, values: { max: 1000, step: 50 }, sliderValues: { max: 200, step: 10 } },
        { name: "size", id: "size", input: "number", slider: true, value: 20, values: { min: 1, max: 500, step: 10 }, sliderValues: { max: 100, step: 1 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 1, values: { min: -100, max: 100, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0, max: 20, step: 0.1 } },
        { name: "effect.pulse_speed", id: "pulseSpeed", input: "number", slider: true, value: 1, values: { max: 500 }, sliderValues: { max: 100 } }
        // { name: "maxSizeVariation", id: "maxSizeVariation", input: "number", slider: true, value: 5, values: { min: 0, max: 1000 } },
        // color range omitted here; could be added as a custom UI
    ],

    wave: [
        { name: "height", id: "amplitude", input: "number", slider: true, value: 10, values: { max: 500, step: 10 }, sliderValues: { max: 200, step: 2 } },
        { name: "length", id: "wavelength", input: "number", slider: true, value: 200, values: { min: 1, max: 10000, step: 100 }, sliderValues: { max: 1000, step: 10 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 1, values: { min: -100, max: 100, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0, max: 5, step: 0.1 } },
        // { name: "offset", id: "offset", input: "number", slider: true, value: 0.15, values: { min: 0, max: 1, step: 0.01, decimals: 10, inputMultiplier: 100 } },
        { name: "color", id: "color", input: "color", value: "rgba(80, 140, 200, 0.4)" },

        {
            name: "side",
            id: "side",
            input: "dropdown",
            value: "bottom",
            values: {
                options: [
                    { id: "bottom", name: "$:screen.bottom:$" },
                    { id: "top", name: "$:screen.top:$" },
                    { id: "left", name: "$:screen.left:$" },
                    { id: "right", name: "$:screen.right:$" }
                ]
            }
        }
    ],

    sun: [
        { name: "size", id: "radius", input: "number", slider: true, value: 60, values: { min: 1, max: 1000 }, sliderValues: { max: 200 } },
        // { name: "rayCount", id: "rayCount", input: "number", slider: true, value: 12, values: { min: 1, max: 100 } },
        // { name: "rayLength", id: "rayLength", input: "number", slider: true, value: 150, values: { min: 1, max: 1000 } },
        // { name: "rayWidth", id: "rayWidth", input: "number", slider: true, value: 5, values: { min: 1, max: 100 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 0, values: { min: -10, max: 10, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0, max: 5, step: 0.1 } },
        { name: "color", id: "color", input: "color", value: "rgba(255, 223, 120, 0.8)" }
    ],

    lens_flare: [
        { name: "count", id: "flareDiscNum", input: "number", slider: true, value: 8, values: { min: 2, max: 100 }, sliderValues: { max: 20 } },
        { name: "size", id: "size", input: "number", slider: true, value: 100, values: { min: 1, max: 1000, step: 100 }, sliderValues: { max: 200, step: 10 } }
    ],

    spotlight: [
        { name: "length", id: "length", input: "number", slider: true, value: 2000, values: { max: 4000, inputMultiplier: 0.01, step: 100 }, sliderValues: { max: 2000 } },
        { name: "width", id: "baseWidth", input: "number", slider: true, value: 1000, values: { max: 10000, inputMultiplier: 0.01, step: 100 }, sliderValues: { max: 5000 } },
        { name: "rotation", id: "swayAmplitude", input: "number", slider: true, value: 0, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { max: 2 } },
        { name: "speed", id: "swaySpeed", input: "number", slider: true, value: 0, values: { max: 5, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { max: 2 } },
        { name: "color", id: "color", input: "color", value: "rgba(234, 140, 255, 0.6)" }
    ],

    aurora: [
        { name: "count", id: "bandCount", input: "number", slider: true, value: 5, values: { min: 1, max: 20 }, sliderValues: { max: 10 } },
        { name: "height", id: "amplitude", input: "number", slider: true, value: 50, values: { min: 1, max: 500, step: 10 }, sliderValues: { max: 200 } },
        { name: "length", id: "wavelength", input: "number", slider: true, value: 500, values: { max: 2000, step: 100 }, sliderValues: { max: 1000, step: 10 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 1, values: { min: -100, max: 100, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0, step: 0.1, max: 10 } }
        // { name: "opacity", id: "opacity", input: "number", slider: true, value: 0.8, values: { min: 0, max: 1 } },
        // { name: "offset", id: "offset", input: "number", slider: true, value: 0, values: { min: 0, max: 1000 } }
        // colorStops is an array, might need custom UI, omitted here
    ],

    bloom: [
        { name: "count", id: "blobCount", input: "number", slider: true, value: 5, values: { min: 1, max: 100 } },
        { name: "blur", id: "blurAmount", input: "number", slider: true, value: 10, values: { min: 0, max: 100 }, sliderValues: { min: 10, max: 60 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 1, values: { max: 100 }, sliderValues: { max: 50 } }
    ],

    fog: [
        { name: "count", id: "count", input: "number", slider: true, value: 20, values: { min: 1, max: 200 }, sliderValues: { max: 80 } },
        { name: "size", id: "size", input: "number", slider: true, value: 100, values: { min: 1, max: 500 }, sliderValues: { max: 200 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 2, values: { min: -100, max: 100 }, sliderValues: { min: 0, max: 50 } },
        // { name: "opacity", id: "opacity", input: "number", slider: true, value: 0.1, values: { min: 0, max: 1 } },
        { name: "blur", id: "blur", input: "number", slider: true, value: 50, values: { min: 0, max: 100 }, sliderValues: { max: 50 } },
        { name: "height", id: "spread", input: "number", slider: true, value: 200, values: { min: 1, max: 1000 }, sliderValues: { max: 400 } },
        // { name: "offset", id: "offset", input: "number", slider: true, value: 0, values: { min: 0, max: 1000 } }
        { name: "color", id: "color", input: "color", value: "rgba(255, 255, 255, 0.2)" }
    ],

    city: [
        { name: "count", id: "count", input: "number", slider: true, value: 50, values: { min: 1, max: 200 }, sliderValues: { max: 100 } },

        { name: "height", id: "height", input: "number", slider: true, value: 200, values: { min: 10, max: 2000, step: 10 }, sliderValues: { max: 400 } },
        { name: "width", id: "width", input: "number", slider: true, value: 40, values: { min: 10, max: 2000, step: 10 }, sliderValues: { max: 80 } },

        // { name: "minWidth", id: "minWidth", input: "number", slider: true, value: 20, values: { min: 1, max: 500 } },
        // { name: "maxWidth", id: "maxWidth", input: "number", slider: true, value: 50, values: { min: 1, max: 1000 } },
        // { name: "minHeight", id: "minHeight", input: "number", slider: true, value: 100, values: { min: 1, max: 2000 } },
        // { name: "maxHeight", id: "maxHeight", input: "number", slider: true, value: 300, values: { min: 1, max: 3000 } },

        // { name: "night", id: "night", input: "checkbox", value: false },
        { name: "speed", id: "flickerSpeed", input: "number", slider: true, value: 1, values: { min: 0, max: 50, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { max: 10 } },
        { name: "color", id: "color", input: "color", value: "#222222" }
    ],

    fireworks: [
        { name: "count", id: "count", input: "number", slider: true, value: 50, values: { min: 1, max: 200 }, sliderValues: { max: 100 } },
        { name: "size", id: "size", input: "number", slider: true, value: 1, values: { min: 0.1, max: 20, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { max: 5 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 1, values: { min: 0.1, max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { max: 3 } }
    ],

    circle: [
        { name: "size", id: "radius", input: "number", slider: true, value: 200, values: { min: 1, max: 2000 }, sliderValues: { max: 1000 } },
        { name: "effect.hollow", id: "hollow", input: "checkbox", value: false },
        { name: "width", id: "thickness", input: "number", slider: true, value: 10, values: { min: 1, max: 1000 }, sliderValues: { max: 100 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 0, values: { min: -1, max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0 } },
        { name: "angle", id: "gap", input: "number", slider: true, value: 2, values: { min: 0, max: 2, step: 0.1, decimals: 2, inputMultiplier: 180 }, sliderValues: { step: 0.01 } },
        { name: "shadow", id: "shadow", input: "number", slider: true, value: 0, values: { min: 0, max: 500 }, sliderValues: { max: 100 } },
        { name: "color", id: "color", input: "color", value: "#00ddff", values: { allowGradients: true } }
    ],
    rectangle: [
        { name: "width", id: "width", input: "number", slider: true, value: 200, values: { min: 1, max: 2000 }, sliderValues: { max: 1000 } },
        { name: "height", id: "height", input: "number", slider: true, value: 200, values: { min: 1, max: 2000 }, sliderValues: { max: 1000 } },
        { name: "effect.hollow", id: "hollow", input: "checkbox", value: false },
        { name: "width", id: "thickness", input: "number", slider: true, value: 10, values: { min: 1, max: 1000 }, sliderValues: { max: 100 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 0, values: { min: -1, max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0 } },
        { name: "shadow", id: "shadow", input: "number", slider: true, value: 0, values: { min: 0, max: 500 }, sliderValues: { max: 100 } },
        { name: "color", id: "color", input: "color", value: "#00ddff", values: { allowGradients: true } }
    ],
    triangle: [
        { name: "size", id: "size", input: "number", slider: true, value: 200, values: { min: 1, max: 2000 }, sliderValues: { max: 1000 } },
        { name: "effect.hollow", id: "hollow", input: "checkbox", value: false },
        { name: "width", id: "thickness", input: "number", slider: true, value: 10, values: { min: 1, max: 1000 }, sliderValues: { max: 100 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 0, values: { min: -1, max: 1, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0 } },
        { name: "shadow", id: "shadow", input: "number", slider: true, value: 0, values: { min: 0, max: 500 }, sliderValues: { max: 100 } },
        { name: "color", id: "color", input: "color", value: "#00ddff", values: { allowGradients: true } }
    ],

    rays: [
        { name: "count", id: "numRays", input: "number", slider: true, value: 8, values: { min: 1, max: 100 }, sliderValues: { max: 20 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 1, values: { min: -50, max: 50, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0, max: 20 } },
        { name: "color", id: "color_1", input: "color", value: "#000" },
        { name: "color", id: "color_2", input: "color", value: "#FFF" }
    ],

    cycle: [
        { name: "speed", id: "speed", input: "number", slider: true, value: 1, values: { min: -50, max: 50, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0, max: 20 } }
        // phases!!!!
    ]

    // smoke: [
    //     { name: "count", id: "count", input: "number", slider: true, value: 10, values: { min: 1, max: 1000 } },
    //     { name: "size", id: "size", input: "number", slider: true, value: 50, values: { min: 1, max: 1000 } },
    //     { name: "speed", id: "speed", input: "number", slider: true, value: 1, values: { min: -100, max: 100 } },
    //     { name: "opacity", id: "opacity", input: "number", slider: true, value: 0.5, values: { min: 0, max: 1 } },
    //     { name: "color", id: "color", input: "color", value: "#999999" }
    // ]
}
