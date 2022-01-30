import { get } from "svelte/store"
import { setShow } from "../components/helpers/setShow"
import { audioFolders, dictionary, folders, mediaFolders, projects, templates } from "./../stores"
import { save } from "./save"

export function createData(paths: any) {
  setShow("default", {
    name: get(dictionary).example?.welcome || "Welcome",
    category: "presentation",
    settings: {
      activeLayout: "default",
      template: "default",
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
            style: "top: 400px;left: 180px;height: 220px;width: 1500px;",
            align: "justify-content: center;",
            text: [{ value: (get(dictionary).example?.welcome || "Welcome") + "!", style: "font-size: 180px;font-weight: bold;" }],
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
    backgrounds: {},
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
    a.default = {
      name: "Title",
      color: null,
      category: "song",
      items: [
        {
          style: "top: 400px;left: 180px;height: 220px;width: 1500px;",
          align: "justify-content: center;",
          text: [{ value: "Template", style: "font-size: 180px;font-weight: bold;" }],
        },
      ],
    }
    return a
  })
  // TODO: get folders
  mediaFolders.update((a) => {
    a.pictures = { name: "category.pictures", icon: "folder", path: paths.pictures, default: true }
    a.videos = { name: "category.videos", icon: "folder", path: paths.videos, default: true }
    return a
  })
  audioFolders.update((a) => {
    a.music = { name: "category.music", icon: "folder", path: paths.music, default: true }
    return a
  })

  save()
}
