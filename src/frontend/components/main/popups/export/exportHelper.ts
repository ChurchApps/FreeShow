import { get } from "svelte/store"
import type { Option } from "../../../../../types/Main"
import { activeProject, activeShow, projects, selected, shows } from "../../../../stores"

export const exportFormats: Option[] = [
    { name: "$:export.project:$", id: "project" }, // many shows in one file
    { name: "SHOW", id: "show" }, // (json) - can also just be copied from the Shows folder
    { name: "TXT", id: "txt" },
    { name: "PDF", id: "pdf" },
    // {name: "CSV", id: "csv"} // probably not needed
    // {name: "ChordPro", id: "chordpro"}
]

export const exportTypes: Option[] = [
    { name: "$:export.current_project:$", id: "project", icon: "project" },
    { name: "$:export.selected_shows:$", id: "selected_shows", icon: "slide" }, // selected or currently opened
    { name: "$:export.all_shows:$", id: "all_shows", icon: "shows" },
    // {name: "export.all_projects", id: "all_projects"}
]

export const getShowIdsFromType = {
    project: (onlyShows: boolean = true) => {
        if (!get(activeProject)) return

        let projectShows = (get(projects)[get(activeProject)!]?.shows || []).filter((a) => (onlyShows ? (a?.type || "show") === "show" : true))
        return projectShows.map(({ id }) => id)
    },
    selected_shows: () => {
        if (!get(selected).id?.includes("show")) {
            let showId = getActiveShowId()
            return showId ? [showId] : []
        }

        return get(selected).data.map(({ id }) => id)
    },
    all_shows: () => {
        return Object.keys(get(shows))
    },
}

export function getActiveShowId() {
    if (!get(activeShow) || (get(activeShow)!.type || "show") !== "show") return ""
    return get(activeShow)!.id || ""
}
