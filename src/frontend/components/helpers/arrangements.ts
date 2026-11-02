import { get } from "svelte/store"
import { uid } from "uid"
import type { Layout, Show, SlideData } from "../../../types/Show"
import { activeProject, activeShow, editingProjectTemplate, projects, projectTemplates, showsCache } from "../../stores"
import { history } from "./history"

// Arrangements are show "layouts". A show without a chosen default treats its current arrangement as the default
// until it is first switched, so libraries made before defaults existed open exactly as they did.

/** the arrangement project items open on */
export function getDefaultLayout(show: Show | undefined): string {
    const layouts = show?.layouts || {}
    const chosen = show?.settings?.defaultLayout
    if (chosen && layouts[chosen]) return chosen
    const active = show?.settings?.activeLayout
    if (active && layouts[active]) return active
    return Object.keys(layouts)[0] || ""
}

/** switch the show's current arrangement; the first switch pins the one it was on as the default */
export function setActiveLayout(showId: string, layoutId: string) {
    showsCache.update((a) => {
        const show = a[showId]
        if (!show?.layouts?.[layoutId]) return a
        if (!show.settings) show.settings = { activeLayout: "", template: null }
        if (show.settings.activeLayout === layoutId) return a

        if (!show.settings.defaultLayout && show.layouts[show.settings.activeLayout]) show.settings.defaultLayout = show.settings.activeLayout
        show.settings.activeLayout = layoutId
        return a
    })
}

export function setDefaultLayout(showId: string, layoutId: string) {
    showsCache.update((a) => {
        const show = a[showId]
        if (!show?.layouts?.[layoutId]) return a
        if (!show.settings) show.settings = { activeLayout: layoutId, template: null }
        show.settings.defaultLayout = layoutId
        return a
    })
}

/** use the arrangement for the open show, and for its project item when it is one */
export function selectArrangement(showId: string, layoutId: string) {
    const show = get(showsCache)[showId]
    if (!show?.layouts?.[layoutId]) return
    setActiveLayout(showId, layoutId)

    if (Object.keys(show.layouts).length < 2) return
    const isTemplate = !!get(editingProjectTemplate)
    const projectId = isTemplate ? get(editingProjectTemplate) : get(activeProject)
    const store = isTemplate ? projectTemplates : projects
    const index = get(activeShow)?.index
    const item = index !== undefined && projectId ? get(store)[projectId]?.shows?.[index] : null
    if (!item || item.id !== showId || (item.type || "show") !== "show") return

    store.update((a) => {
        a[projectId!].shows[index!].layout = layoutId
        a[projectId!].shows[index!].layoutInfo = { name: show.layouts[layoutId].name }
        return a
    })
}

// EDITING

export function setArrangementSlides(showId: string, layoutId: string, slides: SlideData[]) {
    history({ id: "UPDATE", newData: { key: "layouts", keys: [layoutId], subkey: "slides", data: slides }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })
}

export function renameArrangement(showId: string, layoutId: string, name: string) {
    history({ id: "UPDATE", newData: { key: "layouts", keys: [layoutId], subkey: "name", data: name }, oldData: { id: showId }, location: { page: "show", id: "show_key" } })

    // project items show the arrangement name
    projects.update((a) => {
        Object.values(a).forEach((project) => {
            project.shows?.forEach((item) => {
                if (item.id === showId && item.layout === layoutId) item.layoutInfo = { name }
            })
        })
        return a
    })
}

/** a new arrangement, empty or a copy of another; it becomes the current one */
export function createArrangement(showId: string, name: string, copyFrom = ""): string {
    const source = copyFrom ? get(showsCache)[showId]?.layouts?.[copyFrom] : null
    const layout: Layout = source ? { ...JSON.parse(JSON.stringify(source)), name } : { name, notes: "", slides: [] }
    const id = uid()
    history({ id: "UPDATE", newData: { key: "layouts", subkey: id, data: layout }, oldData: { id: showId }, location: { page: "show", id: "show_layout" } })
    return id
}

/** the last arrangement of a show can't be deleted */
export function deleteArrangement(showId: string, layoutId: string) {
    const show = get(showsCache)[showId]
    if (!show?.layouts?.[layoutId] || Object.keys(show.layouts).length < 2) return

    history({ id: "UPDATE", newData: { id: showId }, oldData: { key: "layouts", subkey: layoutId }, location: { page: "show", id: "show_layout" } })

    // project items on it fall back to the default
    projects.update((a) => {
        Object.values(a).forEach((project) => {
            project.shows?.forEach((item) => {
                if (item.id !== showId || item.layout !== layoutId) return
                delete item.layout
                delete item.layoutInfo
            })
        })
        return a
    })
}
