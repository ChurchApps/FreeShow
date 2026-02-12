import { get } from "svelte/store"
import type { Option } from "../../../../../types/Main"
import { activeProject, activeShow, projects, selected, shows, showsCache } from "../../../../stores"
import { getSlideThumbnail } from "../../../helpers/media"
import { getLayoutRef } from "../../../helpers/show"

export const exportFormats: Option[] = [
    { name: "export.project", id: "project" }, // many shows in one file
    { name: "formats.show", id: "show" }, // (json) - can also just be copied from the Shows folder
    { name: "edit.text", id: "txt" },
    { name: "PDF", id: "pdf" },
    { name: "items.image", id: "image" }
    // {name: "CSV", id: "csv"} // probably not needed
    // {name: "ChordPro", id: "chordpro"}
]

export const exportTypes: Option[] = [
    { name: "export.current_project", id: "project", icon: "project" },
    { name: "export.selected_shows", id: "selected_shows", icon: "slide" }, // selected or currently opened
    { name: "export.all_shows", id: "all_shows", icon: "shows" }
    // {name: "export.all_projects", id: "all_projects"}
]

export const getShowIdsFromType = {
    project: (onlyShows = true) => {
        if (!get(activeProject)) return

        const projectShows = (get(projects)[get(activeProject)!]?.shows || []).filter((a) => (onlyShows ? (a?.type || "show") === "show" : true))
        return projectShows.map(({ id }) => id)
    },
    selected_shows: () => {
        if (!get(selected).id?.includes("show")) {
            const showId = getActiveShowId()
            return showId ? [showId] : []
        }

        return get(selected).data.map(({ id }) => id)
    },
    all_shows: () => {
        return Object.keys(get(shows))
    }
}

export function getActiveShowId() {
    if (!get(activeShow) || (get(activeShow)!.type || "show") !== "show") return ""
    return get(activeShow)!.id || ""
}

export async function convertShowSlidesToImages(showId: string) {
    const show = get(showsCache)[showId]
    if (!show) return []

    const layoutRef = getLayoutRef(showId)
    const layoutId = show.settings.activeLayout

    let currentBackground = ""
    const thumbnails: string[] = []
    const batchSize = 8
    for (let i = 0; i < layoutRef.length; i += batchSize) {
        const batch = layoutRef.slice(i, i + batchSize)
        await Promise.all(
            batch.map(async (ref, j) => {
                if (ref.data.disabled) return

                const background = ref.data.background || ""
                let backgroundImage = show.media[background]?.path || currentBackground
                if (ref.data.actions?.clearBackground) backgroundImage = ""
                if (!background || show.media[background]?.loop !== false) currentBackground = backgroundImage

                const overlays = ref.data.overlays
                const thumbnail = await getSlideThumbnail({ showId, layoutId, index: ref.layoutIndex }, { backgroundImage, overlays }, true)
                thumbnails[i + j] = thumbnail
            })
        )
    }

    return thumbnails
}
