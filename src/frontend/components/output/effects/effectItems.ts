// effectTypes
export const effectItems = {
    circle: { name: "", default: { type: "shape", shape: "circle", x: 0.5, y: 0.5, size: 100, rotationSpeed: 0, color: "#00ddff" } },
    rectangle: { name: "", default: { type: "shape", shape: "rectangle", x: 0.5, y: 0.5, size: 100, rotationSpeed: 0, color: "#00ddff" } },
    triangle: { name: "", default: { type: "shape", shape: "triangle", x: 0.5, y: 0.5, size: 100, rotationSpeed: 0, color: "#00ddff" } },

    wave: { name: "", default: { amplitude: 10, wavelength: 90 * 4, speed: 3, color: "rgba(80, 140, 200, 0.4)", offset: 0.35 } },
    bubbles: { name: "", default: { count: 50, size: 20, maxSizeVariation: 10, pulseSpeed: 1, speed: 1 } },
    stars: { name: "", default: { count: 800, size: 0.7, speed: 1 } },
    galaxy: { name: "", default: { count: 2000, size: 1.5, swirlStrength: 0.6, rotationSpeed: 12, armCount: 5, nebula: true, colors: ["white", "#a0c8ff", "#e0b3ff", "#ffccff"] } },
    rain: { name: "", default: { count: 300, speed: 10, length: 10, width: 1, color: "rgba(135,206,250,0.6)" } },
    // rain_screen: { name: "", default: { count: 120, minRadius: 10, maxRadius: 30, gravity: 0.2, smear: true, color: "rgba(180,200,255,0.2)" } },
    snow: { name: "", default: { count: 300, size: 2, speed: 1, drift: 0.3, color: "white" } },
    neon: { name: "", default: { radius: 120, thickness: 8, speed: -0.0015, angle: 0, color: "magenta" } },
    sun: { name: "", default: { x: 1600, y: 200, radius: 60, rayCount: 12, rayLength: 40, rayWidth: 3, color: "rgba(255, 223, 220, 0.8)" } },
    lens_flare: { name: "", default: { radius: 150 } },
    spotlight: { name: "", default: { x: 1200, y: 0, length: 2000, baseWidth: 1000, color: "rgba(234, 140, 255, 0.6)", swayAmplitude: 1, swaySpeed: 1 } },
    aurora: { name: "", default: { bandCount: 7, amplitude: 60, wavelength: 800, speed: 0.6, colorStops: ["#00ffcc", "#00ffb7", "#00ff88"], opacity: 0.25 } },
    bloom: { name: "", default: { blobCount: 25, blurAmount: 60, speed: 2 } },
    fog: { name: "", default: { count: 40, size: 120, speed: -1, opacity: 0.05, blur: 45, offset: 0.6, spread: 200 } },
    city: { name: "", default: { buildingCount: 40, minWidth: 30, maxWidth: 70, minHeight: 100, maxHeight: 400, color: "#222", windowColor: "#ffff99", night: true, flickerSpeed: 1 } },
    rays: { name: "", speed: 1, color_1: "#001f3f", color_2: "#FFDC00", numRays: 20 },
    fireworks: { name: "", speed: 1, count: 20 }
}
