import { get } from "svelte/store"
import { activeEdit, activeProject, activeShow, projects, projectView, saved, showRecentlyUsedProjects, shows, showsCache } from "../../stores"
import { keysToID, sortByTimeNew } from "../helpers/array"
import type { ProjectShowRef } from "../../../types/Projects"
import { uid } from "uid"
import { similarity } from "../../converters/txt"

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

    // open stored layout
    if ((item.type || "show") === "show" && item.layout) {
        // wait until loaded
        setTimeout(() => {
            showsCache.update((a) => {
                if (!a[item.id]?.settings) return a
                a[item.id].settings.activeLayout = item.layout!
                return a
            })
        }, 50)
    }

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

    navigator.clipboard
        .readText()
        .then((clipText: string) => {
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
        .catch((e) => {
            console.warn("Could not read clipboard:", e)
        })
}

// each line break is one section
function textToProjectItems(text: string) {
    if (typeof text !== "string") return []

    let items: ProjectShowRef[] = []

    // account for bullet/number points
    // know when there's lyrics

    // too long, probably not a list of sections
    if (text.split("\n").length > 30) return []

    const showsList = get(shows)
    text.split("\n").forEach((line) => {
        let name = line.trim()
        if (!name) return

        // remove any "- " or "* " from the start of the line
        name = name.replace(/^[-*]\s+/, "")

        // find a show with the closest title match (must be at least 70% similarity)
        const searchName = name.toLowerCase()
        const mostSimilar = Object.entries(showsList).reduce(
            (best, [id, show]) => {
                const showName = (show.name || "").toLowerCase()
                const percentage = similarity(searchName, showName)
                return percentage > 0.7 && percentage > best.percentage ? { id, percentage } : best
            },
            { id: "", percentage: 0 }
        )

        if (mostSimilar.id) {
            items.push({ id: mostSimilar.id, type: "show", name })
        } else {
            items.push({ id: uid(5), type: "section", name })
        }
    })

    // if there's two line breaks between (& there's multiple lines) it will create a show
    // let sections: string[] = []
    // text.split("\n\n").forEach((part) =>

    return items
}
