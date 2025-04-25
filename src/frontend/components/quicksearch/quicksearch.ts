import { get } from "svelte/store"
import { activeEdit, activePage, activeShow, quickSearchActive, refreshEditSlide, sortedShowsList } from "../../stores"
import { showSearch } from "../../utils/search"

interface QuickSearchValue {
    type: keyof typeof actions
    icon?: string
    id: string
    name: string
    description?: string
}

const MAX_RESULTS = 10
export function quicksearch(searchValue: string) {
    let values: QuickSearchValue[] = []

    const shows = showSearch(searchValue, get(sortedShowsList))
    values = shows.map((a) => ({ type: "show", icon: "slide", id: a.id, name: a.name }))

    // WIP search for media files, settings, etc.
    // if (values.length < MAX_RESULTS) {continue...}

    return values.slice(0, MAX_RESULTS)
}

const actions = {
    show: (id: string) => {
        const newShow: any = { id, type: "show" }
        activeShow.set(newShow)

        // ShowButton.svelte
        // if (type === "image" || type === "video") activeEdit.set({ id, type: "media", items: [] })
        if (get(activeEdit).id) activeEdit.set({ type: "show", slide: 0, items: [], showId: get(activeShow)?.id })

        if (get(activePage) === "edit") refreshEditSlide.set(true)
    },
}

export function selectQuicksearchValue(value: QuickSearchValue) {
    if (!actions[value.type]) {
        console.error("Unknown Quick search type:", value.type)
        return
    }

    quickSearchActive.set(false)
    activePage.set("show")
    actions[value.type](value.id)
}
