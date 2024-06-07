import { get } from "svelte/store"
import { history } from "../components/helpers/history"
import { activeDrawerTab, activePopup, activeProject, activeRename, categories, drawerTabsData, shows } from "../stores"
import { newToast } from "../utils/messages"

export function createCategory(name: string, icon: string = "song", { isDefault } = { isDefault: false }) {
    // return selected category if it is empty
    let selectedCategory = get(drawerTabsData).shows?.activeSubTab || ""
    console.log(selectedCategory)
    if (get(activeDrawerTab) === "shows" && selectedCategory !== "all" && selectedCategory !== "unlabeled") {
        let categoryCount = Object.values(get(shows)).reduce((count: number, show: any) => (count += show.category === selectedCategory ? 1 : 0), 0)
        if (!categoryCount) return selectedCategory
    }

    let id = name.toLowerCase()
    if (get(categories)[id]) return id
    if (isDefault) name = "category." + name

    history({ id: "UPDATE", newData: { data: { name, icon, default: isDefault } }, oldData: { id }, location: { page: "drawer", id: "category_shows" } })

    setTimeout(() => {
        activeRename.set(null)
    })

    return id
}

export function setTempShows(tempShows: any[]) {
    if (tempShows.length === 1) {
        history({ id: "UPDATE", newData: { data: tempShows[0].show, remember: { project: get(activeProject) } }, oldData: { id: tempShows[0].id }, location: { page: "show", id: "show" } })
    } else {
        history({ id: "SHOWS", newData: { data: tempShows }, location: { page: "show" } })
    }

    activePopup.set(null)
    newToast("$main.finished")
}
