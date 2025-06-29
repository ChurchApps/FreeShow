// ----- FreeShow -----
// Function for exporting project/shows as a project (.project)

import { get } from "svelte/store"
import { EXPORT } from "../../../types/Channels"
import type { Effects } from "../../../types/Effects"
import type { Project, ProjectShowRef } from "../../../types/Projects"
import type { Action, Overlays, Shows, SlideData } from "../../../types/Show"
import { actions as actionsStores, dataPath, effects as effectsStores, folders, media, overlays as overlayStores, showsCache, special } from "../../stores"
import { send } from "../../utils/request"
import { clone } from "../helpers/array"
import { loadShows } from "../helpers/setShow"
import { formatToFileName } from "../helpers/show"
import { _show } from "../helpers/shows"

export async function exportProject(project: Project, projectId: string) {
    const shows: Shows = {}
    let files: string[] = []
    const overlays: Overlays = {}
    const effects: Effects = {}
    const actions: { [key: string]: Action } = {}

    // get project
    project = clone(project)
    const parentFolder = get(folders)[project.parent]?.name || ""
    if (projectId) project.id = projectId
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
                    const overlayIds = data.overlays || []
                    overlayIds.forEach(getOverlay)

                    // actions
                    const actionIds = data.actions?.slideActions || []
                    actionIds.forEach((a) => getAction(a.id))
                })
            })

            // get media file paths
            const mediaData = _show(showRef.id).get("media")
            mediaIds.forEach((id) => {
                const path = mediaData[id]?.path || mediaData[id]?.id
                if (!path || path.includes("http")) return
                getFile(path)
            })

            // get media from "Media" items
            const slides = shows[showRef.id]?.slides || {}
            Object.values(slides).forEach(({ items }) => {
                items.forEach((item) => {
                    if (item.type === "media") {
                        getFile(item.src)
                    }
                })
            })

            // TODO: timers etc.
        },
        video: (showRef: ProjectShowRef) => getFile(showRef.id),
        image: (showRef: ProjectShowRef) => getFile(showRef.id),
        audio: (showRef: ProjectShowRef) => getFile(showRef.id),
        ppt: (showRef: ProjectShowRef) => getFile(showRef.id),
        pdf: (showRef: ProjectShowRef) => getFile(showRef.id),
        overlay: (showRef: ProjectShowRef) => getOverlay(showRef.id),
        effects: (showRef: ProjectShowRef) => getEffect(showRef.id),
        player: () => {
            // do nothing
        },
        section: () => {
            // do nothing
        }
    }

    const projectItems = project.shows

    // load shows
    const showIds = projectItems.filter((a) => (a.type || "show") === "show").map((a) => a.id)
    await loadShows(showIds)

    projectItems.map(getItem)

    // remove duplicates
    files = [...new Set(files)]

    // set data
    const projectData: any = { project, parentFolder, shows }
    if (Object.keys(overlays).length) projectData.overlays = overlays
    if (Object.keys(effects).length) projectData.effects = effects
    if (Object.keys(actions).length) projectData.actions = actions
    const includeMediaFiles = get(special).projectIncludeMedia ?? true
    if (includeMediaFiles) {
        projectData.files = files

        const mediaData: any = {}
        files.forEach((path) => {
            if (!get(media)[path]) return

            const data = clone(get(media)[path])
            // delete data.info
            mediaData[path] = data
        })
        if (Object.keys(mediaData).length) projectData.media = mediaData
    }

    // export to file
    send(EXPORT, ["GENERATE"], { type: "project", path: get(dataPath), name: formatToFileName(project.name), file: projectData })

    function getItem(showRef: ProjectShowRef) {
        const type = showRef.type || "show"

        if (!getProjectItems[type]) {
            console.error("Missing project type:", type)
            return
        }

        getProjectItems[type](showRef)
    }

    function getFile(path: string | undefined) {
        if (!path) return
        files.push(path)
    }

    function getOverlay(id: string) {
        if (!get(overlayStores)[id] || overlays[id]) return

        overlays[id] = clone(get(overlayStores)[id])

        // get media data from overlay "Media" items
        get(overlayStores)[id].items.forEach((item) => {
            if (item.type === "media" && item.src) {
                getFile(item.src)
            }
        })
    }

    function getEffect(id: string) {
        if (!get(effectsStores)[id] || effects[id]) return

        effects[id] = clone(get(effectsStores)[id])
    }

    function getAction(id: string) {
        if (!get(actionsStores)[id] || actions[id]) return

        actions[id] = clone(get(actionsStores)[id])
    }

    // store as base64 ?
    // let base64 = await toDataURL(showRef.id)
    // media[showRef.id] = base64
}
