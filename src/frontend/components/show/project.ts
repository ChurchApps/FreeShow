import { get } from "svelte/store"
import { activeEdit, activeProject, activeShow, projects, projectView, saved, showRecentlyUsedProjects } from "../../stores"
import { keysToID, sortByTimeNew } from "../helpers/array"
import type { ProjectShowRef } from "../../../types/Projects"
import { uid } from "uid"

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
    if (get(saved)) setTimeout(() => saved.set(true), 300)

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

export function clipboardToProject() {
    const currentProject = get(activeProject)
    if (!currentProject || !get(projects)[currentProject]) return

    navigator.clipboard.readText().then((clipText: string) => {
        if (!clipText) return

        const content = clipText.toString()
        const items = textToProjectItems(content)
        if (!items.length) return

        projects.update((a) => {
            if (!a[currentProject]) return a

            a[currentProject].shows = [...a[currentProject].shows, ...items]
            return a
        })
    })
}

// each line break is one section
function textToProjectItems(text: string) {
    let items: ProjectShowRef[] = []

    // account for bullet/number points
    // know when there's lyrics

    // too long, probably not a list of sections
    if (text.split("\n").length > 30) return []

    text.split("\n").forEach((line) => {
        line = line.trim()
        if (!line) return

        items.push({ id: uid(5), type: "section", name: line })
    })

    // if there's two line breaks between (& there's multiple lines) it will create a show
    // let sections: string[] = []
    // text.split("\n\n").forEach((part) =>

    return items
}
