import { get } from "svelte/store"
import { history } from "../components/helpers/history"
import { activePopup, activeProject, alertMessage, categories, dictionary } from "../stores"

export function createCategory(name: string, icon: string = "song", { isDefault } = { isDefault: false }) {
    let id = name.toLowerCase()
    if (get(categories)[id]) return
    if (isDefault) name = "category." + name

    history({ id: "UPDATE", newData: { data: { name, icon, default: isDefault } }, oldData: { id }, location: { page: "drawer", id: "category_shows" } })
}

export function setTempShows(tempShows: any[]) {
    if (tempShows.length === 1) {
        history({ id: "UPDATE", newData: { data: tempShows[0].show, remember: { project: get(activeProject) } }, oldData: { id: tempShows[0].id }, location: { page: "show", id: "show" } })
    } else {
        history({ id: "SHOWS", newData: { data: tempShows }, location: { page: "show" } })
    }

    activePopup.set("alert")
    alertMessage.set(get(dictionary).main?.finished || "Finished")
}
