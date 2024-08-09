// ----- FreeShow -----
// Function for exporting project/shows as a project (.project)

import { get } from "svelte/store"
import { EXPORT } from "../../../types/Channels"
import type { Project, ProjectShowRef } from "../../../types/Projects"
import { dataPath } from "../../stores"
import { send } from "../../utils/request"
import { clone } from "../helpers/array"
import { loadShows } from "../helpers/setShow"
import { _show } from "../helpers/shows"
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

    await Promise.all(projectItems.map(getShow))

    // export to file
    send(EXPORT, ["GENERATE"], { type: "project", path: get(dataPath), name: formatToFileName(project.name), file: { project, shows } })

    async function getShow(showRef: ProjectShowRef) {
        let type = showRef.type || "show"
        // await loadShows(ids) ...
        if (type === "show") {
            shows[showRef.id] = _show(showRef.id).get()
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
