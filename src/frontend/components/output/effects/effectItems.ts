// effectTypes
export const effectItems = {
    stars: { name: "", default: { count: 1000, size: 1, speed: 2 } },
    galaxy: { name: "", default: { count: 2000, size: 1.5, swirlStrength: 0.5, rotationSpeed: 10, armCount: 5 } },
    rain: { name: "", default: { count: 300, speed: 10, length: 10, width: 1, color: "rgba(135,206,250,0.6)" } },
    // rain_screen: { name: "", default: { count: 120, minRadius: 10, maxRadius: 30, gravity: 0.2, smear: true, color: "rgba(180,200,255,0.2)" } },
    snow: { name: "", default: { count: 300, size: 2, speed: 1, drift: 2, color: "#ffffff" } },

    bubbles: { name: "", default: { count: 100, size: 20, pulseSpeed: 1, speed: 1 } },
    wave: { name: "", default: { amplitude: 10, wavelength: 200, speed: 3, color: "rgba(80, 140, 200, 0.4)", offset: 0.15 } },

    sun: { name: "", default: { x: 0.8, y: 0.24, radius: 50, color: "rgba(255, 223, 120, 0.8)" } },
    lens_flare: { name: "", default: { x: 0.8, y: 0.24, radius: 150 } },

    spotlight: { name: "", default: { x: 0.5, y: 0, length: 2000, baseWidth: 1000, swayAmplitude: 0, swaySpeed: 0, color: "rgba(234, 140, 255, 0.6)" } },

    aurora: { name: "", default: { bandCount: 7, amplitude: 60, wavelength: 500, speed: 0.6, colorStops: ["#00ffcc", "#00ffb7", "#00ff88"] } },
    bloom: { name: "", default: { blobCount: 25, blurAmount: 60, speed: 2 } },
    fog: { name: "", default: { count: 40, size: 120, speed: 2, opacity: 0.05, blur: 45, spread: 200 } },

    city: { name: "", default: { count: 40, height: 200, width: 40, color: "#222", windowColor: "#ffff99", night: true, flickerSpeed: 1 } },
    fireworks: { name: "", default: { speed: 0.5, count: 50, size: 1.5 } },

    rays: { name: "", default: { speed: 1, color_1: "#000", color_2: "#FFF", numRays: 8 } },

    cycle: { name: "", default: { speed: 1 } },

    circle: { name: "", default: { radius: 200, thickness: 10, color: "#c922ef" } },
    rectangle: { name: "", default: { width: 200, height: 200, thickness: 10, color: "#c922ef" } },
    triangle: { name: "", default: { size: 200, thickness: 10, color: "#c922ef" } }

    ///////////

    // circle: { name: "", default: { radius: 200, thickness: 10, speed: 0.1, gap: 1.8, hollow: true, shadow: 20, color: "#c922ef" } },

    // shapes
    // circle: { name: "", default: { type: "shape", shape: "circle", x: 0.5, y: 0.5, size: 100, rotationSpeed: 0, color: "#00ddff" } },
    // rectangle: { name: "", default: { type: "shape", shape: "rectangle", x: 0.5, y: 0.5, size: 100, rotationSpeed: 0, color: "#00ddff" } },
    // triangle: { name: "", default: { type: "shape", shape: "triangle", x: 0.5, y: 0.5, size: 100, rotationSpeed: 0, color: "#00ddff" } }
}
