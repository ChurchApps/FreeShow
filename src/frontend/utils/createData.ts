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
          name: "",
          notes: "",
          slides: [{ id: "1" }],
        },
      },
      media: {},
    })
  }

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
    a.rounded = {
      name: get(dictionary).example?.rounded || "Rounded",
      color: null,
      category: "visuals",
      items: [
        { style: "top:0px;left:0px;height:50px;width:50px;background:radial-gradient(circle at 100% 100%, transparent 50px, black 0px);" },
        { style: "top:0px;right:0px;height:50px;width:50px;background:radial-gradient(circle at 0 100%, transparent 50px, black 0px);" },
        { style: "bottom:0px;right:0px;height:50px;width:50px;background:radial-gradient(circle at 0 0, transparent 50px, black 0px);" },
        { style: "bottom:0px;left:0px;height:50px;width:50px;background:radial-gradient(circle at 100% 0, transparent 50px, black 0px);" },
      ],
    }
    return a
  })

  folders.update((a) => {
    a.default = { name: get(dictionary).example?.meetings || "Meetings", parent: "/" }
    return a
  })
  projects.update((a) => {
    a.default = {
      name: get(dictionary).example?.example || "Example",
      notes: get(dictionary).example?.example_note || "Write notes here",
      created: new Date("2022-01-01").getTime(),
      parent: "default",
      shows: [{ id: "default" }],
    }
    return a
  })

  // TODO: translate templates
  templates.update((a) => {
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
    a.big = {
      name: get(dictionary).example?.big || "big",
      color: null,
      category: "song",
      items: [
        {
          style: "top:121px;left:50.5px;height:840px;width:1820px;",
          align: "",
          lines: [{ align: "", text: [{ value: get(dictionary).example?.big || "big", style: "font-size: 120px;" }] }],
        },
      ],
    }
    a.default = {
      name: get(dictionary).example?.default || "default",
      color: null,
      category: "song",
      items: [
        {
          style: "top:121px;left:50.5px;height:840px;width:1820px;",
          align: "",
          lines: [{ align: "", text: [{ value: get(dictionary).example?.default || "default", style: "font-size: 100px;" }] }],
        },
      ],
    }
    a.small = {
      name: get(dictionary).example?.small || "small",
      color: null,
      category: "song",
      items: [
        {
          style: "top:121px;left:50.5px;height:840px;width:1820px;",
          align: "",
          lines: [{ align: "", text: [{ value: get(dictionary).example?.small || "small", style: "font-size: 80px;" }] }],
        },
      ],
    }
    return a
  })
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
