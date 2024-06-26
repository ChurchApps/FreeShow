import { get } from "svelte/store"
import { uid } from "uid"
import { history } from "../components/helpers/history"
import { checkName } from "../components/helpers/show"
import { activeDrawerTab, activePopup, activeProject, activeRename, categories, drawerTabsData, shows } from "../stores"
import { newToast } from "../utils/common"

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

export function importShow(files: any[]) {
    let tempShows: any[] = []

    files.forEach(({ content, name }: any) => {
        let id, show

        try {
            ;[id, show] = JSON.parse(content)
        } catch (e: any) {
            // try to fix broken show files
            content = content.slice(0, content.indexOf("}}]") + 3)

            try {
                ;[id, show] = JSON.parse(content)
            } catch (e: any) {
                console.error(name, e)
                let pos = Number(e.toString().replace(/\D+/g, "") || 100)
                console.log(pos, content.slice(pos - 5, pos + 5), content.slice(pos - 100, pos + 100))
                return
            }
        }

        tempShows.push({ id, show: { ...show, name: checkName(show.name, id) } })
    })

    setTempShows(tempShows)
}

// SPECIFIC FORMATS

export function importSpecific(data: any, store: any) {
    data.forEach(({ content }) => {
        content = JSON.parse(content)

        store.update((a) => {
            a[uid()] = content
            return a
        })
    })

    newToast("$main.finished")
}
