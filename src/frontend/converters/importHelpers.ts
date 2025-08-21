import { get } from "svelte/store"
import { uid } from "uid"
import type { Show } from "../../types/Show"
import type { Category } from "../../types/Tabs"
import { history } from "../components/helpers/history"
import { checkName } from "../components/helpers/show"
import { activeDrawerTab, activePopup, activeProject, activeRename, alertMessage, categories, drawerTabsData, shows } from "../stores"
import { newToast } from "../utils/common"
import { convertText } from "./txt"

export function createCategory(name: string, icon = "song", { isDefault, isArchive }: { isDefault?: boolean; isArchive?: boolean } = {}) {
    // return selected category if it is empty
    const selectedCategory = get(drawerTabsData).shows?.activeSubTab || ""
    if (get(activeDrawerTab) === "shows" && selectedCategory !== "all" && selectedCategory !== "unlabeled") {
        const categoryCount = Object.values(get(shows)).reduce((count, show) => (count += show.category === selectedCategory ? 1 : 0), 0)
        if (!categoryCount) return selectedCategory
    }

    const id = name.toLowerCase().replaceAll(" ", "_")
    if (get(categories)[id]) return id
    if (isDefault) name = "category." + name

    const data: Category = { name, icon }
    if (isDefault) data.default = true
    if (isArchive) data.isArchive = true
    history({ id: "UPDATE", newData: { data }, oldData: { id }, location: { page: "drawer", id: "category_shows" } })

    setTimeout(() => {
        activeRename.set(null)
    })

    return id
}

export function setTempShows(tempShows: { id: string; show: Show }[]) {
    if (tempShows.length === 1) {
        history({ id: "UPDATE", newData: { data: tempShows[0].show, remember: { project: get(activeProject) } }, oldData: { id: tempShows[0].id }, location: { page: "show", id: "show" } })
    } else {
        history({ id: "SHOWS", newData: { data: tempShows, replace: true }, location: { page: "show" } })
    }

    activePopup.set(null)
    newToast("$main.finished")
}

export function importShow(files: { content: string; name?: string; extension?: string }[]) {
    const tempShows: { id: string; show: Show }[] = []

    files.forEach(({ content, name }) => {
        let id
        let show

        try {
            ;[id, show] = JSON.parse(content)
        } catch (e: any) {
            // try to fix broken show files
            content = content.slice(0, content.indexOf("}}]") + 3)

            try {
                ;[id, show] = JSON.parse(content)
            } catch (err: any) {
                console.error(name, err)
                const pos = Number(err.toString().replace(/\D+/g, "") || 100)
                console.info(pos, content.slice(pos - 5, pos + 5), content.slice(pos - 100, pos + 100))
                return
            }
        }

        if (!show) return
        show = fixShowIssues(show)

        tempShows.push({ id, show: { ...show, name: checkName(show.name, id) } })
    })

    setTempShows(tempShows)
}

/// TEMPLATE ///

export function importTemplate(files: { content: string; name?: string; extension?: string }[]) {
    files.forEach(({ content }) => {
        const parsed = JSON.parse(content)

        // old template export does not have the "template" key (pre 1.4.5)
        const template = parsed.template ? parsed.template : parsed
        if (!template.items) return

        const templateId = template.id
        delete template.id

        history({ id: "UPDATE", newData: { data: template }, oldData: { id: templateId }, location: { page: "drawer", id: "template" } })
    })

    alertMessage.set("actions.imported")
    activePopup.set("alert")
}

/// //

export function importFromClipboard() {
    navigator.clipboard
        .readText()
        .then((text) => {
            let activeCategory = get(drawerTabsData).shows?.activeSubTab
            if (activeCategory === "all" || activeCategory === "unlabeled") activeCategory = null

            convertText({ text, noFormatting: true, category: activeCategory })
        })
        .catch((err) => {
            console.error("Failed to read clipboard contents: ", err)
        })
}

// SPECIFIC FORMATS

export function importSpecific(data: { content: string; name?: string; extension?: string }[], store: any) {
    data.forEach(({ content }) => {
        content = JSON.parse(content)

        store.update((a) => {
            a[uid()] = content
            return a
        })
    })

    newToast("$main.finished")
}

export function fixShowIssues(show) {
    // remove unused children slides
    const allUsedSlides: string[] = Object.keys(show.slides).reduce((ids: string[], slideId: string) => {
        const slide = show.slides[slideId]
        if (slide.group === null) return ids

        ids.push(slideId)
        ids.push(...(slide.children || []))
        return ids
    }, [])

    Object.keys(show.slides).forEach((slideId: string) => {
        const slide = show.slides[slideId]

        // remove if unused
        if (!allUsedSlides.includes(slideId) && slide.group === null) {
            delete show.slides[slideId]
            return
        }

        // check & fix looping items bug
        if (slide.items?.length < 30) return

        let previousItem = ""
        let matchCount = 0
        for (const item of slide.items) {
            const currentItem = JSON.stringify(item)

            if (previousItem === currentItem) matchCount++
            if (matchCount >= 30) {
                show.slides[slideId].items = []
                return
            }

            previousItem = currentItem
        }
    })

    return show
}
