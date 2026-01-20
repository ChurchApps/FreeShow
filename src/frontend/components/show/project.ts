import { get } from "svelte/store"
import { activeEdit, activeProject, activeShow, projects, projectView, saved, showRecentlyUsedProjects } from "../../stores"
import { keysToID, sortByTimeNew } from "../helpers/array"

export function openProject(id: string, openFirstItem: boolean = true) {
    projectView.set(false)

    let alreadyActive = get(activeProject) === id
    if (!get(showRecentlyUsedProjects) && alreadyActive) return

    showRecentlyUsedProjects.set(false)
    activeProject.set(id)
    markProjectAsUsed(id)

    if (openFirstItem) openProjectItem(id)
}

function markProjectAsUsed(id: string) {
    // set back to saved if opening, as project used time is changed
    if (get(saved)) setTimeout(() => saved.set(true), 10)

    // set last used
    projects.update((a) => {
        if (a[id]) a[id].used = Date.now()
        return a
    })
}

export function openProjectItem(id: string, index: number = 0) {
    const projectItems = get(projects)[id]?.shows || []
    if (!projectItems.length) return

    let item = projectItems[index]
    if (!item) return

    activeShow.set({ ...item, index })

    let type = item.type
    // same as ShowButton
    if (type === "image" || type === "video") activeEdit.set({ id: item.id, type: "media", items: [] })
    else if (get(activeEdit).id) activeEdit.set({ type: "show", slide: 0, items: [], showId: item.id })
}

const FIVE_DAYS = 432000000
export function getRecentlyUsedProjects() {
    // get all projects used within the last five days
    let recentlyUsedList = keysToID(get(projects)).filter((a) => !a.archived && a.used && Date.now() - a.used < FIVE_DAYS)
    // last used first
    recentlyUsedList = sortByTimeNew(recentlyUsedList, "used").reverse()

    if (recentlyUsedList.length < 2) return []
    return recentlyUsedList
}
