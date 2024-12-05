// ----- FreeShow -----
// Function for exporting project/shows as a project (.project)

import { get } from "svelte/store"
import { EXPORT } from "../../../types/Channels"
import type { Project, ProjectShowRef } from "../../../types/Projects"
import { dataPath, folders, overlays as overlayStores, showsCache } from "../../stores"
import { send } from "../../utils/request"
import { clone } from "../helpers/array"
import { loadShows } from "../helpers/setShow"
import { formatToFileName } from "../helpers/show"
import { _show } from "../helpers/shows"
import type { SlideData } from "../../../types/Show"

export async function exportProject(project: Project) {
    let shows: any = {}
    let files: string[] = []
    let overlays: {[key: string]: any} = {}

    // get project
    project = clone(project)
    let parentFolder = get(folders)[project.parent]?.name || ""
    project.parent = "/" // place on root

    // project items
    const getProjectItems = {
        show: (showRef: ProjectShowRef) => {
            shows[showRef.id] = clone(get(showsCache)[showRef.id])

            let refs = _show(showRef.id).layouts().ref()
            let mediaIds: string[] = []

            refs.forEach(ref => {
                ref.forEach(({data}: {data: SlideData}) => {
                    // background
                    let background = data.background
                    if (background) mediaIds.push(background)

                    // audio
                    let audio = data.audio || []
                    mediaIds.push(...audio)

                    // overlays
                    let overlays = data.overlays || []
                    overlays.forEach(getOverlay)
                });
            })

            // get media file paths
            let media = _show(showRef.id).get("media")
            mediaIds.forEach(id => {
                getFile(media[id].path || media[id].id)
            })

            // TODO: timers etc.
        },
        video: (showRef: ProjectShowRef) => getFile(showRef.id),
        image: (showRef: ProjectShowRef) => getFile(showRef.id),
        audio: (showRef: ProjectShowRef) => getFile(showRef.id),
        ppt: (showRef: ProjectShowRef) => getFile(showRef.id),
        pdf: (showRef: ProjectShowRef) => getFile(showRef.id),
        overlay: (showRef: ProjectShowRef) => getOverlay(showRef.id),
        player: () => {
            // do nothing
        },
        section: () => {
            // do nothing
        },
    }

    let projectItems = project.shows
    
    // load shows
    let showIds = projectItems.filter((a) => (a.type || "show") === "show").map((a) => a.id)
    await loadShows(showIds)

    projectItems.map(getItem)

    // remove duplicates
    files = [...new Set(files)]

    // export to file
    send(EXPORT, ["GENERATE"], { type: "project", path: get(dataPath), name: formatToFileName(project.name), file: { project, parentFolder, shows, files, overlays } })

    function getItem(showRef: ProjectShowRef) {
        let type = showRef.type || "show"

        if (!getProjectItems[type]) {
            console.log("Missing project type:", type);
            return
        }

        getProjectItems[type](showRef)
    }

    function getFile(path: string) {
        files.push(path)
    }

    function getOverlay(id: string) {
        if (!get(overlayStores)[id] || overlays[id]) return

        overlays[id] = clone(get(overlayStores)[id])
    }
    
    // store as base64 ?
    // let base64: any = await toDataURL(showRef.id)
    // media[showRef.id] = base64
}
