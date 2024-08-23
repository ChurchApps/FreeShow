import { get } from "svelte/store"
import type { Option } from "../../../../../types/Main"
import { activeProject, activeShow, projects, selected, shows } from "../../../../stores"

export const exportFormats: Option[] = [
    { name: "SHOW", id: "show" }, // (json) - can also just be copied from the Shows folder
    { name: "TXT", id: "txt" },
    { name: "PDF", id: "pdf", data: { hide: ["all_shows"] } },
    { name: "$:export.project:$", id: "project", data: { hide: ["all_shows"] } }, // many shows in one file
    // {name: "CSV", id: "csv"} // probably not needed
    // {name: "ChordPro", id: "chordpro"}
]

export const exportTypes: Option[] = [
    { name: "$:export.selected_shows:$", id: "selected_shows" }, // selected or currently opened
    { name: "$:export.current_project:$", id: "project" },
    { name: "$:export.all_shows:$", id: "all_shows" },
    // {name: "export.all_projects", id: "all_projects"}
]

export const getShowIdsFromType = {
    project: () => {
        if (!get(activeProject)) return

        let projectShows = get(projects)[get(activeProject)!].shows.filter((a) => (a?.type || "show") === "show")
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
