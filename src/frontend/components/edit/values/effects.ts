export const effectEdits = {
    stars: [
        { name: "count", id: "count", input: "number", slider: true, value: 1, values: { max: 10000, step: 100 }, sliderValues: { step: 10, max: 2000 } },
        { name: "size", id: "size", input: "number", slider: true, value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0, max: 2 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 1, values: { max: 100, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0, max: 2 } }
    ],

    shape: [
        // {
        //     name: "shape",
        //     id: "shape",
        //     input: "dropdown",
        //     value: "circle",
        //     values: {
        //         options: [
        //             { id: "circle", name: "Circle" },
        //             { id: "rectangle", name: "Rectangle" },
        //             { id: "triangle", name: "Triangle" }
        //         ]
        //     }
        // },
        { name: "x", id: "x", input: "number", slider: true, value: 0.5, values: { min: 0, max: 1, step: 0.01, decimals: 10, inputMultiplier: 100 } },
        { name: "y", id: "y", input: "number", slider: true, value: 0.5, values: { min: 0, max: 1, step: 0.01, decimals: 10, inputMultiplier: 100 } },
        { name: "size", id: "size", input: "number", value: 50, values: { min: 1, max: 1000 } },
        { name: "rotationSpeed", id: "rotationSpeed", input: "number", value: 0, values: { min: -360, max: 360 } },
        { name: "color", id: "color", input: "color", value: "#ffffff" }
    ],

    wave: [
        { name: "amplitude", id: "amplitude", input: "number", value: 10, values: { min: 0, max: 500 } },
        { name: "wavelength", id: "wavelength", input: "number", value: 100, values: { min: 1, max: 1000 } },
        { name: "speed", id: "speed", input: "number", slider: true, value: 1, values: { min: -100, max: 100, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0, max: 2 } },
        { name: "offset", id: "offset", input: "number", slider: true, value: 0.2, values: { min: 0, max: 1, step: 0.01, decimals: 10, inputMultiplier: 100 } },
        { name: "color", id: "color", input: "color", value: "#00aaff" }
        // side and phase omitted for simplicity or handled elsewhere
    ],

    bubbles: [
        { name: "count", id: "count", input: "number", value: 10, values: { min: 1, max: 1000 } },
        { name: "size", id: "size", input: "number", value: 10, values: { min: 1, max: 1000 } },
        { name: "maxSizeVariation", id: "maxSizeVariation", input: "number", value: 5, values: { min: 0, max: 1000 } },
        { name: "pulseSpeed", id: "pulseSpeed", input: "number", value: 0, values: { min: 0, max: 100 } },
        { name: "speed", id: "speed", input: "number", value: 1, values: { min: -1000, max: 1000 } }
        // color range omitted here; could be added as a custom UI
    ],

    galaxy: [
        { name: "count", id: "count", input: "number", value: 1000, values: { min: 1, max: 10000 } },
        { name: "size", id: "size", input: "number", value: 1, values: { min: 1, max: 1000 } },
        { name: "swirlStrength", id: "swirlStrength", input: "number", value: 10, values: { min: 0, max: 100 } },
        { name: "rotationSpeed", id: "rotationSpeed", input: "number", value: 1, values: { min: -360, max: 360 } },
        { name: "armCount", id: "armCount", input: "number", value: 3, values: { min: 1, max: 10 } },
        { name: "nebula", id: "nebula", input: "checkbox", value: false }
        // colors (array of strings) require custom input UI, omitted here
    ],

    rain: [
        { name: "count", id: "count", input: "number", value: 100, values: { min: 1, max: 10000 } },
        { name: "speed", id: "speed", input: "number", value: 5, values: { min: 0, max: 100 } },
        { name: "length", id: "length", input: "number", value: 10, values: { min: 1, max: 100 } },
        { name: "width", id: "width", input: "number", value: 1, values: { min: 1, max: 10 } },
        { name: "color", id: "color", input: "color", value: "#0000ff" }
    ],

    snow: [
        { name: "count", id: "count", input: "number", value: 200, values: { min: 1, max: 10000 } },
        { name: "size", id: "size", input: "number", value: 5, values: { min: 1, max: 100 } },
        { name: "speed", id: "speed", input: "number", value: 2, values: { min: 0, max: 100 } },
        { name: "drift", id: "drift", input: "number", value: 1, values: { min: 0, max: 100 } },
        { name: "color", id: "color", input: "color", value: "#ffffff" }
    ],

    neon: [
        { name: "radius", id: "radius", input: "number", value: 50, values: { min: 1, max: 500 } },
        { name: "thickness", id: "thickness", input: "number", value: 10, values: { min: 1, max: 100 } },
        { name: "speed", id: "speed", input: "number", value: 1, values: { min: -100, max: 100 } },
        { name: "angle", id: "angle", input: "number", value: 0, values: { min: 0, max: 360 } },
        { name: "color", id: "color", input: "color", value: "#00ff00" }
    ],

    sun: [
        { name: "x", id: "x", input: "number", value: 960, values: { min: 0, max: 1920 } },
        { name: "y", id: "y", input: "number", value: 540, values: { min: 0, max: 1080 } },
        { name: "radius", id: "radius", input: "number", value: 100, values: { min: 1, max: 1000 } },
        { name: "rayCount", id: "rayCount", input: "number", value: 12, values: { min: 1, max: 100 } },
        { name: "rayLength", id: "rayLength", input: "number", value: 150, values: { min: 1, max: 1000 } },
        { name: "rayWidth", id: "rayWidth", input: "number", value: 5, values: { min: 1, max: 100 } },
        { name: "color", id: "color", input: "color", value: "#ffaa00" }
    ],

    lensFlare: [{ name: "radius", id: "radius", input: "number", value: 100, values: { min: 1, max: 1000 } }],

    spotlight: [
        { name: "x", id: "x", input: "number", value: 960, values: { min: 0, max: 1920 } },
        { name: "y", id: "y", input: "number", value: 540, values: { min: 0, max: 1080 } },
        { name: "length", id: "length", input: "number", value: 300, values: { min: 1, max: 1000 } },
        { name: "baseWidth", id: "baseWidth", input: "number", value: 150, values: { min: 1, max: 1000 } },
        { name: "swayAmplitude", id: "swayAmplitude", input: "number", value: 50, values: { min: 0, max: 500 } },
        { name: "swaySpeed", id: "swaySpeed", input: "number", value: 1, values: { min: 0, max: 100 } },
        { name: "angle", id: "angle", input: "number", value: 0, values: { min: 0, max: 360 } },
        { name: "color", id: "color", input: "color", value: "#ffffff" }
    ],

    aurora: [
        { name: "bandCount", id: "bandCount", input: "number", value: 5, values: { min: 1, max: 20 } },
        { name: "amplitude", id: "amplitude", input: "number", value: 50, values: { min: 1, max: 500 } },
        { name: "wavelength", id: "wavelength", input: "number", value: 200, values: { min: 1, max: 1000 } },
        { name: "speed", id: "speed", input: "number", value: 1, values: { min: -100, max: 100 } },
        { name: "opacity", id: "opacity", input: "number", value: 0.8, values: { min: 0, max: 1 } },
        { name: "offset", id: "offset", input: "number", value: 0, values: { min: 0, max: 1000 } }
        // colorStops is an array, might need custom UI, omitted here
    ],

    bloom: [
        { name: "blobCount", id: "blobCount", input: "number", value: 5, values: { min: 1, max: 100 } },
        { name: "blurAmount", id: "blurAmount", input: "number", value: 10, values: { min: 0, max: 100 } },
        { name: "speed", id: "speed", input: "number", value: 1, values: { min: -100, max: 100 } }
    ],

    fog: [
        { name: "count", id: "count", input: "number", value: 20, values: { min: 1, max: 1000 } },
        { name: "size", id: "size", input: "number", value: 100, values: { min: 1, max: 1000 } },
        { name: "speed", id: "speed", input: "number", value: 1, values: { min: -100, max: 100 } },
        { name: "opacity", id: "opacity", input: "number", value: 0.1, values: { min: 0, max: 1 } },
        { name: "blur", id: "blur", input: "number", value: 50, values: { min: 0, max: 200 } },
        { name: "spread", id: "spread", input: "number", value: 50, values: { min: 0, max: 100 } },
        { name: "offset", id: "offset", input: "number", value: 0, values: { min: 0, max: 1000 } }
    ],

    city: [
        { name: "buildingCount", id: "buildingCount", input: "number", value: 50, values: { min: 1, max: 1000 } },
        { name: "minWidth", id: "minWidth", input: "number", value: 20, values: { min: 1, max: 500 } },
        { name: "maxWidth", id: "maxWidth", input: "number", value: 50, values: { min: 1, max: 1000 } },
        { name: "minHeight", id: "minHeight", input: "number", value: 100, values: { min: 1, max: 2000 } },
        { name: "maxHeight", id: "maxHeight", input: "number", value: 300, values: { min: 1, max: 3000 } },
        { name: "night", id: "night", input: "checkbox", value: false },
        { name: "flickerSpeed", id: "flickerSpeed", input: "number", value: 0.05, values: { min: 0, max: 1 } },
        { name: "color", id: "color", input: "color", value: "#666666" }
    ],

    rays: [
        { name: "speed", id: "speed", input: "number", slider: true, value: 1, values: { max: 100, step: 0.1, decimals: 1, inputMultiplier: 10 }, sliderValues: { min: 0, max: 2 } },
        { name: "color", id: "color_1", input: "color", value: "#001f3f" },
        { name: "color", id: "color_2", input: "color", value: "#FFDC00" },
        { name: "numRays", id: "numRays", input: "number", slider: true, value: 20, values: { max: 100 } }
    ],

    ///////////

    smoke: [
        { name: "count", id: "count", input: "number", value: 10, values: { min: 1, max: 1000 } },
        { name: "size", id: "size", input: "number", value: 50, values: { min: 1, max: 1000 } },
        { name: "speed", id: "speed", input: "number", value: 1, values: { min: -100, max: 100 } },
        { name: "opacity", id: "opacity", input: "number", value: 0.5, values: { min: 0, max: 1 } },
        { name: "color", id: "color", input: "color", value: "#999999" }
    ],

    stars2: [
        { name: "count", id: "count", input: "number", value: 200, values: { min: 1, max: 10000 } },
        { name: "size", id: "size", input: "number", value: 3, values: { min: 1, max: 100 } },
        { name: "speed", id: "speed", input: "number", value: 1, values: { min: -100, max: 100 } },
        { name: "twinkle", id: "twinkle", input: "checkbox", value: true }
    ],

    prism: [
        {
            name: "shape",
            id: "shape",
            input: "dropdown",
            value: "triangle",
            values: {
                options: [
                    { id: "triangle", name: "Triangle" },
                    { id: "square", name: "Square" },
                    { id: "pentagon", name: "Pentagon" }
                ]
            }
        },
        { name: "size", id: "size", input: "number", value: 100, values: { min: 1, max: 1000 } },
        { name: "rotationSpeed", id: "rotationSpeed", input: "number", value: 0, values: { min: -360, max: 360 } },
        { name: "color", id: "color", input: "color", value: "#ff00ff" }
    ]
}
