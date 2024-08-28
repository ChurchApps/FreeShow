// ----- FreeShow -----
// Function for exporting project/shows as a project (.project)

import { get } from "svelte/store"
import { EXPORT } from "../../../types/Channels"
import type { Project, ProjectShowRef } from "../../../types/Projects"
import { dataPath, showsCache } from "../../stores"
import { send } from "../../utils/request"
import { clone } from "../helpers/array"
import { loadShows } from "../helpers/setShow"
import { formatToFileName } from "../helpers/show"

export async function exportProject(project: Project) {
    let shows: any = {}
    let missingMedia: string[] = []
    // let media: any = {}
    // let overlays: any = {}

    project = clone(project)
    let projectItems = clone(project.shows)

    // place on root
    project.parent = "/"

    let showIds = projectItems.filter((a) => (a.type || "show") === "show").map((a) => a.id)
    await loadShows(showIds)

    projectItems.map(getItem)

    // export to file
    send(EXPORT, ["GENERATE"], { type: "project", path: get(dataPath), name: formatToFileName(project.name), file: { project, shows } })

    function getItem(showRef: ProjectShowRef) {
        let type = showRef.type || "show"

        if (type === "show") {
            shows[showRef.id] = get(showsCache)[showRef.id]
            // TODO: get media in shows
            // TODO: get overlays in shows
            // TODO: get audio in shows
            // TODO: timers??
            return
        }

        if (type === "player") return

        // TODO: media files
        // zip them ?

        missingMedia.push(showRef.id)

        // if (type === "image") {
        //   let base64: any = await toDataURL(showRef.id)
        //   console.log(base64)
        //   media[showRef.id] = base64
        //   return
        // }

        // video / audio
    }
}
