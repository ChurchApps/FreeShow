import { get } from "svelte/store"
import type { MainFilePaths } from "../../types/Main"
import { DEFAULT_ITEM_STYLE } from "../components/edit/scripts/itemHelpers"
import { setShow } from "../components/helpers/setShow"
import { audioFolders, dictionary, effects, folders, mediaFolders, outputs, overlays, projects, remotePassword, shows, templates, variables } from "../stores"
import { stageShows, templateCategories } from "./../stores"
import { save } from "./save"

export function createData(paths: MainFilePaths) {
    if (!get(shows).default) {
        createDefaultShow()
    }

    stageShows.set({
        default: {
            name: get(dictionary).example?.default || "Stage",
            disabled: false,
            password: "",
            settings: {},
            items: {
                textCurrent: {
                    type: "slide_text",
                    style: "width:1870px;height:680px;inset-inline-start:25px;top:25px;font-family: Arial;font-weight:bold;",
                    align: ""
                },
                textNext: {
                    type: "slide_text",
                    slideOffset: 1,
                    lineCount: 2,
                    style: "width:1870px;height:330px;inset-inline-start:25px;top:725px;font-family: Arial;font-weight:bold;color:#aaaaaa;",
                    align: ""
                }
            }
        }
    })

    setExampleEffects()

    setExampleOverlays()

    folders.update((a) => {
        a.default = { name: get(dictionary).example?.meetings || "Meetings", parent: "/" }
        return a
    })
    projects.update((a) => {
        a.default = {
            name: get(dictionary).example?.example || "Example",
            created: new Date("2022-01-01").getTime(),
            parent: "default",
            shows: [{ id: "default" }, { id: "section", type: "section", name: get(dictionary).example?.example || "Example", notes: get(dictionary).example?.example_note || "Write notes here" }]
        }
        return a
    })

    // TODO: translate templates
    setExampleTemplates()
    mediaFolders.update((a) => {
        a.pictures = { name: "category.pictures", icon: "folder", path: paths.pictures, default: true }
        a.videos = { name: "category.videos", icon: "folder", path: paths.videos, default: true }
        return a
    })
    audioFolders.update((a) => {
        a.music = { name: "category.music", icon: "folder", path: paths.music, default: true }
        return a
    })

    remotePassword.set(randomNumber(1000, 9999).toString())

    // translate names set in defaults.ts
    if (get(outputs).default?.name === "Primary") {
        outputs.update((a) => {
            a.default.name = get(dictionary).theme?.primary || "Primary"
            return a
        })
    }
    if (get(variables).default?.name === "Counter") {
        variables.update((a) => {
            a.default.name = get(dictionary).variables?.number || "Counter"
            return a
        })
    }

    save()
}

const randomNumber = (from: number, to: number): number => Math.floor(Math.random() * (to - from)) + from

export function setExampleEffects() {
    effects.update((a) => {
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
    })
}

export function setExampleOverlays() {
    overlays.update((a) => {
        a.watermark = {
            isDefault: true,
            name: get(dictionary).example?.watermark || "Watermark",
            color: "#F0008C",
            category: "notice",
            items: [
                {
                    style: "top:870px;inset-inline-start:1248px;height:170px;width:630px;",
                    align: "align-items:flex-end;",
                    lines: [{ align: "text-align: end;", text: [{ value: "FreeShow", style: "font-size:50px;font-weight:bold;color:#F0008C;" }] }]
                }
            ]
        }
        a.visual = {
            isDefault: true,
            name: get(dictionary).example?.recording || "Recording",
            color: "red",
            category: "visuals",
            // TODO: create box
            items: [
                { style: "top:35px;inset-inline-start:36.5px;height:1008.21px;width:1847.62px;border:4px solid white;" },
                { style: "top:80px;inset-inline-start:80px;height:40px;width:40px;background-color:red;border-radius:50%;" },
                { style: "top:80px;inset-inline-start:140px;height:40px;width:100px;", lines: [{ align: "", text: [{ value: "REC", style: "font-size:40px;" }] }] }
            ]
        }
        a.clock = {
            isDefault: true,
            name: get(dictionary).example?.clock || "Clock",
            color: "dodgerblue",
            category: "visuals",
            items: [{ style: "top:70px;inset-inline-start:1450px;height:150px;width:470px;", type: "clock", clock: { type: "digital", dateFormat: "none", showTime: true, seconds: false } }]
        }
        a.clock_analog = {
            isDefault: true,
            name: "Clock (Analog)",
            color: "dodgerblue",
            category: "visuals",
            items: [
                {
                    style: "top:72.50px;inset-inline-start:50px;height:936.40px;width:936.40px;font-family:CMGSans;color:#FFFFFF;left:492.00px;border-radius:500px;border-width:2px;background-color:rgb(0 0 0 / 0.5);",
                    type: "clock",
                    clock: { type: "analog", dateFormat: "none", showTime: true, seconds: false }
                }
            ]
        }
        a.name = {
            isDefault: true,
            name: get(dictionary).inputs?.name || "Name",
            color: "#0b57a2",
            category: "visuals",
            displayDuration: 4,
            items: [
                { style: "top:875px;inset-inline-start:80px;height:135px;width:750px;background-color: #0b57a2;box-shadow: 2px 2px 10px 0px rgb(0 0 0 / 0.8);" },
                { style: "top:875px;inset-inline-start:80px;height:135px;width:50px;background-color: #74cbfb;" },
                {
                    style: "top:935px;inset-inline-start:130px;height:75px;width:700px;background-color: #0b57a2;padding: 0 10px;",
                    actions: {
                        showTimer: 1,
                        transition: { type: "slide", duration: 500, easing: "cubic" }
                    },
                    type: "text",
                    lines: [{ align: "text-align: start", text: [{ value: "Name Surname", style: "font-family: Arial;font-size: 70px;text-shadow: 0 0 #000000;" }] }]
                },
                {
                    style: "top:875px;inset-inline-start:130px;height:60px;width:700px;background-color: #006fcf;padding: 0 10px;",
                    actions: {
                        transition: { type: "slide", duration: 500, easing: "cubic" }
                    },
                    type: "text",
                    lines: [{ align: "text-align: start", text: [{ value: "Title", style: "font-family: Arial;font-size: 40px;font-weight: bold;text-transform:uppercase;text-shadow: 0 0 #000000;" }] }]
                }
            ]
        }
        a.rounded = {
            isDefault: true,
            name: get(dictionary).example?.rounded || "Rounded",
            color: null,
            category: "visuals",
            locked: true,
            items: [
                { style: "top:0px;inset-inline-start:0px;height:50px;width:50px;background:radial-gradient(circle at 100% 100%, transparent 50px, black 0px);" },
                { style: "top:0px;inset-inline-end:0px;height:50px;width:50px;background:radial-gradient(circle at 0 100%, transparent 50px, black 0px);" },
                { style: "bottom:0px;inset-inline-end:0px;height:50px;width:50px;background:radial-gradient(circle at 0 0, transparent 50px, black 0px);" },
                { style: "bottom:0px;inset-inline-start:0px;height:50px;width:50px;background:radial-gradient(circle at 100% 0, transparent 50px, black 0px);" }
            ]
        }
        a.vignette = {
            isDefault: true,
            name: "Vignette",
            color: "#dddddd",
            category: "visuals",
            locked: true,
            items: [{ style: "top: -180px;inset-inline-start: -200px;width: 2320px;height: 1440px;border-radius: 500px;box-shadow: inset 0px 0px 248px 0px #FFFFFF;" }]
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
    })
}

export function setExampleTemplates() {
    templateCategories.update((a) => {
        a.scripture = { default: true, name: "category.scripture", icon: "scripture" }
        return a
    })
    templates.update((a) => {
        // metadata
        a.metadata = {
            isDefault: true,
            name: get(dictionary).tools?.metadata || "Metadata",
            color: null,
            category: null,
            items: [
                {
                    style: "top: 910px;inset-inline-start: 30px;width: 1860px;height: 150px;opacity: 0.8;",
                    align: "",
                    lines: [{ align: "", text: [{ value: get(dictionary).tools?.metadata || "Metadata", style: "font-size: 30px;text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);" }] }]
                }
            ]
        }
        // message
        a.message = {
            isDefault: true,
            name: get(dictionary).meta?.message || "Message",
            color: null,
            category: null,
            items: [
                {
                    style: "top: 50px;inset-inline-start: 30px;width: 1860px;height: 150px;opacity: 0.8;",
                    align: "",
                    lines: [{ align: "", text: [{ value: get(dictionary).meta?.message || "Message", style: "font-size: 50px;text-shadow: 2px 2px 4px rgb(0 0 0 / 80%);" }] }]
                }
            ]
        }
        // presentation
        a.header = {
            isDefault: true,
            name: get(dictionary).example?.header || "Header",
            color: null,
            category: "presentation",
            items: [
                {
                    style: "top:428.50px;inset-inline-start:208.50px;height:220px;width:1500px;",
                    align: "",
                    lines: [{ align: "", text: [{ value: get(dictionary).example?.header || "Header", style: "font-size: 180px;font-weight: bold;" }] }]
                }
            ]
        }
        a.text = {
            isDefault: true,
            name: get(dictionary).example?.text || "Text",
            color: null,
            category: "presentation",
            items: [
                {
                    style: "top:35px;inset-inline-start:50.5px;height:220px;width:1820px;",
                    align: "",
                    lines: [{ align: "text-align: start;", text: [{ value: get(dictionary).example?.header || "Header", style: "font-size: 120px;font-weight: bold;" }] }]
                },
                {
                    style: "top:290px;inset-inline-start:50.5px;height:750px;width:1820px;",
                    align: "",
                    lines: [{ align: "text-align: start;", text: [{ value: get(dictionary).example?.text || "Text", style: "font-size: 80px;" }] }]
                }
            ]
        }

        // lyrics
        a.big = {
            isDefault: true,
            name: get(dictionary).example?.big || "Big",
            color: null,
            category: "song",
            items: [
                {
                    style: DEFAULT_ITEM_STYLE,
                    align: "",
                    lines: [{ align: "", text: [{ value: get(dictionary).example?.big || "Big", style: "font-size: 120px;" }] }]
                }
            ]
        }
        a.default = {
            isDefault: true,
            name: get(dictionary).example?.default || "Default",
            color: null,
            category: "song",
            items: [
                {
                    style: DEFAULT_ITEM_STYLE,
                    align: "",
                    lines: [{ align: "", text: [{ value: get(dictionary).example?.default || "Default", style: "font-size: 100px;" }] }]
                }
            ]
        }
        a.small = {
            isDefault: true,
            name: get(dictionary).example?.small || "Small",
            color: null,
            category: "song",
            items: [
                {
                    style: DEFAULT_ITEM_STYLE,
                    align: "",
                    lines: [{ align: "", text: [{ value: get(dictionary).example?.small || "Small", style: "font-size: 80px;" }] }]
                }
            ]
        }
        a.bigBold = {
            isDefault: true,
            name: mergeTranslations("big", "bold", "Big Bold"),
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
                                    value: mergeTranslations("big", "bold", "Big Bold"),
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
            name: mergeTranslations("default", "bold", "Default Bold"),
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
                                    value: mergeTranslations("default", "bold", "Default Bold"),
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
            name: mergeTranslations("small", "bold", "Small Bold"),
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
                                    value: mergeTranslations("small", "bold", "Small Bold"),
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
                    style: "top:310px;inset-inline-start:0px;height:460px;width:1920px;background-color: rgb(0 0 0 / 0.5);backdrop-filter: blur(10px);",
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
                    style: "top:0px;inset-inline-start:0px;height:1080px;width:1920px;background-color: rgb(0 0 0 / 0.5);backdrop-filter: blur(10px);",
                    align: "",
                    actions: { transition: { type: "none", duration: 0, easing: "linear" } },
                    lines: []
                },
                {
                    style: "top:310px;inset-inline-start:0px;height:460px;width:1920px;",
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
                    style: "top:387.50px;inset-inline-start:51px;height:307.15px;width:1820px;border-width:8px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;",
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
                    style: "top:310px;inset-inline-start:100px;height:460px;width:1720px;",
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
                    style: "top:200px;inset-inline-start:0px;height:682px;width:1920px;background:linear-gradient(0deg, transparent 0%, rgba(0,0,0,0.5) 20%, rgba(0,0,0,0.5) 80%, transparent 100%);",
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
                    style: "top: 820px;inset-inline-start: 50px;width: 1820px;height: 220px;",
                    align: "",
                    auto: true,
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
                    style: "top: 820px;inset-inline-start: 50px;width: 1820px;height: 220px;background-color: #FFFFFF;border-radius:20px;padding:25px;border-color: #000000;border-style: solid;border-width: 5px;",
                    align: "",
                    auto: true,
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
                    style: "top: 820px;inset-inline-start: 50px;width: 1820px;height: 220px;background: linear-gradient(340deg, rgba(16,28,65) 0%, rgba(18,75,135) 40%, rgba(68,135,196) 76%, rgba(107,212,240) 100%);padding: 25px;border-color: #000000;border-style: solid;border-width: 5px;",
                    actions: { transition: { type: "none", duration: 0, easing: "linear" } },
                    align: "",
                    auto: true,
                    lines: [{ align: "text-align: start;", text: [{ value: "1", style: "font-size: 80px;font-weight: bold;text-shadow: 0px 0px 0px #000000;" }] }]
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
                    style: "top: 820px;inset-inline-start: 50px;width: 1820px;height: 220px;background: linear-gradient(340deg, rgb(154, 12, 114) 0%, rgb(108, 4, 129) 20%, rgb(105, 33, 193) 40%, rgba(33,88,193,1) 80%, rgb(14, 177, 174) 100%);padding: 25px;border-color: #000000;border-style: solid;border-width: 5px;",
                    actions: { transition: { type: "none", duration: 0, easing: "linear" } },
                    align: "",
                    auto: true,
                    lines: [{ align: "text-align: start;", text: [{ value: "1", style: "font-size: 80px;font-weight: bold;text-shadow: 0px 0px 0px #000000;" }] }]
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
                    style: "top: 820px;inset-inline-start: 50px;width: 1820px;height: 220px;background: linear-gradient(340deg, rgba(199,213,255) 0%, rgba(219,187,245) 34%, rgba(137,224,226) 76%, rgba(189,254,220) 100%);padding: 25px;border-color: #000000;border-style: solid;border-width: 5px;",
                    actions: { transition: { type: "none", duration: 0, easing: "linear" } },
                    align: "",
                    auto: true,
                    lines: [{ align: "text-align: start;", text: [{ value: "1", style: "font-size: 80px;font-weight: bold;text-shadow: 0px 0px 0px #000000;color: #000000;" }] }]
                }
            ]
        }

        // scripture
        a.scripture = {
            isDefault: true,
            name: get(dictionary).category?.scripture || "Scripture",
            color: "#876543",
            category: "scripture",
            items: [
                {
                    // auto: true,
                    style: "top: 30px;inset-inline-start: 30px;width: 1860px;height: 865px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;",
                    align: "",
                    lines: [{ align: "text-align: start;", text: [{ value: "1", style: "font-size: 80px;" }] }]
                },
                {
                    style: "top: 900px;inset-inline-start: 30px;width: 1860px;height: 150px;opacity: 0.8;",
                    align: "",
                    lines: [{ align: "", text: [{ value: "Meta", style: "font-size: 50px;" }] }]
                }
            ]
        }
        a.scripture_2 = {
            isDefault: true,
            name: (get(dictionary).category?.scripture || "Scripture") + " 2",
            color: "#876543",
            category: "scripture",
            items: [
                {
                    // auto: true,
                    style: "top: 40px;inset-inline-start: 30px;width: 1860px;height: 400px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: start;", text: [{ value: "1", style: "font-size: 70px;" }] }]
                },
                {
                    // auto: true,
                    style: "top: 475px;inset-inline-start: 30px;width: 1860px;height: 400px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: start;", text: [{ value: "2", style: "font-size: 70px;" }] }]
                },
                {
                    style: "top: 900px;inset-inline-start: 30px;width: 1860px;height: 150px;opacity: 0.8;",
                    align: "",
                    lines: [{ align: "", text: [{ value: "Meta", style: "font-size: 50px;" }] }]
                }
            ]
        }
        a.scripture_3 = {
            isDefault: true,
            name: (get(dictionary).category?.scripture || "Scripture") + " 3",
            color: "#876543",
            category: "scripture",
            items: [
                {
                    // auto: true,
                    style: "top: 40px;inset-inline-start: 30px;width: 1860px;height: 250px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: start;", text: [{ value: "1", style: "font-size: 60px;" }] }]
                },
                {
                    // auto: true,
                    style: "top: 320px;inset-inline-start: 30px;width: 1860px;height: 250px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: start;", text: [{ value: "2", style: "font-size: 60px;" }] }]
                },
                {
                    // auto: true,
                    style: "top: 600px;inset-inline-start: 30px;width: 1860px;height: 250px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: start;", text: [{ value: "3", style: "font-size: 60px;" }] }]
                },
                {
                    style: "top: 900px;inset-inline-start: 30px;width: 1860px;height: 150px;opacity: 0.8;",
                    align: "",
                    lines: [{ align: "", text: [{ value: "Meta", style: "font-size: 50px;" }] }]
                }
            ]
        }
        a.scripture_4 = {
            isDefault: true,
            name: (get(dictionary).category?.scripture || "Scripture") + " 4",
            color: "#876543",
            category: "scripture",
            items: [
                {
                    // auto: true,
                    style: "top: 40px;inset-inline-start: 30px;width: 1860px;height: 200px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: start;", text: [{ value: "1", style: "font-size: 60px;" }] }]
                },
                {
                    // auto: true,
                    style: "top: 250px;inset-inline-start: 30px;width: 1860px;height: 200px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: start;", text: [{ value: "2", style: "font-size: 60px;" }] }]
                },
                {
                    // auto: true,
                    style: "top: 460px;inset-inline-start: 30px;width: 1860px;height: 200px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: start;", text: [{ value: "3", style: "font-size: 60px;" }] }]
                },
                {
                    // auto: true,
                    style: "top: 670px;inset-inline-start: 30px;width: 1860px;height: 200px;background-color: rgb(0 0 0 / 0.4);border-radius: 20px;padding: 25px;border-width: 1px;border-color: #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: start;", text: [{ value: "4", style: "font-size: 60px;" }] }]
                },
                {
                    style: "top: 900px;inset-inline-start: 30px;width: 1860px;height: 150px;opacity: 0.8;",
                    align: "",
                    lines: [{ align: "", text: [{ value: "Meta", style: "font-size: 50px;" }] }]
                }
            ]
        }
        a.scriptureLT = {
            isDefault: true,
            name: (get(dictionary).category?.scripture || "Scripture") + " Lower Third",
            color: "#876543",
            category: "scripture",
            items: [
                {
                    style: "left:30px;top:765px;width:1860px;height:238px;border-radius:20px;padding:25px;background-color:#FFFFFF;",
                    align: "",
                    lines: [{ align: "text-align: start;", text: [{ value: "1", style: "font-size: 80px;color:#000000;text-shadow:0px 0px 0px #000000;" }] }],
                    auto: true
                },
                {
                    style: "left:1442px;top:960px;width:448px;height:88px;background-color:#ff851b;padding:3px;border-radius:10px;",
                    align: "",
                    lines: [{ align: "", text: [{ value: "Meta", style: "text-shadow:0px 0px 0px #000000;font-size:40px;" }] }],
                    auto: true
                }
            ]
        }
        a.scriptureLT_2 = {
            isDefault: true,
            name: (get(dictionary).category?.scripture || "Scripture") + " Lower Third 2",
            color: "#876543",
            category: "scripture",
            items: [
                {
                    style: "left:30px;top:765px;width:1860px;height:120px;border-radius:20px;padding:25px;background-color:#FFFFFF;",
                    align: "",
                    lines: [{ align: "text-align: start;", text: [{ value: "1", style: "font-size: 80px;color:#000000;text-shadow:0px 0px 0px #000000;" }] }],
                    auto: true
                },
                {
                    style: "left:30px;top:885px;width:1860px;height:120px;border-radius:20px;padding:25px;background-color:#DDDDDD;",
                    align: "",
                    lines: [{ align: "text-align: start;", text: [{ value: "2", style: "font-size: 80px;color:#000000;text-shadow:0px 0px 0px #000000;" }] }],
                    auto: true
                },
                {
                    style: "left:1442px;top:960px;width:448px;height:88px;background-color:#ff851b;padding:3px;border-radius:10px;",
                    align: "",
                    lines: [{ align: "", text: [{ value: "Meta", style: "text-shadow:0px 0px 0px #000000;font-size:40px;" }] }],
                    auto: true
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
                    style: "inset-inline-start:720px;top:640px;width:1130px;height:210px;",
                    align: "",
                    lines: [{ align: "text-align: start", text: [{ value: "1", style: "font-weight:bold;font-family:Arial;line-height:1.2em;font-size:120px;" }] }]
                },
                {
                    style: "inset-inline-start:720px;top:850px;width:1130px;height:60px;",
                    align: "",
                    lines: [{ align: "text-align: start", text: [{ value: "2", style: "color:#ffffff;font-size:50px;" }] }]
                },
                {
                    style: "inset-inline-start:-850px;top:-600px;width:1600px;height:1600px;background-color:#2957ff;transform:rotate(30deg);",
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
                    style: "inset-inline-start:550px;top:50px;width:1320px;height:980px;",
                    align: "",
                    lines: [
                        { align: "text-align: start", text: [{ value: "1", style: "font-weight:bold;font-family:Arial;font-size:80px;line-height:1.2em;" }] },
                        { align: "text-align: start", text: [{ value: "2", style: "font-weight:bold;font-family:Arial;font-size:80px;line-height:1.2em;" }] },
                        { align: "text-align: start", text: [{ value: "3", style: "font-weight:bold;font-family:Arial;font-size:80px;line-height:1.2em;" }] },
                        { align: "text-align: start", text: [{ value: "4", style: "font-weight:bold;font-family:Arial;font-size:80px;line-height:1.2em;" }] },
                        { align: "text-align: start", text: [{ value: "5", style: "font-weight:bold;font-family:Arial;font-size:80px;line-height:1.2em;" }] }
                    ]
                },
                {
                    style: "inset-inline-start:0px;top:0px;width:500px;height:1080px;background-color: #2957ff;",
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
                    lines: [
                        {
                            align: "text-align: start",
                            text: [
                                {
                                    value: "• Bullet 1",
                                    style: "font-size: 100px;font-weight: bold;line-height:1.2em;"
                                }
                            ]
                        },
                        {
                            align: "text-align: start",
                            text: [
                                {
                                    value: "• Bullet 2",
                                    style: "font-size: 100px;font-weight: bold;line-height:1.2em;"
                                }
                            ]
                        },
                        {
                            align: "text-align: start",
                            text: [
                                {
                                    value: "• Bullet 3",
                                    style: "font-size: 100px;font-weight: bold;line-height:1.2em;"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        return a
    })
    createDoubleTemplate()
}

export function createDefaultShow() {
    setShow("default", {
        name: get(dictionary).example?.welcome || "Welcome",
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
                        style: "top:428.50px;inset-inline-start:208.50px;height:220px;width:1500px;",
                        align: "",
                        lines: [{ align: "", text: [{ value: (get(dictionary).example?.welcome || "Welcome") + "!", style: "font-size: 180px;font-weight: bold;" }] }]
                    }
                ]
            }
        },
        layouts: {
            default: {
                name: get(dictionary).example?.default || "",
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
                    style: "top: 550px;inset-inline-start: 30px;width: 1860px;height: 500px;",
                    align: "",
                    lines: [{ align: "", text: [{ value: "2", style: "font-size: 80px;color: #dddddd;" }] }]
                },
                {
                    style: "top: 30px;inset-inline-start: 30px;width: 1860px;height: 500px;",
                    align: "",
                    lines: [{ align: "", text: [{ value: "1", style: "font-size: 80px;" }] }]
                }
            ]
        }

        return a
    })
}

// HELPERS

function mergeTranslations(firstKey: string, secondKey: string, defaultValue: string) {
    if (!get(dictionary).example) return defaultValue
    return get(dictionary).example![firstKey] + " " + get(dictionary).example![secondKey]
}
