import { get } from "svelte/store"
import type { Effect } from "../../types/Effects"
import type { MainFilePaths } from "../../types/Main"
import type { Overlay, Template } from "../../types/Show"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { setShow } from "../components/helpers/setShow"
import { activePopup, audioFolders, effects, folders, mediaFolders, outputs, overlays, projects, remotePassword, shows, special, templates, variables } from "../stores"
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

    save()
}

const randomNumber = (from: number, to: number): number => Math.floor(Math.random() * (to - from)) + from

// OVERLAYS

export function setExampleEffects() {
    special.update((a) => {
        delete a.deletedEffects
        return a
    })

    effects.set({ ...get(effects), ...getDefaultEffects() })
}

function createDefaultEffects() {
    const deletedIds = get(special).deletedEffects || []
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

    return a
}

export function setExampleOverlays() {
    special.update((a) => {
        delete a.deletedOverlays
        return a
    })

    overlays.set({ ...get(overlays), ...getDefaultOverlays() })
}

function createDefaultOverlays() {
    const deletedIds = get(special).deletedOverlays || []
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
    special.update((a) => {
        delete a.deletedTemplates
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

    special.update((a) => {
        a.deletedTemplates = (get(special).deletedTemplates || []).filter((id) => !Object.keys(templatesList).includes(id))
        return a
    })

    templateCategories.update((a) => {
        a.scripture = { default: true, name: "category.scripture", icon: "scripture" }
        return a
    })

    templates.set({ ...get(templates), ...templatesList })
}

function createDefaultTemplates() {
    const deletedIds = get(special).deletedTemplates || []
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
    // message
    a.message = {
        isDefault: true,
        name: translateText("meta.message"),
        color: null,
        category: "song", // "metadata"
        items: [
            {
                style: "top: 50px;left: 30px;width: 1860px;height: 150px;",
                align: "",
                lines: [{ align: "", text: [{ value: translateText("meta.message"), style: "font-size: 50px;color: rgb(255 255 255 / 0.8);text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);" }] }]
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

const templateIds = ["metadata", "message", "header", "text", "big", "default", "small", "bigBold", "defaultBold", "smallBold", "blur_box", "faded", "box", "trendy", "trendy_curved", "fade", "lowerThird", "lowerThirdWhite", "lowerThirdBlue", "lowerThirdColor", "lowerThirdPastel", "scripture", "scripture_2", "scripture_3", "scripture_4", "scriptureLT", "scriptureLT_2", "blueHeader", "blueMain", "bullets"]
function getDeletedTemplates() {
    if (get(special).deletedTemplates) return

    const deletedIds = templateIds.filter((id) => !get(templates)[id])
    special.update((a) => {
        a.deletedTemplates = deletedIds
        return a
    })
}

const overlayIds = ["watermark", "visual", "clock", "clock_analog", "name", "rounded", "vignette"]
function getDeletedOverlays() {
    if (get(special).deletedOverlays) return

    const deletedIds = overlayIds.filter((id) => !get(overlays)[id])
    special.update((a) => {
        a.deletedOverlays = deletedIds
        return a
    })
}

const effectIds = ["ocean", "spotlights", "rain", "fireworks"]
function getDeletedEffects() {
    if (get(special).deletedEffects) return

    const deletedIds = effectIds.filter((id) => !get(effects)[id])
    special.update((a) => {
        a.deletedEffects = deletedIds
        return a
    })
}
