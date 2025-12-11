import { get } from "svelte/store"
import type { ProjectShowRef } from "../../../../types/Projects"
import { categories, overlays, playerVideos, showsCache } from "../../../stores"
import { translateText } from "../../../utils/language"
import { loadShows } from "../../helpers/setShow"

export async function getAllProjectItems(projectShows: ProjectShowRef[]) {
    const showIds: string[] = projectShows.filter((a) => (a.type || "show") === "show").map((a) => a.id)
    await loadShows(showIds)

    // get names & icons
    projectShows = projectShows.map((a) => {
        if (typeof a !== "object") return a

        // same icon as ShowButton.svelte
        if ((a.type || "show") === "show") {
            const show = get(showsCache)[a.id] || {}
            a.name = show.name
            a.icon = get(categories)[show.category || ""]?.icon || ""
        } else if (a.type === "audio") {
            a.icon = "music"
        } else if (a.type === "overlay") {
            a.name = get(overlays)[a.id]?.name
            a.icon = "overlays"
        } else if (a.type === "player") {
            a.name = get(playerVideos)[a.id]?.name
        }

        if (!a.name) a.name = translateText("main.unnamed")
        if (!a.icon) a.icon = a.type

        return a
    })

    return projectShows
}
