// ----- FreeShow -----
// Function for exporting project/shows as a project (.project)

import { get } from "svelte/store"
import { EXPORT } from "../../../types/Channels"
import type { Project, ProjectShowRef } from "../../../types/Projects"
import type { SlideData } from "../../../types/Show"
import { dataPath, folders, overlays as overlayStores, showsCache } from "../../stores"
import { send } from "../../utils/request"
import { clone } from "../helpers/array"
import { loadShows } from "../helpers/setShow"
import { formatToFileName } from "../helpers/show"
import { _show } from "../helpers/shows"

export async function exportProject(project: Project) {
    const shows: any = {}
    let files: string[] = []
    const overlays: { [key: string]: any } = {}

    // get project
    project = clone(project)
    const parentFolder = get(folders)[project.parent]?.name || ""
    project.parent = "/" // place on root

    // project items
    const getProjectItems = {
        show: (showRef: ProjectShowRef) => {
            shows[showRef.id] = clone(get(showsCache)[showRef.id])

            const refs = _show(showRef.id).layouts().ref()
            const mediaIds: string[] = []

            refs.forEach((ref) => {
                ref.forEach(({ data }: { data: SlideData }) => {
                    // background
                    const background = data.background
                    if (background) mediaIds.push(background)

                    // audio
                    const audio = data.audio || []
                    mediaIds.push(...audio)

                    // overlays
                    const overlays = data.overlays || []
                    overlays.forEach(getOverlay)
                })
            })

            // get media file paths
            const media = _show(showRef.id).get("media")
            mediaIds.forEach((id) => {
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

    const projectItems = project.shows

    // load shows
    const showIds = projectItems.filter((a) => (a.type || "show") === "show").map((a) => a.id)
    await loadShows(showIds)

    projectItems.map(getItem)

    // remove duplicates
    files = [...new Set(files)]

    // export to file
    send(EXPORT, ["GENERATE"], {
        type: "project",
        path: get(dataPath),
        name: formatToFileName(project.name),
        file: { project, parentFolder, shows, files, overlays },
    })

    function getItem(showRef: ProjectShowRef) {
        const type = showRef.type || "show"

        if (!getProjectItems[type]) {
            console.log("Missing project type:", type)
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
