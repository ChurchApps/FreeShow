import { get } from "svelte/store"
import type { History } from "../../../types/History"
import type { DropData, SelectIds } from "../../../types/Main"
import { activePage, selected } from "../../stores"
import { dropActions } from "./dropActions"
import { history } from "./history"
import { deselect } from "./select"

export type DropAreas = "all_slides" | "slides" | "slide" | "edit" | "shows" | "project" | "projects" | "overlays" | "templates" | "navigation" | "audio_playlist"

const areas = {
    all_slides: ["template"],
    slides: ["media", "audio", "overlay", "sound", "screen", "ndi", "camera", "microphone", "scripture", "trigger", "audio_stream", "metronome", "show", "global_timer", "variable", "midi", "action"], // group
    // slide: ["overlay", "sound", "camera"], // "media",
    // projects: ["folder"],
    project: ["show_drawer", "media", "audio", "overlay", "player", "scripture", "screen", "ndi", "camera"],
    overlays: ["slide"],
    templates: ["slide"],
    edit: ["media", "global_timer", "variable"],
    // media_drawer: ["file"],
}
const areaChildren = {
    projects: ["folder", "project"],
    project: ["show", "media", "audio", "show_drawer", "player", "action"],
    slides: ["slide", "group", "global_group", "screen", "ndi", "camera", "microphone", "media", "audio", "show"],
    all_slides: [],
    navigation: ["show", "show_drawer", "media", "audio", "overlay", "template"],
    audio_playlist: ["audio"],
}

export function validateDrop(id: string, selected: SelectIds | null, children: boolean = false): boolean {
    return areas[id]?.includes(selected) || (children && areaChildren[id]?.includes(selected))
}

export function ondrop(e: any, id: string) {
    // let data: string = e.dataTransfer.getData("text")
    let h = { id: null, location: { page: get(activePage) } }
    let sel = get(selected)

    let elem: HTMLElement | null = null
    if (e !== null) {
        // if (id === "project" || sel.id === "slide" || sel.id === "group" || sel.id === "global_group" || sel.id === "media") elem = e.target.closest(".selectElem")
        if (id === "project" || id === "projects" || id === "slides" || id === "all_slides" || id === "navigation" || id === "templates" || id === "audio_playlist") elem = e.target.closest(".selectElem")
        else if (id === "slide") elem = e.target.querySelector(".selectElem")
    }

    let trigger: undefined | string = e?.target.closest(".TriggerBlock")?.id
    let data: any = JSON.parse(elem?.getAttribute("data") || "{}")
    let index: undefined | number = data.index
    let center: boolean = false
    if (trigger?.includes("center")) center = true
    if (index !== undefined && trigger?.includes("end") && areaChildren[id]?.includes(sel.id || "")) index++

    const dropdata: DropData = { id, data, trigger, center, index }

    console.log("DRAG: ", sel)
    console.log("DROP: ", dropdata)

    if (dropActions[id]) {
        let dropData = { drag: sel, drop: dropdata }

        const hist = dropActions[id](dropData, h) as History | undefined
        if (hist && hist.id) history(hist)
        deselect()
        return
    }

    console.log("NOT ASSIGNED!", sel.id + " => " + id)
}
