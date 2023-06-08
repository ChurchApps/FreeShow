<script lang="ts">
    import CustomParticles from "./CustomParticles.svelte"

    function hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result
            ? {
                  r: parseInt(result[1], 16),
                  g: parseInt(result[2], 16),
                  b: parseInt(result[3], 16),
              }
            : null
    }
    function rgbToHsl({ r, g, b }) {
        ;(r /= 255), (g /= 255), (b /= 255)
        var max = Math.max(r, g, b),
            min = Math.min(r, g, b)
        var h,
            s,
            l = (max + min) / 2

        if (max == min) {
            h = s = 0 // achromatic
        } else {
            var d = max - min
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0)
                    break
                case g:
                    h = (b - r) / d + 2
                    break
                case b:
                    h = (r - g) / d + 4
                    break
            }
            h /= 6
        }

        return [h, s, l]
    }

    function limitNumberWithinRange(num, min, max) {
        const MIN = min ?? 0
        const MAX = max ?? 100
        const parsed = parseInt(num)
        return Math.min(Math.max(parsed, MIN), MAX)
    }

    const fireworksOptions = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93"]
        .map((color) => {
            const rgb = hexToRgb(color)

            if (!rgb) {
                return undefined
            }

            const hsl: any = rgbToHsl(rgb),
                sRange = limitNumberWithinRange({ min: hsl.s - 30, max: hsl.s + 30 }, 0, 100),
                lRange = limitNumberWithinRange({ min: hsl.l - 30, max: hsl.l + 30 }, 0, 100)

            return {
                color: {
                    value: {
                        h: hsl.h,
                        s: sRange,
                        l: lRange,
                    },
                },
                stroke: {
                    width: 0,
                },
                number: {
                    value: 0,
                },
                opacity: {
                    value: {
                        min: 0.1,
                        max: 1,
                    },
                    animation: {
                        enable: true,
                        speed: 0.7,
                        sync: false,
                        startValue: "max",
                        destroy: "min",
                    },
                },
                shape: {
                    type: "circle",
                },
                size: {
                    value: { min: 1, max: 2 },
                    animation: {
                        enable: true,
                        speed: 5,
                        count: 1,
                        sync: false,
                        startValue: "min",
                        destroy: "none",
                    },
                },
                life: {
                    count: 1,
                    duration: {
                        value: {
                            min: 1,
                            max: 2,
                        },
                    },
                },
                move: {
                    decay: { min: 0.075, max: 0.1 },
                    enable: true,
                    gravity: {
                        enable: true,
                        inverse: false,
                        acceleration: 5,
                    },
                    speed: { min: 5, max: 15 },
                    direction: "none",
                    outModes: "destroy",
                },
            }
        })
        .filter((t) => t !== undefined)

    let particles = {
        detectRetina: true,
        background: {
            color: "#000",
        },
        fpsLimit: 120,
        emitters: {
            direction: "top",
            life: {
                count: 0,
                duration: 0.1,
                delay: 0.1,
            },
            rate: {
                delay: 0.05,
                quantity: 1,
            },
            size: {
                width: 100,
                height: 0,
            },
            position: {
                y: 100,
                x: 50,
            },
        },
        particles: {
            number: {
                value: 0,
            },
            destroy: {
                mode: "split",
                bounds: {
                    top: { min: 10, max: 30 },
                },
                split: {
                    sizeOffset: false,
                    count: 1,
                    factor: {
                        value: 0.333333,
                    },
                    rate: {
                        value: { min: 75, max: 150 },
                    },
                    particles: fireworksOptions,
                },
            },
            life: {
                count: 1,
            },
            shape: {
                type: "line",
            },
            size: {
                value: {
                    min: 0.1,
                    max: 50,
                },
                animation: {
                    enable: true,
                    sync: true,
                    speed: 90,
                    startValue: "max",
                    destroy: "min",
                },
            },
            stroke: {
                color: {
                    value: "#ffffff",
                },
                width: 1,
            },
            rotate: {
                path: true,
            },
            move: {
                enable: true,
                gravity: {
                    acceleration: 15,
                    enable: true,
                    inverse: true,
                    maxSpeed: 100,
                },
                speed: {
                    min: 10,
                    max: 20,
                },
                outModes: {
                    default: "destroy",
                    top: "none",
                },
                trail: {
                    fillColor: "#000",
                    enable: true,
                    length: 10,
                },
            },
        },
    }
</script>

<CustomParticles {particles} />
