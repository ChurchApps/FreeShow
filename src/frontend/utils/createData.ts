import { templateCategories } from "./../stores"
import { get } from "svelte/store"
import { setShow } from "../components/helpers/setShow"
import { audioFolders, dictionary, folders, mediaFolders, overlays, projects, remotePassword, shows, showsPath, templates } from "../stores"
import { save } from "./save"

export function createData(paths: any) {
    if (!get(shows).default) {
        setShow("default", {
            name: get(dictionary).example?.welcome || "Welcome",
            category: "presentation",
            settings: {
                activeLayout: "default",
                template: "header",
            },
            timestamps: {
                created: new Date("2022-01-01").getTime(),
                modified: null,
                used: null,
            },
            meta: {},
            slides: {
                1: {
                    group: "",
                    color: null,
                    settings: {},
                    notes: "",
                    items: [
                        {
                            style: "top:428.50px;left:208.50px;height:220px;width:1500px;",
                            align: "",
                            lines: [{ align: "", text: [{ value: (get(dictionary).example?.welcome || "Welcome") + "!", style: "font-size: 180px;font-weight: bold;" }] }],
                        },
                    ],
                },
            },
            layouts: {
                default: {
                    name: get(dictionary).example?.default || "",
                    notes: "",
                    slides: [{ id: "1" }],
                },
            },
            media: {},
        })
    }

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
            shows: [{ id: "default" }, { id: "section", type: "section", name: get(dictionary).example?.example || "Example", notes: get(dictionary).example?.example_note || "Write notes here" }],
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
    showsPath.set(paths.shows)

    remotePassword.set(randomNumber(1000, 9999).toString())

    save()
}

const randomNumber = (from: number, to: number): number => Math.floor(Math.random() * (to - from)) + from

export function setExampleOverlays() {
    overlays.update((a) => {
        a.watermark = {
            name: get(dictionary).example?.watermark || "Watermark",
            color: "#e6349c",
            category: "notice",
            items: [
                {
                    style: "top:870px;left:1248px;height:170px;width:630px;",
                    align: "align-items:flex-end;",
                    lines: [{ align: "text-align: right;", text: [{ value: "FreeShow", style: "font-size:50px;font-weight:bold;color:#e6349c;" }] }],
                },
            ],
        }
        a.visual = {
            name: get(dictionary).example?.recording || "Recording",
            color: "red",
            category: "visuals",
            // TODO: create box
            items: [
                { style: "top:35px;left:36.5px;height:1008.21px;width:1847.62px;border:4px solid white;" },
                { style: "top:80px;left:80px;height:40px;width:40px;background-color:red;border-radius:50%;" },
                { style: "top:80px;left:140px;height:40px;width:100px;", lines: [{ align: "", text: [{ value: "REC", style: "font-size:40px;" }] }] },
            ],
        }
        a.clock = {
            name: get(dictionary).example?.clock || "Clock",
            color: "dodgerblue",
            category: "visuals",
            items: [{ style: "top:0px;left:1450px;height:170px;width:470px;", type: "clock", clock: { type: "digital", seconds: false } }],
        }
        a.rounded = {
            name: get(dictionary).example?.rounded || "Rounded",
            color: null,
            category: "visuals",
            locked: true,
            items: [
                { style: "top:0px;left:0px;height:50px;width:50px;background:radial-gradient(circle at 100% 100%, transparent 50px, black 0px);" },
                { style: "top:0px;right:0px;height:50px;width:50px;background:radial-gradient(circle at 0 100%, transparent 50px, black 0px);" },
                { style: "bottom:0px;right:0px;height:50px;width:50px;background:radial-gradient(circle at 0 0, transparent 50px, black 0px);" },
                { style: "bottom:0px;left:0px;height:50px;width:50px;background:radial-gradient(circle at 100% 0, transparent 50px, black 0px);" },
            ],
        }
        return a
    })
}

export function setExampleTemplates() {
    templateCategories.update((a) => {
        a.scripture = { default: true, name: "category.scripture", icon: "scripture" }
        return a
    })
    templates.update((a) => {
        // presentation
        a.header = {
            name: get(dictionary).example?.header || "Header",
            color: null,
            category: "presentation",
            items: [
                {
                    style: "top:428.50px;left:208.50px;height:220px;width:1500px;",
                    align: "",
                    lines: [{ align: "", text: [{ value: get(dictionary).example?.header || "Header", style: "font-size: 180px;font-weight: bold;" }] }],
                },
            ],
        }
        a.text = {
            name: get(dictionary).example?.text || "Text",
            color: null,
            category: "presentation",
            items: [
                {
                    style: "top:35px;left:50.5px;height:220px;width:1820px;",
                    align: "",
                    lines: [{ align: "text-align: left;", text: [{ value: get(dictionary).example?.header || "Header", style: "font-size: 120px;font-weight: bold;" }] }],
                },
                {
                    style: "top:290px;left:50.5px;height:750px;width:1820px;",
                    align: "",
                    lines: [{ align: "text-align: left;", text: [{ value: get(dictionary).example?.text || "Text", style: "font-size: 80px;" }] }],
                },
            ],
        }

        // lyrics
        a.big = {
            name: get(dictionary).example?.big || "Big",
            color: null,
            category: "song",
            items: [
                {
                    style: "top:120px;left:50px;height:840px;width:1820px;",
                    align: "",
                    lines: [{ align: "", text: [{ value: get(dictionary).example?.big || "Big", style: "font-size: 120px;" }] }],
                },
            ],
        }
        a.default = {
            name: get(dictionary).example?.default || "Default",
            color: null,
            category: "song",
            items: [
                {
                    style: "top:120px;left:50px;height:840px;width:1820px;",
                    align: "",
                    lines: [{ align: "", text: [{ value: get(dictionary).example?.default || "Default", style: "font-size: 100px;" }] }],
                },
            ],
        }
        a.small = {
            name: get(dictionary).example?.small || "Small",
            color: null,
            category: "song",
            items: [
                {
                    style: "top:120px;left:50px;height:840px;width:1820px;",
                    align: "",
                    lines: [{ align: "", text: [{ value: get(dictionary).example?.small || "Small", style: "font-size: 80px;" }] }],
                },
            ],
        }
        a.bigBold = {
            name: get(dictionary).example ? get(dictionary).example?.big + " " + get(dictionary).example?.bold : "Big Bold",
            color: null,
            category: "song",
            items: [
                {
                    style: "top:120px;left:50px;height:840px;width:1820px;",
                    align: "",
                    lines: [
                        {
                            align: "",
                            text: [
                                {
                                    value: get(dictionary).example ? get(dictionary).example?.big + " " + get(dictionary).example?.bold : "Big Bold",
                                    style: "font-size: 120px;font-weight: bold;",
                                },
                            ],
                        },
                    ],
                },
            ],
        }
        a.defaultBold = {
            name: get(dictionary).example ? get(dictionary).example?.default + " " + get(dictionary).example?.bold : "Default Bold",
            color: null,
            category: "song",
            items: [
                {
                    style: "top:120px;left:50px;height:840px;width:1820px;",
                    align: "",
                    lines: [
                        {
                            align: "",
                            text: [
                                {
                                    value: get(dictionary).example ? get(dictionary).example?.default + " " + get(dictionary).example?.bold : "Default Bold",
                                    style: "font-size: 100px;font-weight: bold;",
                                },
                            ],
                        },
                    ],
                },
            ],
        }
        a.smallBold = {
            name: get(dictionary).example ? get(dictionary).example?.small + " " + get(dictionary).example?.bold : "Small Bold",
            color: null,
            category: "song",
            items: [
                {
                    style: "top:120px;left:50px;height:840px;width:1820px;",
                    align: "",
                    lines: [
                        {
                            align: "",
                            text: [
                                {
                                    value: get(dictionary).example ? get(dictionary).example?.small + " " + get(dictionary).example?.bold : "Small Bold",
                                    style: "font-size: 80px;font-weight: bold;",
                                },
                            ],
                        },
                    ],
                },
            ],
        }
        a.box = {
            name: "Box",
            color: null,
            category: "song",
            items: [
                {
                    style: "top:387.50px;left:51px;height:307.15px;width:1820px;border-width:8px;background-color: rgb(0 0 0 / 0.4);outline: 8px solid rgb(255 255 255);",
                    align: "",
                    lines: [
                        { align: "", text: [{ value: "1", style: "font-weight: bold;font-size: 80px;line-height:1.1em;letter-spacing:2px;text-shadow: 0 0 #000000;" }] },
                        { align: "", text: [{ value: "2", style: "font-weight: bold;font-size: 80px;line-height:1.1em;letter-spacing:2px;text-shadow: 0 0 #000000;" }] },
                        { align: "", text: [{ value: "3", style: "font-weight: bold;font-size: 80px;line-height:1.1em;letter-spacing:2px;text-shadow: 0 0 #000000;" }] },
                    ],
                },
            ],
        }

        // scripture
        a.scripture = {
            name: get(dictionary).category?.scripture || "Scripture",
            color: "#876543",
            category: "scripture",
            items: [
                {
                    auto: true,
                    style: "top: 150px;left: 50px;width: 1820px;height: 780px;",
                    align: "",
                    lines: [{ align: "text-align: justify;", text: [{ value: "1", style: "font-size: 80px;" }] }],
                },
                {
                    style: "top: 910px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;",
                    align: "",
                    lines: [{ align: "", text: [{ value: "Meta", style: "font-size: 50px;" }] }],
                },
            ],
        }
        a.scripture_2 = {
            name: (get(dictionary).category?.scripture || "Scripture") + " 2",
            color: "#876543",
            category: "scripture",
            items: [
                {
                    auto: true,
                    style: "top: 40px;left: 50px;width: 1820px;height: 400px;outline: 1px solid #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: justify;", text: [{ value: "1", style: "font-size: 70px;" }] }],
                },
                {
                    auto: true,
                    style: "top: 475px;left: 50px;width: 1820px;height: 400px;outline: 1px solid #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: justify;", text: [{ value: "2", style: "font-size: 70px;" }] }],
                },
                {
                    style: "top: 910px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;",
                    align: "",
                    lines: [{ align: "", text: [{ value: "Meta", style: "font-size: 50px;" }] }],
                },
            ],
        }
        a.scripture_3 = {
            name: (get(dictionary).category?.scripture || "Scripture") + " 3",
            color: "#876543",
            category: "scripture",
            items: [
                {
                    auto: true,
                    style: "top: 40px;left: 50px;width: 1820px;height: 250px;outline: 1px solid #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: justify;", text: [{ value: "1", style: "font-size: 60px;" }] }],
                },
                {
                    auto: true,
                    style: "top: 320px;left: 50px;width: 1820px;height: 250px;outline: 1px solid #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: justify;", text: [{ value: "2", style: "font-size: 60px;" }] }],
                },
                {
                    auto: true,
                    style: "top: 600px;left: 50px;width: 1820px;height: 250px;outline: 1px solid #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: justify;", text: [{ value: "3", style: "font-size: 60px;" }] }],
                },
                {
                    style: "top: 910px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;",
                    align: "",
                    lines: [{ align: "", text: [{ value: "Meta", style: "font-size: 50px;" }] }],
                },
            ],
        }
        a.scripture_4 = {
            name: (get(dictionary).category?.scripture || "Scripture") + " 4",
            color: "#876543",
            category: "scripture",
            items: [
                {
                    auto: true,
                    style: "top: 40px;left: 50px;width: 1820px;height: 200px;outline: 1px solid #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: justify;", text: [{ value: "1", style: "font-size: 60px;" }] }],
                },
                {
                    auto: true,
                    style: "top: 250px;left: 50px;width: 1820px;height: 200px;outline: 1px solid #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: justify;", text: [{ value: "2", style: "font-size: 60px;" }] }],
                },
                {
                    auto: true,
                    style: "top: 460px;left: 50px;width: 1820px;height: 200px;outline: 1px solid #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: justify;", text: [{ value: "3", style: "font-size: 60px;" }] }],
                },
                {
                    auto: true,
                    style: "top: 670px;left: 50px;width: 1820px;height: 200px;outline: 1px solid #cccccc;",
                    align: "",
                    lines: [{ align: "text-align: justify;", text: [{ value: "4", style: "font-size: 60px;" }] }],
                },
                {
                    style: "top: 910px;left: 50px;width: 1820px;height: 150px;opacity: 0.8;",
                    align: "",
                    lines: [{ align: "", text: [{ value: "Meta", style: "font-size: 50px;" }] }],
                },
            ],
        }
        // blue theme
        a.blueHeader = {
            name: "Blue Header",
            color: "#2957ff",
            category: "presentation",
            items: [
                // 1080 x 1920
                {
                    style: "left:720px;top:640px;width:1130px;height:210px;",
                    align: "",
                    lines: [{ align: "text-align: left", text: [{ value: "1", style: "font-weight:bold;font-family:Arial;line-height:1.2em;font-size:120px;" }] }],
                },
                {
                    style: "left:720px;top:850px;width:1130px;height:60px;",
                    align: "",
                    lines: [{ align: "text-align: left", text: [{ value: "2", style: "color:#ffffff;font-size:50px;" }] }],
                },
                {
                    style: "left:-850px;top:-600px;width:1600px;height:1600px;background-color:#2957ff;transform:rotate(30deg);",
                    align: "",
                    lines: [{ align: "", text: [{ value: "", style: "" }] }],
                },
            ],
        }
        a.blueMain = {
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
                        { align: "text-align: left", text: [{ value: "5", style: "font-weight:bold;font-family:Arial;font-size:80px;line-height:1.2em;" }] },
                    ],
                },
                {
                    style: "left:0px;top:0px;width:500px;height:1080px;background-color: #2957ff;",
                    align: "",
                    lines: [{ align: "", text: [{ value: "", style: "" }] }],
                },
                // {
                //   style: "left:500px;top:0px;width:1420px;height:1080px;background-color: #ffffff;",
                //   align: "",
                //   lines: [{ align: "", text: [{ value: "", style: "" }] }],
                // },
            ],
        }
        a.bullets = {
            name: "Bullets",
            color: "#747680",
            category: "presentation",
            items: [
                {
                    style: "top:120px;left:50px;height:840px;width:1820px;",
                    align: "",
                    lines: [
                        {
                            align: "text-align: left",
                            text: [
                                {
                                    value: "• Bullet 1",
                                    style: "font-size: 100px;font-weight: bold;line-height:1.2em;",
                                },
                            ],
                        },
                        {
                            align: "text-align: left",
                            text: [
                                {
                                    value: "• Bullet 2",
                                    style: "font-size: 100px;font-weight: bold;line-height:1.2em;",
                                },
                            ],
                        },
                        {
                            align: "text-align: left",
                            text: [
                                {
                                    value: "• Bullet 3",
                                    style: "font-size: 100px;font-weight: bold;line-height:1.2em;",
                                },
                            ],
                        },
                    ],
                },
            ],
        }
        return a
    })
}
