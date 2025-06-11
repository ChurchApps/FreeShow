export const effectItems = {
    stars: { default: { count: 800, size: 1, speed: 2 } },
    galaxy: { default: { count: 1500, size: 1.5, swirlStrength: 0.5, rotationSpeed: 10, armCount: 5 } },
    rain: { default: { count: 300, speed: 10, length: 10, width: 1, color: "rgba(135,206,250,0.6)" } },
    snow: { default: { count: 300, size: 2, speed: 1, drift: 2, color: "#ffffff" } },

    bubbles: { default: { count: 100, size: 20, pulseSpeed: 1, speed: 1 } },

    grass: { default: { count: 250, height: 60, width: 4, speed: 1, color: "#4a7c59" } },
    wave: { default: { amplitude: 10, wavelength: 200, speed: 3, color: "rgba(80, 140, 200, 0.4)", offset: 0.15 } },

    sun: { default: { x: 0.8, y: 0.24, radius: 50, color: "rgba(255, 223, 120, 0.8)" } },
    lens_flare: { default: { x: 0.8, y: 0.24, radius: 150 } },

    lightning: { default: { frequency: 0.2, duration: 5, color: "#ffffff" } },
    rainbow: { default: { bandWidth: 30 } },

    spotlight: { default: { x: 0.5, y: 0, length: 2000, baseWidth: 1000, swayAmplitude: 0, swaySpeed: 0, color: "rgba(234, 140, 255, 0.6)" } },

    aurora: { default: { bandCount: 7, amplitude: 60, wavelength: 500, speed: 0.6, colorStops: ["#00ffcc", "#00ffb7", "#00ff88"] } },
    bloom: { default: { blobCount: 25, blurAmount: 60, speed: 2 } },
    fog: { default: { count: 40, size: 120, speed: 2, opacity: 0.05, blur: 45, spread: 200 } },

    city: { default: { count: 40, height: 200, width: 40, color: "#222222", windowColor: "#ffff99", night: true, flickerSpeed: 1 } },
    fireworks: { default: { speed: 0.5, count: 50, size: 1.5 } },

    rays: { default: { speed: 1, color_1: "#000000", color_2: "#ffffff", numRays: 8 } },

    cycle: { default: { speed: 1 } },

    circle: { default: { radius: 200, thickness: 10, color: "#00ddff" } },
    rectangle: { default: { width: 200, height: 200, thickness: 10, color: "#00ddff" } },
    triangle: { default: { size: 200, thickness: 10, color: "#00ddff" } }
}
