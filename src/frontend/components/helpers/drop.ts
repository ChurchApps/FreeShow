import { get } from "svelte/store"
import { activePage, selected } from "../../stores"
import { dropActions } from "./dropActions"
import { history } from "./history"

export type DropAreas = "all_slides" | "slides" | "slide" | "edit" | "shows" | "project" | "projects" | "overlays" | "templates" | "navigation"

const areas: { [key in DropAreas | string]: string[] } = {
    all_slides: ["template"],
    slides: ["media", "audio", "overlay", "sound", "screen", "camera", "microphone", "scripture", "trigger", "audio_stream", "metronome", "show", "midi", "action"], // group
    // slide: ["overlay", "sound", "camera"], // "media",
    // projects: ["folder"],
    project: ["show_drawer", "media", "audio", "player", "scripture"],
    overlays: ["slide"],
    templates: ["slide"],
    edit: ["media"],
    // media_drawer: ["file"],
}
const areaChildren: { [key in DropAreas | string]: string[] } = {
    projects: ["folder", "project"],
    project: ["show", "media", "audio", "show_drawer", "player"],
    slides: ["slide", "group", "global_group", "screen", "camera", "microphone", "media", "audio", "show"],
    all_slides: [],
    navigation: ["show", "show_drawer", "media", "audio", "overlay", "template"],
}

export function validateDrop(id: string, selected: any, children: boolean = false): boolean {
    return areas[id]?.includes(selected) || (children && areaChildren[id]?.includes(selected))
}

export function ondrop(e: any, id: string) {
    // let data: string = e.dataTransfer.getData("text")
    let h: any = { id: null, location: { page: get(activePage) } }
    let sel = get(selected)

    let elem: any = null
    if (e !== null) {
        // if (id === "project" || sel.id === "slide" || sel.id === "group" || sel.id === "global_group" || sel.id === "media") elem = e.target.closest(".selectElem")
        if (id === "project" || id === "projects" || id === "slides" || id === "all_slides" || id === "navigation") elem = e.target.closest(".selectElem")
        else if (id === "slide") elem = e.target.querySelector(".selectElem")
    }

    let trigger: undefined | string = e?.target.closest(".TriggerBlock")?.id
    let data: any = JSON.parse(elem?.getAttribute("data") || "{}")
    let index: undefined | number = data.index
    let center: boolean = false
    if (trigger?.includes("center")) center = true
    if (index !== undefined && trigger?.includes("end") && areaChildren[id]?.includes(sel.id || "")) index++

    console.log("DRAG: ", sel)
    console.log("DROP: ", id, data, trigger, center, index)

    if (dropActions[id]) {
        let dropData: any = { drag: sel, drop: { id, data, trigger, center, index } }

        h = dropActions[id](dropData, h)
        if (h && h.id) history(h)
        selected.set({ id: null, data: [] })
        return
    }

    console.log("NOT ASSIGNED!", sel.id + " => " + id)
}
