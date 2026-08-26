import { get } from "svelte/store"
import type { Effect } from "../../types/Effects"
import type { MainFilePaths } from "../../types/Main"
import type { Overlay, Template } from "../../types/Show"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { setShow } from "../components/helpers/setShow"
import { activePopup, audioFolders, deletedDefaults, effects, folders, language, mediaFolders, outputs, overlays, projects, remotePassword, scriptures, shows, templates, variables } from "../stores"
import { stageShows, templateCategories } from "./../stores"
import { translateText } from "./language"
import { save } from "./save"

export function createData(paths: MainFilePaths) {
    if (!get(shows).default) {
        createDefaultShow()
    }

    stageShows.set({
        default: {
            name: translateText("example.default"),
            disabled: false,
            password: "",
            settings: {},
            items: {
                textCurrent: {
                    type: "slide_text",
                    style: "width:1870px;height:680px;left:25px;top:25px;font-family: Arial;font-weight:bold;",
                    align: ""
                },
                textNext: {
                    type: "slide_text",
                    slideOffset: 1,
                    lineCount: 2,
                    style: "width:1870px;height:330px;left:25px;top:725px;font-family: Arial;font-weight:bold;color:#aaaaaa;",
                    align: ""
                }
            }
        }
    })

    setExampleEffects()

    setExampleOverlays()

    folders.update((a) => {
        a.default = { name: translateText("example.meetings"), parent: "/" }
        return a
    })
    projects.update((a) => {
        a.default = {
            name: translateText("example.example"),
            created: new Date("2022-01-01").getTime(),
            parent: "default",
            shows: [{ id: "default" }, { id: "section", type: "section", name: translateText("example.example"), notes: translateText("example.example_note") }]
        }
        return a
    })

    setExampleTemplates()
    mediaFolders.update((a) => {
        if (paths.pictures) a.pictures = { name: "category.pictures", icon: "folder", path: paths.pictures, default: true }
        if (paths.videos) a.videos = { name: "category.videos", icon: "folder", path: paths.videos, default: true }
        return a
    })
    audioFolders.update((a) => {
        if (paths.music) a.music = { name: "category.music", icon: "folder", path: paths.music, default: true }
        return a
    })

    remotePassword.set(randomNumber(1000, 9999).toString())

    // translate names set in defaults.ts
    if (get(outputs).default?.name === "Primary") {
        outputs.update((a) => {
            a.default.name = translateText("theme.primary")
            return a
        })
    }
    if (get(variables).default?.name === "Counter") {
        variables.update((a) => {
            a.default.name = translateText("variables.number")
            return a
        })
    }

    // region specific
    if (get(language) === "no") {
        scriptures.update((a) => {
            a = {}
            a.nb11 = {
                api: true,
                id: "eea18ccd2ca05dde-01",
                name: "Bibel 2011 Bokmål"
            }
            a.nn11 = {
                api: true,
                id: "7bcaa2f2e77739d5-01",
                name: "Bibel 2011 Nynorsk"
            }
            return a
        })
    }

    save()
}

const randomNumber = (from: number, to: number): number => Math.floor(Math.random() * (to - from)) + from

// OVERLAYS

export function setExampleEffects() {
    deletedDefaults.update((a) => {
        delete a.effects
        return a
    })

    effects.set({ ...get(effects), ...getDefaultEffects() })
}

function createDefaultEffects() {
    const deletedIds = get(deletedDefaults).effects || []
    const defaultEffects = getDefaultEffects()

    effects.update((a) => {
        Object.keys(defaultEffects).forEach((id) => {
            // if deleted or exists, skip
            if (deletedIds.includes(id) || a[id]) return
            a[id] = defaultEffects[id]
        })

        return a
    })
}

function getDefaultEffects() {
    const a: Record<string, Effect> = {}

    a.ocean = {
        name: "Ocean",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "", // filter:;
        background: "linear-gradient(#003366, #001d3d)",
        items: [
            { type: "stars", count: 800, size: 0.7, speed: 1 },
            { type: "stars", count: 300, size: 1.2, speed: 1 },
            { type: "wave", amplitude: 20, wavelength: 900, speed: 1, color: "rgba(10, 40, 90, 0.6)", offset: 0.19 },
            { type: "wave", amplitude: 15, wavelength: 600, speed: 1.5, color: "rgba(40, 90, 140, 0.5)", offset: 0.17 },
            { type: "wave", amplitude: 10, wavelength: 450, speed: 3, color: "rgba(80, 140, 200, 0.4)", offset: 0.15 },
            { type: "wave", amplitude: 5, wavelength: 300, speed: 8, color: "rgba(150, 200, 255, 0.3)", offset: 0.13 }
        ] as any
    }

    a.spotlights = {
        name: "Spotlights",
        isDefault: true,
        color: null,
        style: "",
        background: "",
        items: [
            { type: "spotlight", x: 0.2, y: 0, length: 2000, baseWidth: 1000, color: "rgba(255, 255, 200, 0.6)", swayAmplitude: 1, swaySpeed: 1.8 },
            { type: "spotlight", x: 0.4, y: 0, length: 2000, baseWidth: 1000, color: "rgba(255, 200, 207, 0.6)", swayAmplitude: 1.2, swaySpeed: 2 },
            { type: "spotlight", x: 0.6, y: 0, length: 2000, baseWidth: 1000, color: "rgba(200, 208, 255, 0.6)", swayAmplitude: 1.2, swaySpeed: 2.1 },
            { type: "spotlight", x: 0.8, y: 0, length: 2000, baseWidth: 1000, color: "rgba(234, 140, 255, 0.6)", swayAmplitude: 1, swaySpeed: 1.9 }
        ] as any[]
    }

    a.rain = {
        name: "Rain",
        isDefault: true,
        color: null,
        style: "",
        background: "",
        items: [{ type: "rain", count: 300, speed: 10, length: 10, width: 1, color: "rgba(135,206,250,0.6)" }] as any[]
    }

    a.fireworks = {
        name: "Fireworks",
        isDefault: true,
        color: null,
        style: "",
        background: "",
        items: [{ type: "fireworks", speed: 0.5, count: 50, size: 1.5 }] as any[]
    }

    a.bubbles = {
        name: "Bubbles",
        isDefault: true,
        color: null,
        style: "",
        background: "",
        items: [
            { type: "snow", color: "rgb(255 255 255 / 0.15)", count: 50, drift: 1, size: 25, speed: 0.4 },
            { type: "snow", color: "rgb(255 255 255 / 0.1)", count: 50, drift: 1, size: 20, speed: -0.3 }
        ] as any[]
    }

    // MESH GRADIENT PRESETS
    // motion backgrounds (placeUnderSlide to behave like backgrounds)

    a.gradient_bold = {
        name: "Bold",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#120608", "#130a0b", "#110707", "#14040b", "#0d0b04", "#180909", "#0e0707", "#0c0001", "#100608", "#090e02", "#19000f", "#000205", "#1b1010", "#191710", "#130f14", "#1d0006", "#162414", "#2e1511", "#010200", "#4f323d", "#1c2207", "#42483e", "#550500", "#1f2d13", "#c19daf", "#7d4b23", "#d4b32e", "#000000", "#ff9940", "#4b2a13", "#bca689", "#ffffff", "#ffefb1", "#000000", "#e18e34", "#ffe657"] }] as any[]
    }

    a.gradient_bright = {
        name: "Bright",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#070d17", "#04080c", "#06081d", "#060e13", "#080c13", "#030813", "#020008", "#050b23", "#030c00", "#010013", "#00010f", "#090c13", "#00152a", "#161101", "#060237", "#162d0f", "#191b3c", "#02060c", "#370600", "#001a2c", "#14151d", "#000005", "#000020", "#0f2735", "#80ae8f", "#002882", "#860000", "#ffff6f", "#442f83", "#0d0000", "#83b7c2", "#0000ce", "#ffa600", "#e7ffff", "#ffffff", "#437aa2"] }] as any[]
    }

    a.gradient_calm = {
        name: "Calm",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#6b5b76", "#ffffff", "#cdb5d0", "#000000", "#ffffff", "#ada1c0", "#1e1129", "#a491aa", "#7c6d83", "#000000", "#cfaddc", "#cbccda", "#4f395d", "#312c4d", "#321c43", "#493753", "#7c779c", "#efdfef", "#27253f", "#b796cb", "#000000", "#a595cf", "#c2acb0", "#b4afd9", "#3a2840", "#cfb5f3", "#000000", "#f0d5ff", "#595b72", "#4b3053", "#6d568e", "#b6a4b0", "#000022", "#7b757c", "#e6bef9", "#000000"] }] as any[]
    }

    a.gradient_cosmic = {
        name: "Cosmic",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#a587ed", "#c7e2ff", "#4b0095", "#3609a8", "#f4f2ff", "#b7abf7", "#9296c9", "#b8a6ff", "#1c0067", "#4f20d2", "#ffff7a", "#c5a9d5", "#b3caf0", "#a06bcb", "#000076", "#b17af5", "#ffff1b", "#e5bfc4", "#ace1e7", "#9229ba", "#000086", "#f2afd8", "#ffff3a", "#edd19b", "#caecff", "#671a84", "#0000c7", "#ffff8c", "#e7ad6a", "#fffc8a", "#ecfffb", "#5235ef", "#7a2388", "#ffffb2", "#d6c16e", "#ffff9c"] }] as any[]
    }

    a.gradient_deep = {
        name: "Deep",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#120912", "#110715", "#120a13", "#130915", "#0e060f", "#130a15", "#0b0213", "#0e080a", "#09000f", "#0a040a", "#130917", "#09000a", "#191114", "#0f0020", "#221e21", "#0e001a", "#171118", "#170f1f", "#170d24", "#191f14", "#11001e", "#11140f", "#31253f", "#403542", "#17111c", "#87689f", "#000000", "#a291b9", "#31202d", "#49455b", "#664f80", "#aa9db2", "#00001a", "#7a6981", "#ceb7e9", "#000000"] }] as any[]
    }

    a.gradient_ember = {
        name: "Ember",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#0d0407", "#090600", "#0f0512", "#0c0400", "#0d030b", "#0a0502", "#070000", "#0e0011", "#010000", "#070012", "#070300", "#0b000b", "#11080c", "#1a0f00", "#0d0e33", "#270900", "#03000f", "#1b0b06", "#370e1c", "#131624", "#360000", "#000012", "#4a2717", "#17030b", "#895237", "#530421", "#ffdbff", "#150000", "#000000", "#b06251", "#74291d", "#ffffff", "#f6ffff", "#ffdedc", "#be94b0", "#3a1b15"] }] as any[]
    }

    a.gradient_fresh = {
        name: "Fresh",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#eeb48c", "#f1ffff", "#ffd59d", "#000000", "#5a7e27", "#4f3e24", "#a7b06c", "#ffc9d2", "#b3ffff", "#ff7f48", "#000a00", "#325323", "#66a14e", "#ffefde", "#facad8", "#f9edd9", "#f63400", "#00152b", "#4cd08d", "#bc3400", "#ffe0b4", "#3d5182", "#ff9802", "#473c56", "#9da196", "#7a4230", "#ffe396", "#77b8ca", "#ff997f", "#bb9462", "#cac095", "#ffffff", "#bead9d", "#ffffff", "#c39269", "#ffd3c1"] }] as any[]
    }

    a.gradient_gateway = {
        name: "Gateway",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#150a12", "#040916", "#1a0612", "#020c17", "#1a0610", "#080a15", "#000111", "#1f0606", "#000a11", "#250104", "#000916", "#17020a", "#291e17", "#0f082c", "#291a1b", "#050230", "#2e1e13", "#0c0f27", "#30263e", "#29273d", "#60441f", "#0b0534", "#111c1a", "#373625", "#b6b07b", "#eba2fe", "#186f00", "#ffc850", "#3c5696", "#6dac56", "#f6f1b0", "#ffeece", "#cbe7ed", "#d8bebf", "#fff4ff", "#91d6a6"] }] as any[]
    }

    a.gradient_heat = {
        name: "Heat",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#ffffff", "#610f1d", "#010000", "#d89898", "#f2ffef", "#a981a3", "#ffffff", "#543565", "#b3634e", "#3a0000", "#f9d2b2", "#e0cfce", "#dbc2c3", "#e2e0d0", "#ffffff", "#000000", "#bc6866", "#ddcba3", "#e1bda4", "#aeaba8", "#ffffff", "#1b0000", "#220004", "#fffeca", "#e1a06e", "#908a8d", "#ffffff", "#b994b0", "#000000", "#d89678", "#6f372b", "#ffffff", "#dbe7e9", "#ffeec5", "#e5c6f1", "#3a0a00"] }] as any[]
    }

    a.gradient_horizon = {
        name: "Horizon",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#121225", "#120f2a", "#0c0e23", "#17102d", "#08111f", "#160e29", "#070424", "#060b17", "#150d2a", "#000811", "#1f0732", "#000d1a", "#24242d", "#1d1741", "#151727", "#261c41", "#0d1c2a", "#2c1b35", "#353947", "#433c2a", "#1c1769", "#433d24", "#495556", "#110026", "#b6b8b4", "#e5e184", "#779cae", "#e8d2b0", "#9bc46b", "#c491d2", "#e8d7ff", "#ffffff", "#c0577a", "#ffffff", "#faffb1", "#fceaff"] }] as any[]
    }

    a.gradient_iris = {
        name: "Iris",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#224e3d", "#98716e", "#e8c3a9", "#ffbcc7", "#ffffff", "#002f87", "#45001d", "#3eac79", "#5e76ab", "#d8f69d", "#00dfff", "#200067", "#f2602c", "#009d71", "#1b008d", "#ffedbb", "#0000ff", "#3f6239", "#ffda84", "#006ca4", "#ff0000", "#ffffba", "#742644", "#02432e", "#cdffd1", "#1241ed", "#ff5b00", "#c5ffce", "#ffdcff", "#0d1500", "#7383b8", "#7b72b0", "#ffed78", "#d7ceff", "#ffffff", "#367fbd"] }] as any[]
    }

    a.gradient_ivy = {
        name: "Ivy",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#15190e", "#1a190a", "#171b05", "#141311", "#1b1a06", "#18190a", "#191207", "#0c1200", "#110e17", "#1d2100", "#090f0f", "#111205", "#111f0b", "#2a2721", "#252500", "#000820", "#333311", "#201c13", "#3b3425", "#27310f", "#050215", "#a2935f", "#10040c", "#343c1c", "#daa7b0", "#aa9468", "#000000", "#937554", "#1e3814", "#4e4f1c", "#d9f0d3", "#fff7fc", "#6a4d6c", "#ffffff", "#323700", "#8ca145"] }] as any[]
    }

    a.gradient_joy = {
        name: "Joy",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#630000", "#ffdc51", "#ffb16a", "#1834b3", "#380086", "#949dd4", "#2a0521", "#ff8ea6", "#f2b2cd", "#c5ffff", "#de3b83", "#a93349", "#ffefb9", "#9767ba", "#ff6f3f", "#d5ffff", "#f09cce", "#e8870f", "#ffffa4", "#934ae1", "#92031a", "#ffffff", "#acab9c", "#ff8968", "#ffff5c", "#4d00d0", "#000043", "#fffff4", "#b6a4a9", "#e6afac", "#fef499", "#d56f80", "#0000a8", "#984fee", "#ffbc00", "#877eff"] }] as any[]
    }

    a.gradient_life = {
        name: "Life",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#bac7b1", "#bbb9a3", "#5f8159", "#adae9a", "#bed1ae", "#2f3728", "#a3ba93", "#e8dede", "#333f20", "#616960", "#819b72", "#c9cbb5", "#554e57", "#d5ec99", "#000000", "#4f584e", "#ffffff", "#9eaa98", "#57705b", "#cfc19b", "#000000", "#feffd4", "#e1ede4", "#747d60", "#aab9ac", "#3d1912", "#408e31", "#ffdfff", "#ffffe7", "#504d49", "#2a3227", "#a6b2a3", "#3b6218", "#999b83", "#abbcad", "#586846"] }] as any[]
    }

    a.gradient_love = {
        name: "Love",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#140c10", "#120c0b", "#1e1011", "#0a0f0b", "#1f0e10", "#140d0c", "#180f06", "#1c0e14", "#000502", "#310814", "#000b02", "#170c11", "#0e071a", "#100900", "#401c2a", "#001400", "#391034", "#120b00", "#382518", "#1a1a2c", "#000600", "#5b154a", "#000a00", "#302d4c", "#ff6938", "#191d0f", "#00001c", "#001e00", "#000000", "#e15e3d", "#e4c373", "#ff4900", "#00003c", "#000000", "#fc5bed", "#ffadc4"] }] as any[]
    }

    a.gradient_lilac = {
        name: "Lilac",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#bbdfff", "#9cbfdf", "#9efdff", "#d52079", "#bb4a9a", "#d051ae", "#cae1ff", "#b999e0", "#51dbff", "#bebcff", "#ac002b", "#c082c3", "#ffeffb", "#eab6ea", "#74eaff", "#c96bbf", "#a90048", "#cbfbdd", "#eef8fa", "#ffa2ec", "#b0ffff", "#b4004e", "#a20082", "#edffd3", "#fee8ff", "#e1b1f1", "#ffffe8", "#913c84", "#8b005f", "#fffff1", "#fffff1", "#d9bbff", "#fffff7", "#76a19e", "#c5007a", "#ffffff"] }] as any[]
    }

    a.gradient_bloom = {
        name: "Bloom",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#dcbbb4", "#ffffff", "#282200", "#ffffff", "#f4ba6a", "#1a274d", "#ddc7bc", "#ffffff", "#ce967a", "#fff0f4", "#000d00", "#ffffff", "#fffff4", "#c3998e", "#ffffff", "#000000", "#cda324", "#fcbfff", "#cac1ae", "#ffedff", "#fee394", "#000000", "#ffffff", "#e5aaaf", "#dd89b6", "#ffffff", "#000000", "#630023", "#ffffff", "#d084ae", "#d284ad", "#ffffff", "#7a4780", "#c1bca1", "#fff8ff", "#cab5cd"] }] as any[]
    }

    a.gradient_moss = {
        name: "Moss",
        isDefault: true,
        placeUnderSlide: true,
        color: null,
        style: "",
        background: "#000000",
        items: [{ type: "mesh_gradient", speed: 1, motion: 0.07, density: 6, grain: 0, colors: ["#150f10", "#0b1310", "#170e08", "#0c1016", "#16120d", "#111212", "#08160d", "#1f0b0b", "#031920", "#1c1300", "#050e13", "#110e08", "#1a1212", "#0e1e1e", "#210c00", "#091729", "#24190d", "#141d1b", "#071213", "#53432f", "#000f0e", "#28070b", "#234736", "#302226", "#696e67", "#2c2511", "#0f1512", "#a9ba94", "#c3bea6", "#1d2e1c", "#2e3b33", "#91917a", "#326e1a", "#a09686", "#a0c4a3", "#52573d"] }] as any[]
    }

    return a
}

export function setExampleOverlays() {
    deletedDefaults.update((a) => {
        delete a.overlays
        return a
    })

    overlays.set({ ...get(overlays), ...getDefaultOverlays() })
}

function createDefaultOverlays() {
    const deletedIds = get(deletedDefaults).overlays || []
    const defaultOverlays = getDefaultOverlays()

    overlays.update((a) => {
        Object.keys(defaultOverlays).forEach((id) => {
            // if deleted or exists, skip
            if (deletedIds.includes(id) || a[id]) return
            a[id] = defaultOverlays[id]
        })

        return a
    })
}

function getDefaultOverlays() {
    const a: Record<string, Overlay> = {}

    a.watermark = {
        isDefault: true,
        name: translateText("example.watermark"),
        color: "#F0008C",
        category: "notice",
        items: [
            {
                style: "top:870px;left:1248px;height:170px;width:630px;",
                align: "align-items:flex-end;",
                lines: [{ align: "text-align: right;", text: [{ value: "FreeShow", style: "font-size:50px;font-weight:bold;color:#F0008C;" }] }]
            }
        ]
    }
    a.visual = {
        isDefault: true,
        name: translateText("example.recording"),
        color: "red",
        category: "visuals",
        // TODO: create box
        items: [{ style: "top:35px;left:36.5px;height:1008.21px;width:1847.62px;border:4px solid white;" }, { style: "top:80px;left:80px;height:40px;width:40px;background-color:red;border-radius:50%;" }, { style: "top:80px;left:140px;height:40px;width:100px;", lines: [{ align: "", text: [{ value: "REC", style: "font-size:40px;" }] }] }]
    }
    a.clock = {
        isDefault: true,
        name: translateText("example.clock"),
        color: "dodgerblue",
        category: "visuals",
        items: [{ style: "top:70px;left:1450px;height:150px;width:470px;", type: "clock", clock: { type: "digital", dateFormat: "none", showTime: true, seconds: false } }]
    }
    a.clock_analog = {
        isDefault: true,
        name: "Clock (Analog)",
        color: "dodgerblue",
        category: "visuals",
        items: [
            {
                style: "top:72.50px;left:50px;height:936.40px;width:936.40px;font-family:CMGSans;color:#FFFFFF;left:492.00px;border-radius:500px;border-width:2px;background-color:rgb(0 0 0 / 0.5);",
                type: "clock",
                clock: { type: "analog", dateFormat: "none", showTime: true, seconds: false }
            }
        ]
    }
    a.name = {
        isDefault: true,
        name: translateText("inputs.name"),
        color: "#0b57a2",
        category: "visuals",
        displayDuration: 4,
        items: [
            { style: "top:875px;left:80px;height:135px;width:750px;background-color: #0b57a2;box-shadow: 2px 2px 10px 0px rgb(0 0 0 / 0.8);" },
            { style: "top:875px;left:80px;height:135px;width:50px;background-color: #74cbfb;" },
            {
                style: "top:935px;left:130px;height:75px;width:700px;background-color: #0b57a2;padding: 0 10px;",
                actions: {
                    showTimer: 1,
                    transition: { type: "slide", duration: 500, easing: "cubic" }
                },
                type: "text",
                lines: [{ align: "text-align: left;", text: [{ value: "Name Surname", style: "font-family: Arial;font-size: 70px;text-shadow: 0 0 #000000;" }] }]
            },
            {
                style: "top:875px;left:130px;height:60px;width:700px;background-color: #006fcf;padding: 0 10px;",
                actions: {
                    transition: { type: "slide", duration: 500, easing: "cubic" }
                },
                type: "text",
                lines: [{ align: "text-align: left;", text: [{ value: "Title", style: "font-family: Arial;font-size: 40px;font-weight: bold;text-transform:uppercase;text-shadow: 0 0 #000000;" }] }]
            }
        ]
    }
    a.rounded = {
        isDefault: true,
        name: translateText("example.rounded"),
        color: null,
        category: "visuals",
        locked: true,
        items: [
            { style: "top:0px;left:0px;height:50px;width:50px;background:radial-gradient(circle at 100% 100%, transparent 50px, black 0px);" },
            { style: "top:0px;inset-inline-end:0px;height:50px;width:50px;background:radial-gradient(circle at 0 100%, transparent 50px, black 0px);" },
            { style: "bottom:0px;inset-inline-end:0px;height:50px;width:50px;background:radial-gradient(circle at 0 0, transparent 50px, black 0px);" },
            { style: "bottom:0px;left:0px;height:50px;width:50px;background:radial-gradient(circle at 100% 0, transparent 50px, black 0px);" }
        ]
    }
    a.vignette = {
        isDefault: true,
        name: "Vignette",
        color: "#dddddd",
        category: "visuals",
        locked: true,
        items: [{ style: "top: -180px;left: -200px;width: 2320px;height: 1440px;border-radius: 500px;box-shadow: inset 0px 0px 248px 0px #FFFFFF;" }]
    }
    // this requires a variable
    // a.progress = {
    //     isDefault: true,
    //     name: "Slide Progress",
    //     color: null,
    //     category: "visuals",
    //     items: [{ style: "left: 0px;width: calc(1920px * (var(--variable-slide) / var(--variable-slides)));height:20px;top:1060px;background-color:#FF851B;", lines: [{ align: "", text: [{ value: "", style: "" }] }] }]
    // }

    return a
}

// TEMPLATES

export function setExampleTemplates() {
    deletedDefaults.update((a) => {
        delete a.templates
        return a
    })

    templateCategories.update((a) => {
        a.scripture = { default: true, name: "category.scripture", icon: "scripture" }
        return a
    })

    templates.set({ ...get(templates), ...getDefaultTemplates() })
    createDoubleTemplate()
}

export function setDefaultScriptureTemplates() {
    const templatesList = getDefaultScriptureTemplates()

    deletedDefaults.update((a) => {
        a.templates = (get(deletedDefaults).templates || []).filter((id) => !Object.keys(templatesList).includes(id))
        return a
    })

    templateCategories.update((a) => {
        a.scripture = { default: true, name: "category.scripture", icon: "scripture" }
        return a
    })

    templates.set({ ...get(templates), ...templatesList })
}

function createDefaultTemplates() {
    const deletedIds = get(deletedDefaults).templates || []
    const defaultTemplates = getDefaultTemplates()

    templates.update((a) => {
        Object.keys(defaultTemplates).forEach((id) => {
            // if deleted or exists, skip
            if (deletedIds.includes(id) || a[id]) return
            a[id] = defaultTemplates[id]
        })

        return a
    })
}

function getDefaultTemplates() {
    const a: Record<string, Template> = {}

    // metadata
    a.metadata = {
        isDefault: true,
        name: translateText("tools.metadata"),
        color: null,
        category: "song", // "metadata"
        items: [
            {
                style: "top: 910px;left: 30px;width: 1860px;height: 150px;",
                align: "",
                lines: [{ align: "", text: [{ value: translateText("tools.metadata"), style: "font-size: 30px;color: rgb(255 255 255 / 0.8);text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);" }] }]
            }
        ]
    }
    // presentation
    a.header = {
        isDefault: true,
        name: translateText("example.header"),
        color: null,
        category: "presentation",
        items: [
            {
                style: "top:428.50px;left:208.50px;height:220px;width:1500px;",
                align: "",
                lines: [{ align: "", text: [{ value: translateText("example.header"), style: "font-size: 180px;font-weight: bold;" }] }]
            }
        ]
    }
    a.text = {
        isDefault: true,
        name: translateText("example.text"),
        color: null,
        category: "presentation",
        items: [
            {
                style: "top:35px;left:50.5px;height:220px;width:1820px;",
                align: "",
                lines: [{ align: "text-align: left;", text: [{ value: translateText("example.header"), style: "font-size: 120px;font-weight: bold;" }] }]
            },
            {
                style: "top:290px;left:50.5px;height:750px;width:1820px;",
                align: "",
                lines: [{ align: "text-align: left;", text: [{ value: translateText("example.text"), style: "font-size: 80px;" }] }]
            }
        ]
    }

    // lyrics
    a.big = {
        isDefault: true,
        name: translateText("example.big"),
        color: null,
        category: "song",
        items: [
            {
                style: DEFAULT_ITEM_STYLE,
                align: "",
                lines: [{ align: "", text: [{ value: translateText("example.big"), style: "font-size: 120px;" }] }]
            }
        ]
    }
    a.default = {
        isDefault: true,
        name: translateText("example.default"),
        color: null,
        category: "song",
        items: [
            {
                style: DEFAULT_ITEM_STYLE,
                align: "",
                lines: [{ align: "", text: [{ value: translateText("example.default"), style: "font-size: 100px;" }] }]
            }
        ]
    }
    a.small = {
        isDefault: true,
        name: translateText("example.small"),
        color: null,
        category: "song",
        items: [
            {
                style: DEFAULT_ITEM_STYLE,
                align: "",
                lines: [{ align: "", text: [{ value: translateText("example.small"), style: "font-size: 80px;" }] }]
            }
        ]
    }
    a.bigBold = {
        isDefault: true,
        name: translateText("example.big example.bold"),
        color: null,
        category: "song",
        items: [
            {
                style: DEFAULT_ITEM_STYLE,
                align: "",
                lines: [
                    {
                        align: "",
                        text: [
                            {
                                value: translateText("example.big example.bold"),
                                style: "font-size: 120px;font-weight: bold;"
                            }
                        ]
                    }
                ]
            }
        ]
    }
    a.defaultBold = {
        isDefault: true,
        name: translateText("example.default example.bold"),
        color: null,
        category: "song",
        items: [
            {
                style: DEFAULT_ITEM_STYLE,
                align: "",
                lines: [
                    {
                        align: "",
                        text: [
                            {
                                value: translateText("example.default example.bold"),
                                style: "font-size: 100px;font-weight: bold;"
                            }
                        ]
                    }
                ]
            }
        ]
    }
    a.smallBold = {
        isDefault: true,
        name: translateText("example.small example.bold"),
        color: null,
        category: "song",
        items: [
            {
                style: DEFAULT_ITEM_STYLE,
                align: "",
                lines: [
                    {
                        align: "",
                        text: [
                            {
                                value: translateText("example.small example.bold"),
                                style: "font-size: 80px;font-weight: bold;"
                            }
                        ]
                    }
                ]
            }
        ]
    }
    a.blur_box = {
        isDefault: true,
        name: "Blur box",
        color: null,
        category: "song",
        items: [
            {
                style: "top:310px;left:0px;height:460px;width:1920px;background-color: rgb(0 0 0 / 0.5);backdrop-filter: blur(10px);",
                align: "",
                lines: [
                    { align: "", text: [{ value: "1", style: "font-size: 90px;line-height:1.2em;letter-spacing:2px;text-shadow: 0 0 #000000;" }] },
                    { align: "", text: [{ value: "2", style: "font-size: 90px;line-height:1.2em;letter-spacing:2px;text-shadow: 0 0 #000000;" }] },
                    { align: "", text: [{ value: "3", style: "font-size: 90px;line-height:1.2em;letter-spacing:2px;text-shadow: 0 0 #000000;" }] },
                    { align: "", text: [{ value: "4", style: "font-size: 90px;line-height:1.2em;letter-spacing:2px;text-shadow: 0 0 #000000;" }] }
                ]
            }
        ]
    }
    a.faded = {
        isDefault: true,
        name: "Faded",
        color: null,
        category: "song",
        items: [
            {
                style: "top:0px;left:0px;height:1080px;width:1920px;background-color: rgb(0 0 0 / 0.5);backdrop-filter: blur(10px);",
                align: "",
                actions: { transition: { type: "none", duration: 0, easing: "linear" } },
                lines: []
            },
            {
                style: "top:310px;left:0px;height:460px;width:1920px;",
                align: "",
                actions: { transition: { type: "fade", duration: 500, easing: "sine" } },
                lines: [
                    { align: "", text: [{ value: "1", style: "font-size: 90px;line-height:1.2em;letter-spacing:2px;" }] },
                    { align: "", text: [{ value: "2", style: "font-size: 90px;line-height:1.2em;letter-spacing:2px;" }] },
                    { align: "", text: [{ value: "3", style: "font-size: 90px;line-height:1.2em;letter-spacing:2px;" }] },
                    { align: "", text: [{ value: "4", style: "font-size: 90px;line-height:1.2em;letter-spacing:2px;" }] }
                ]
            }
        ]
    }
    a.box = {
        isDefault: true,
        name: "Box",
        color: null,
        category: "song",
        items: [
            {
                style: "top:387.50px;left:51px;height:307.15px;width:1820px;border-width:8px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;",
                align: "",
                lines: [
                    { align: "", text: [{ value: "1", style: "font-weight: bold;font-size: 80px;line-height:1.1em;letter-spacing:2px;text-shadow: 0 0 #000000;" }] },
                    { align: "", text: [{ value: "2", style: "font-weight: bold;font-size: 80px;line-height:1.1em;letter-spacing:2px;text-shadow: 0 0 #000000;" }] },
                    { align: "", text: [{ value: "3", style: "font-weight: bold;font-size: 80px;line-height:1.1em;letter-spacing:2px;text-shadow: 0 0 #000000;" }] }
                ]
            }
        ]
    }
    a.trendy = {
        isDefault: true,
        name: "Trendy",
        color: null,
        category: "song",
        items: [
            {
                style: "top:310px;left:100px;height:460px;width:1720px;",
                align: "",
                specialStyle: { lineGap: 20, lineBg: "#000000" },
                lines: [
                    { align: "", text: [{ value: "1", style: "font-size: 60px;line-height:1.5em;letter-spacing:2px;text-shadow: 0 0 #000000;" }] },
                    { align: "", text: [{ value: "2", style: "font-size: 60px;line-height:1.5em;letter-spacing:2px;text-shadow: 0 0 #000000;" }] }
                ]
            }
        ]
    }
    a.trendy_curved = {
        isDefault: true,
        name: "Trendy Curved",
        color: null,
        category: "song",
        items: [
            {
                lines: [
                    { align: "", text: [{ value: "1", style: "font-size: 100px;text-shadow: 0px 0px 0px #000000;white-space: nowrap;line-height: 1.7em;" }] },
                    { align: "", text: [{ value: "2", style: "font-size: 100px;text-shadow: 0px 0px 0px #000000;white-space: nowrap;line-height: 1.7em;" }] }
                ],
                style: "top:310.50px;left:50.00px;height:460.36px;width:1820px;padding:50px;border-radius:50px;",
                align: "",
                specialStyle: { lineBg: "rgb(0 0 0 / 1);", lineGap: 15, lineRadius: 30 }
            }
        ]
    }
    a.fade = {
        isDefault: true,
        name: "Fade",
        color: null,
        category: "song",
        items: [
            {
                style: "top:200px;left:0px;height:682px;width:1920px;background:linear-gradient(0deg, transparent 0%, rgba(0,0,0,0.5) 20%, rgba(0,0,0,0.5) 80%, transparent 100%);",
                align: "",
                lines: [
                    { align: "", text: [{ value: "1", style: "font-size: 100px;" }] },
                    { align: "", text: [{ value: "2", style: "font-size: 100px;" }] },
                    { align: "", text: [{ value: "3", style: "font-size: 100px;" }] },
                    { align: "", text: [{ value: "4", style: "font-size: 100px;" }] }
                ]
            }
        ]
    }

    // lower thirds
    a.lowerThird = {
        isDefault: true,
        name: "Lower Third",
        color: "#800080",
        category: "song",
        items: [
            {
                style: "top: 820px;left: 50px;width: 1820px;height: 220px;",
                align: "",
                textFit: "shrinkToFit",
                lines: [{ align: "", text: [{ value: "1", style: "font-size: 70px;font-weight: bold;text-transform:uppercase;" }] }]
            }
        ]
    }
    a.lowerThirdWhite = {
        isDefault: true,
        name: "Lower Third White",
        color: "#800080",
        category: "song",
        items: [
            {
                style: "top: 820px;left: 50px;width: 1820px;height: 220px;background-color: #FFFFFF;border-radius:20px;padding:25px;border-color: #000000;border-style: solid;border-width: 5px;",
                align: "",
                textFit: "shrinkToFit",
                lines: [{ align: "", text: [{ value: "1", style: "color: #000000;font-size: 70px;font-weight: bold;text-shadow: 0px 0px 0px #000000;" }] }]
            }
        ]
    }
    a.lowerThirdBlue = {
        isDefault: true,
        name: "Lower Third Blue",
        color: "#800080",
        category: "song",
        items: [
            {
                style: "top: 820px;left: 50px;width: 1820px;height: 220px;background: linear-gradient(340deg, rgba(16,28,65) 0%, rgba(18,75,135) 40%, rgba(68,135,196) 76%, rgba(107,212,240) 100%);padding: 25px;border-color: #000000;border-style: solid;border-width: 5px;",
                actions: { transition: { type: "none", duration: 0, easing: "linear" } },
                align: "",
                textFit: "shrinkToFit",
                lines: [{ align: "text-align: left;", text: [{ value: "1", style: "font-size: 80px;font-weight: bold;text-shadow: 0px 0px 0px #000000;" }] }]
            }
        ]
    }
    a.lowerThirdColor = {
        isDefault: true,
        name: "Lower Third Color",
        color: "#800080",
        category: "song",
        items: [
            {
                style: "top: 820px;left: 50px;width: 1820px;height: 220px;background: linear-gradient(340deg, rgb(154, 12, 114) 0%, rgb(108, 4, 129) 20%, rgb(105, 33, 193) 40%, rgba(33,88,193,1) 80%, rgb(14, 177, 174) 100%);padding: 25px;border-color: #000000;border-style: solid;border-width: 5px;",
                actions: { transition: { type: "none", duration: 0, easing: "linear" } },
                align: "",
                textFit: "shrinkToFit",
                lines: [{ align: "text-align: left;", text: [{ value: "1", style: "font-size: 80px;font-weight: bold;text-shadow: 0px 0px 0px #000000;" }] }]
            }
        ]
    }
    a.lowerThirdPastel = {
        isDefault: true,
        name: "Lower Third Pastel",
        color: "#800080",
        category: "song",
        items: [
            {
                style: "top: 820px;left: 50px;width: 1820px;height: 220px;background: linear-gradient(340deg, rgba(199,213,255) 0%, rgba(219,187,245) 34%, rgba(137,224,226) 76%, rgba(189,254,220) 100%);padding: 25px;border-color: #000000;border-style: solid;border-width: 5px;",
                actions: { transition: { type: "none", duration: 0, easing: "linear" } },
                align: "",
                textFit: "shrinkToFit",
                lines: [{ align: "text-align: left;", text: [{ value: "1", style: "font-size: 80px;font-weight: bold;text-shadow: 0px 0px 0px #000000;color: #000000;" }] }]
            }
        ]
    }

    // blue theme
    a.blueHeader = {
        isDefault: true,
        name: "Blue Header",
        color: "#2957ff",
        category: "presentation",
        items: [
            // 1080 x 1920
            {
                style: "left:720px;top:640px;width:1130px;height:210px;",
                align: "",
                lines: [{ align: "text-align: left;", text: [{ value: "1", style: "font-weight:bold;font-family:Arial;line-height:1.2em;font-size:120px;" }] }]
            },
            {
                style: "left:720px;top:850px;width:1130px;height:60px;",
                align: "",
                lines: [{ align: "text-align: left;", text: [{ value: "2", style: "color:#ffffff;font-size:50px;" }] }]
            },
            {
                style: "left:-850px;top:-600px;width:1600px;height:1600px;background-color:#2957ff;transform:rotate(30deg);",
                align: "",
                lines: [{ align: "", text: [{ value: "", style: "" }] }]
            }
        ]
    }
    a.blueMain = {
        isDefault: true,
        name: "Blue Content",
        color: "#2957ff",
        category: "presentation",
        items: [
            // 1080 x 1920
            {
                style: "left:550px;top:50px;width:1320px;height:980px;",
                align: "",
                lines: [
                    { align: "text-align: left", text: [{ value: "1", style: "font-weight:bold;font-family:Arial;font-size:80px;line-height:1.2em;" }] },
                    { align: "text-align: left", text: [{ value: "2", style: "font-weight:bold;font-family:Arial;font-size:80px;line-height:1.2em;" }] },
                    { align: "text-align: left", text: [{ value: "3", style: "font-weight:bold;font-family:Arial;font-size:80px;line-height:1.2em;" }] },
                    { align: "text-align: left", text: [{ value: "4", style: "font-weight:bold;font-family:Arial;font-size:80px;line-height:1.2em;" }] },
                    { align: "text-align: left", text: [{ value: "5", style: "font-weight:bold;font-family:Arial;font-size:80px;line-height:1.2em;" }] }
                ]
            },
            {
                style: "left:0px;top:0px;width:500px;height:1080px;background-color: #2957ff;",
                align: "",
                lines: [{ align: "", text: [{ value: "", style: "" }] }]
            }
            // {
            //   style: "left:500px;top:0px;width:1420px;height:1080px;background-color: #ffffff;",
            //   align: "",
            //   lines: [{ align: "", text: [{ value: "", style: "" }] }],
            // },
        ]
    }
    a.bullets = {
        isDefault: true,
        name: "Bullets",
        color: "#747680",
        category: "presentation",
        items: [
            {
                style: DEFAULT_ITEM_STYLE,
                align: "",
                list: { enabled: true },
                lines: [
                    { align: "text-align: left", text: [{ value: "Bullet 1", style: "font-size: 100px;font-weight: bold;line-height:1.2em;" }] },
                    { align: "text-align: left", text: [{ value: "Bullet 2", style: "font-size: 100px;font-weight: bold;line-height:1.2em;" }] },
                    { align: "text-align: left", text: [{ value: "Bullet 3", style: "font-size: 100px;font-weight: bold;line-height:1.2em;" }] }
                ]
            }
        ]
    }

    return { ...a, ...getDefaultScriptureTemplates() }
}

function getDefaultScriptureTemplates() {
    const a: Record<string, Template> = {}

    // text
    a.brackets = {
        isDefault: true,
        name: "Brackets",
        color: "#515151",
        category: "scripture",
        settings: { mode: "text" },
        items: [
            {
                style: DEFAULT_ITEM_STYLE,
                align: "",
                lines: [{ align: "", text: [{ value: "[Brackets]", style: "font-style: italic;color: rgb(255 255 255 / 0.6);" }] }]
            }
        ]
    }
    a.parentheses = {
        isDefault: true,
        name: "Parentheses",
        color: "#515151",
        category: "scripture",
        settings: { mode: "text" },
        items: [
            {
                style: DEFAULT_ITEM_STYLE,
                align: "",
                lines: [{ align: "", text: [{ value: "(Parentheses)", style: "font-weight: normal;color: rgb(255 255 255 / 0.8);" }] }]
            }
        ]
    }

    // scripture
    a.scripture = {
        isDefault: true,
        name: translateText("category.scripture"),
        color: "#876543",
        category: "scripture",
        settings: {
            mode: "scripture",
            styleOverrides: [
                { id: "brackets", pattern: "/\\[(.*?)\\]/", templateId: "brackets" },
                { id: "parentheses", pattern: "/\\((.*?)\\)/", templateId: "parentheses" }
            ]
        },
        items: [
            {
                // textFit: "shrinkToFit",
                style: "top: 30px;left: 30px;width: 1860px;height: 865px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;",
                align: "",
                lines: [
                    {
                        align: "text-align: left;",
                        text: [
                            { value: "{scripture_number} ", style: "font-size: 40px;color: rgb(255 255 255 / 0.6);" },
                            { value: "{scripture_text}", style: "font-size: 80px;" }
                        ]
                    }
                ]
            },
            {
                style: "top: 900px;left: 30px;width: 1860px;height: 150px;",
                align: "",
                lines: [
                    { align: "", text: [{ value: "{scripture_reference}", style: "font-size: 55px;color: rgb(255 255 255 / 0.8);" }] },
                    { align: "", text: [{ value: "{scripture_name}", style: "font-size: 40px;color: rgb(255 255 255 / 0.7);" }] }
                ]
            }
        ]
    }
    a.scripture_2 = {
        isDefault: true,
        name: translateText("category.scripture 2"),
        color: "#876543",
        category: "scripture",
        settings: { mode: "scripture" },
        items: [
            {
                // textFit: "shrinkToFit",
                style: "top: 40px;left: 30px;width: 1860px;height: 400px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                align: "",
                lines: [
                    {
                        align: "text-align: left;",
                        text: [
                            { value: "{scripture1_number} ", style: "font-size: 35px;color: rgb(255 255 255 / 0.6);" },
                            { value: "{scripture1_text}", style: "font-size: 70px;" }
                        ]
                    }
                ]
            },
            {
                // textFit: "shrinkToFit",
                style: "top: 475px;left: 30px;width: 1860px;height: 400px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                align: "",
                lines: [
                    {
                        align: "text-align: left;",
                        text: [
                            { value: "{scripture2_number} ", style: "font-size: 35px;color: rgb(255 255 255 / 0.6);" },
                            { value: "{scripture2_text}", style: "font-size: 70px;" }
                        ]
                    }
                ]
            },
            {
                style: "top: 900px;left: 30px;width: 1860px;height: 150px;",
                align: "",
                lines: [
                    { align: "", text: [{ value: "{scripture_reference}", style: "font-size: 55px;color: rgb(255 255 255 / 0.8);" }] },
                    { align: "", text: [{ value: "{scripture_name}", style: "font-size: 40px;color: rgb(255 255 255 / 0.7);" }] }
                ]
            }
        ]
    }
    a.scripture_3 = {
        isDefault: true,
        name: translateText("category.scripture 3"),
        color: "#876543",
        category: "scripture",
        settings: { mode: "scripture" },
        items: [
            {
                // textFit: "shrinkToFit",
                style: "top: 40px;left: 30px;width: 1860px;height: 250px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                align: "",
                lines: [
                    {
                        align: "text-align: left;",
                        text: [
                            { value: "{scripture1_number} ", style: "font-size: 30px;color: rgb(255 255 255 / 0.6);" },
                            { value: "{scripture1_text}", style: "font-size: 60px;" }
                        ]
                    }
                ]
            },
            {
                // textFit: "shrinkToFit",
                style: "top: 320px;left: 30px;width: 1860px;height: 250px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                align: "",
                lines: [
                    {
                        align: "text-align: left;",
                        text: [
                            { value: "{scripture2_number} ", style: "font-size: 30px;color: rgb(255 255 255 / 0.6);" },
                            { value: "{scripture2_text}", style: "font-size: 60px;" }
                        ]
                    }
                ]
            },
            {
                // textFit: "shrinkToFit",
                style: "top: 600px;left: 30px;width: 1860px;height: 250px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                align: "",
                lines: [
                    {
                        align: "text-align: left;",
                        text: [
                            { value: "{scripture3_number} ", style: "font-size: 30px;color: rgb(255 255 255 / 0.6);" },
                            { value: "{scripture3_text}", style: "font-size: 60px;" }
                        ]
                    }
                ]
            },
            {
                style: "top: 900px;left: 30px;width: 1860px;height: 150px;",
                align: "",
                lines: [
                    { align: "", text: [{ value: "{scripture_reference}", style: "font-size: 55px;color: rgb(255 255 255 / 0.8);" }] },
                    { align: "", text: [{ value: "{scripture_name}", style: "font-size: 40px;color: rgb(255 255 255 / 0.7);" }] }
                ]
            }
        ]
    }
    a.scripture_4 = {
        isDefault: true,
        name: translateText("category.scripture 4"),
        color: "#876543",
        category: "scripture",
        settings: { mode: "scripture" },
        items: [
            {
                // textFit: "shrinkToFit",
                style: "top: 40px;left: 30px;width: 1860px;height: 200px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                align: "",
                lines: [
                    {
                        align: "text-align: left;",
                        text: [
                            { value: "{scripture1_number} ", style: "font-size: 30px;color: rgb(255 255 255 / 0.6);" },
                            { value: "{scripture1_text}", style: "font-size: 60px;" }
                        ]
                    }
                ]
            },
            {
                // textFit: "shrinkToFit",
                style: "top: 250px;left: 30px;width: 1860px;height: 200px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                align: "",
                lines: [
                    {
                        align: "text-align: left;",
                        text: [
                            { value: "{scripture2_number} ", style: "font-size: 30px;color: rgb(255 255 255 / 0.6);" },
                            { value: "{scripture2_text}", style: "font-size: 60px;" }
                        ]
                    }
                ]
            },
            {
                // textFit: "shrinkToFit",
                style: "top: 460px;left: 30px;width: 1860px;height: 200px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                align: "",
                lines: [
                    {
                        align: "text-align: left;",
                        text: [
                            { value: "{scripture3_number} ", style: "font-size: 30px;color: rgb(255 255 255 / 0.6);" },
                            { value: "{scripture3_text}", style: "font-size: 60px;" }
                        ]
                    }
                ]
            },
            {
                // textFit: "shrinkToFit",
                style: "top: 670px;left: 30px;width: 1860px;height: 200px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                align: "",
                lines: [
                    {
                        align: "text-align: left;",
                        text: [
                            { value: "{scripture4_number} ", style: "font-size: 30px;color: rgb(255 255 255 / 0.6);" },
                            { value: "{scripture4_text}", style: "font-size: 60px;" }
                        ]
                    }
                ]
            },
            {
                style: "top: 900px;left: 30px;width: 1860px;height: 150px;",
                align: "",
                lines: [
                    { align: "", text: [{ value: "{scripture_reference}", style: "font-size: 55px;color: rgb(255 255 255 / 0.8);" }] },
                    { align: "", text: [{ value: "{scripture_name}", style: "font-size: 40px;color: rgb(255 255 255 / 0.7);" }] }
                ]
            }
        ]
    }
    a.scriptureLT = {
        isDefault: true,
        name: translateText("category.scripture Lower Third"),
        color: "#876543",
        category: "scripture",
        settings: { mode: "scripture" },
        items: [
            {
                style: "left:30px;top:765px;width:1860px;height:238px;border-radius:20px;padding:25px;background-color:#FFFFFF;",
                align: "",
                lines: [
                    {
                        align: "text-align: left;",
                        text: [
                            { value: "{scripture_number} ", style: "font-size: 40px;color: rgb(255 255 255 / 0.6);text-shadow:0px 0px 0px #000000;" },
                            { value: "{scripture_text}", style: "font-size: 80px;color:#000000;text-shadow:0px 0px 0px #000000;" }
                        ]
                    }
                ],
                auto: true
            },
            {
                style: "left:1442px;top:960px;width:448px;height:88px;background-color:#ff851b;padding:3px;border-radius:10px;",
                align: "",
                lines: [
                    { align: "", text: [{ value: "{scripture_reference}", style: "text-shadow:0px 0px 0px #000000;font-size:40px;" }] },
                    { align: "", text: [{ value: "{scripture_name}", style: "text-shadow:0px 0px 0px #000000;font-size:30px;" }] }
                ],
                auto: true
            }
        ]
    }
    a.scriptureLT_2 = {
        isDefault: true,
        name: translateText("category.scripture Lower Third 2"),
        color: "#876543",
        category: "scripture",
        settings: { mode: "scripture" },
        items: [
            {
                style: "left:30px;top:765px;width:1860px;height:120px;border-radius:20px;padding:25px;background-color:#FFFFFF;",
                align: "",
                lines: [
                    {
                        align: "text-align: left;",
                        text: [
                            { value: "{scripture1_number} ", style: "font-size: 40px;color:rgb(255 255 255 / 0.6);text-shadow:0px 0px 0px #000000;" },
                            { value: "{scripture1_text}", style: "font-size: 80px;color:#000000;text-shadow:0px 0px 0px #000000;" }
                        ]
                    }
                ],
                auto: true
            },
            {
                style: "left:30px;top:885px;width:1860px;height:120px;border-radius:20px;padding:25px;background-color:#DDDDDD;",
                align: "",
                lines: [
                    {
                        align: "text-align: left;",
                        text: [
                            { value: "{scripture2_number} ", style: "font-size: 40px;color:rgb(255 255 255 / 0.6);text-shadow:0px 0px 0px #000000;" },
                            { value: "{scripture2_text}", style: "font-size: 80px;color:#000000;text-shadow:0px 0px 0px #000000;" }
                        ]
                    }
                ],
                auto: true
            },
            {
                style: "left:1442px;top:960px;width:448px;height:88px;background-color:#ff851b;padding:3px;border-radius:10px;",
                align: "",
                lines: [
                    { align: "", text: [{ value: "{scripture_reference}", style: "text-shadow:0px 0px 0px #000000;font-size:40px;" }] },
                    { align: "", text: [{ value: "{scripture_name}", style: "text-shadow:0px 0px 0px #000000;font-size:30px;" }] }
                ],
                auto: true
            }
        ]
    }

    return a
}

export function createDefaultShow() {
    setShow("default", {
        name: translateText("example.welcome"),
        category: "presentation",
        settings: {
            activeLayout: "default",
            template: "header"
        },
        timestamps: {
            created: new Date().getTime(), // new Date("2022-01-01").getTime(),
            modified: null,
            used: null
        },
        quickAccess: {},
        meta: {},
        slides: {
            one: {
                group: "",
                color: null,
                settings: {},
                notes: "",
                items: [
                    {
                        style: "top:428.50px;left:208.50px;height:220px;width:1500px;",
                        align: "",
                        lines: [{ align: "", text: [{ value: translateText("example.welcome!"), style: "font-size: 180px;font-weight: bold;" }] }]
                    }
                ]
            }
        },
        layouts: {
            default: {
                name: translateText("example.default"),
                notes: "",
                slides: [{ id: "one" }]
            }
        },
        media: {}
    })
}

export function createDoubleTemplate() {
    templates.update((a) => {
        a.double = {
            isDefault: true,
            name: "Double",
            color: null, // "#FF6543",
            category: "song",
            items: [
                {
                    style: "top: 550px;left: 30px;width: 1860px;height: 500px;",
                    align: "",
                    lines: [{ align: "", text: [{ value: "2", style: "font-size: 80px;color: #dddddd;" }] }]
                },
                {
                    style: "top: 30px;left: 30px;width: 1860px;height: 500px;",
                    align: "",
                    lines: [{ align: "", text: [{ value: "1", style: "font-size: 80px;" }] }]
                }
            ]
        }

        return a
    })
}

// DELETED

export function getDefaultElements() {
    if (get(activePopup) === "initialize") return

    // deleted default elements are now logged, but were not previously
    // this will get & store the deleted elements from pre 1.5.3
    getDeletedTemplates()
    getDeletedOverlays()
    getDeletedEffects()

    // check if there's any missing element that should be added, that is not deleted
    createDefaultTemplates()
    createDefaultOverlays()
    createDefaultEffects()
}

// "message" is removed
const templateIds = ["metadata", "message", "header", "text", "big", "default", "small", "bigBold", "defaultBold", "smallBold", "blur_box", "faded", "box", "trendy", "trendy_curved", "fade", "lowerThird", "lowerThirdWhite", "lowerThirdBlue", "lowerThirdColor", "lowerThirdPastel", "scripture", "scripture_2", "scripture_3", "scripture_4", "scriptureLT", "scriptureLT_2", "blueHeader", "blueMain", "bullets"]
function getDeletedTemplates() {
    if (get(deletedDefaults).templates) return

    const deletedIds = templateIds.filter((id) => !get(templates)[id])
    deletedDefaults.update((a) => {
        a.templates = deletedIds
        return a
    })
}

const overlayIds = ["watermark", "visual", "clock", "clock_analog", "name", "rounded", "vignette"]
function getDeletedOverlays() {
    if (get(deletedDefaults).overlays) return

    const deletedIds = overlayIds.filter((id) => !get(overlays)[id])
    deletedDefaults.update((a) => {
        a.overlays = deletedIds
        return a
    })
}

const effectIds = ["ocean", "spotlights", "rain", "fireworks"]
function getDeletedEffects() {
    if (get(deletedDefaults).effects) return

    const deletedIds = effectIds.filter((id) => !get(effects)[id])
    deletedDefaults.update((a) => {
        a.effects = deletedIds
        return a
    })
}
