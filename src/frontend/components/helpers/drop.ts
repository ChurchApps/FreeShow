import { get } from "svelte/store"
import type { History } from "../../../types/History"
import { Main } from "../../../types/IPC/Main"
import type { DropData, SelectIds } from "../../../types/Main"
import type { ProjectShowRef } from "../../../types/Projects"
import { requestMain } from "../../IPC/main"
import { activePage, activeProject, projects, selected } from "../../stores"
import { dropActions } from "./dropActions"
import { history } from "./history"
import { addToPos } from "./mover"
import { deselect } from "./select"
import { getFileName } from "./media"

export type DropAreas = "all_slides" | "slides" | "slide" | "edit" | "shows" | "project" | "projects" | "overlays" | "templates" | "navigation" | "audio_playlist"

const areas = {
    all_slides: ["template"],
    slides: ["media", "audio", "audio_effect", "overlay", "sound", "effect", "screen", "ndi", "camera", "microphone", "scripture", "trigger", "category_audio", "audio_stream", "metronome", "show", "global_timer", "variable", "midi", "action"], // group
    // slide: ["overlay", "sound", "camera"], // "media",
    // projects: ["folder"],
    project: ["show_drawer", "media", "audio", "audio_effect", "overlay", "player", "scripture", "effect", "screen", "ndi", "camera"],
    overlays: ["slide"],
    templates: ["slide"],
    edit: ["media", "global_timer", "variable"]
    // media_drawer: ["file"],
}
const areaChildren = {
    projects: ["folder", "project"],
    project: ["show", "media", "audio", "audio_effect", "show_drawer", "player", "action"],
    slides: ["slide", "group", "global_group", "effect", "screen", "ndi", "camera", "microphone", "media", "audio", "audio_effect", "show"],
    all_slides: [],
    navigation: ["show", "show_drawer", "media", "audio", "audio_effect", "overlay", "template"],
    audio_playlist: ["audio"]
}

export function validateDrop(id: string, selectedId: SelectIds | null, children = false): boolean {
    return areas[id]?.includes(selectedId) || (children && areaChildren[id]?.includes(selectedId))
}

export async function ondrop(e: any, id: string) {
    // let data: string = e.dataTransfer.getData("text")
    const h = { id: null, location: { page: get(activePage) } }
    const sel = get(selected)

    let elem: HTMLElement | null = null
    if (e !== null) {
        // if (id === "project" || sel.id === "slide" || sel.id === "group" || sel.id === "global_group" || sel.id === "media") elem = e.target.closest(".selectElem")
        if (id === "project" || id === "projects" || id === "slides" || id === "all_slides" || id === "navigation" || id === "templates" || id === "audio_playlist") elem = e.target.closest(".selectElem")
        else if (id === "slide") elem = e.target.querySelector(".selectElem")
    }

    const trigger: undefined | string = e?.target.closest(".TriggerBlock")?.id
    const data: any = JSON.parse(elem?.getAttribute("data-item") || "{}")
    let index: undefined | number = data.index
    let center = false
    if (trigger?.includes("center")) center = true
    if (index !== undefined && trigger?.includes("end") && areaChildren[id]?.includes(sel.id || "")) index++

    const dropdata: DropData = { id, data, trigger, center, index }

    console.info("DRAG: ", sel)
    console.info("DROP: ", dropdata)

    const keys = { shiftKey: e?.shiftKey }

    if (dropActions[id]) {
        const dropData = { drag: sel, drop: dropdata }

        const hist = await dropActions[id](dropData, h, keys) as History | undefined
        if (hist && hist.id) history(hist)
        deselect()
        return
    }

    console.info("NOT ASSIGNED!", sel.id + " => " + id)
}

export async function projectDropFolders(filePaths: string[], index = -1) {
    const stats = await Promise.all(filePaths.map(async (path) => await requestMain(Main.FILE_INFO, path)))
    const folders = stats.filter((a) => a?.folder)
    if (!folders.length) return

    const projectId = get(activeProject)
    if (!projectId) return

    const currentProjectItems = get(projects)[projectId]?.shows || []
    const newProjectItems: ProjectShowRef[] = folders.map((a) => ({ type: "folder", id: a!.path, name: getFileName(a!.path) }))

    const data = addToPos(currentProjectItems, newProjectItems, index < 0 ? currentProjectItems.length : index)
    history({ id: "UPDATE", newData: { key: "shows", data }, oldData: { id: projectId }, location: { page: "show", id: "project_ref" } })
}
