import { get } from "svelte/store"
import type { Show, ShowType } from "../../types/Show"
import { history } from "../components/helpers/history"
import { getExtension, getFileName, getMediaType, removeExtension } from "../components/helpers/media"
import { checkName } from "../components/helpers/show"
import { activeProject, activeShow, folders, projects, overlays as overlayStores, media as mediaStores, alertMessage, activePopup } from "../stores"

export function importProject(files: { content: string; name?: string; extension?: string }[]) {
    files.forEach(({ content }) => {
        let { project, parentFolder, shows, overlays, media } = JSON.parse(content)

        // find any parent folder with the same name as previous parent, or place at root
        if (parentFolder) project.parent = Object.entries(get(folders)).find(([_id, folder]) => folder.name === parentFolder)?.[0] || "/"
        let projectId = project.id || ""
        delete project.id

        // add overlays
        if (overlays) {
            overlayStores.update((a) => {
                Object.entries(overlays).forEach(([id, overlay]: any) => {
                    // create new or replace existing
                    a[id] = overlay
                })
                return a
            })
        }

        // get media data
        if (media) {
            mediaStores.update((a) => {
                Object.entries(media).forEach(([path, data]: any) => {
                    a[path] = { ...(a[path] || {}), ...data }
                })
                return a
            })
        }

        // create shows
        let newShows: { id: string; show: Show }[] = []
        Object.entries(shows).forEach(([id, show]: any) => {
            if (!show) return
            newShows.push({ id, show: { ...show, name: checkName(show.name, id) } })
        })

        history({ id: "SHOWS", newData: { data: newShows, projectImport: true } })

        // create project
        history({ id: "UPDATE", newData: { data: project }, oldData: { id: projectId }, location: { page: "show", id: "project" } })
    })

    alertMessage.set("actions.imported")
    activePopup.set("alert")
}

export function addToProject(type: ShowType, filePaths: string[]) {
    let currentProject = get(activeProject)
    if (!currentProject) {
        // ALERT please open a project
        return
    }

    let projectShows = get(projects)[currentProject]?.shows || []

    let newProjectItems = filePaths.map((filePath) => {
        let name: string = getFileName(filePath)
        if (!type) type = getMediaType(getExtension(filePath))

        return { name: removeExtension(name), id: filePath, type }
    })

    let project = { key: "shows", data: [...projectShows, ...newProjectItems] }
    history({ id: "UPDATE", newData: project, oldData: { id: currentProject }, location: { page: "show", id: "project_ref" } })

    // open project item
    let lastItem = newProjectItems[newProjectItems.length - 1]
    activeShow.set({ ...lastItem, index: project.data.length - 1 })
}

export function addSection() {
    let activeShowIndex = get(activeShow)?.index !== undefined ? (get(activeShow)?.index ?? -1) + 1 : null
    let index: number = activeShowIndex ?? get(projects)[get(activeProject) || ""]?.shows?.length ?? 0

    history({ id: "UPDATE", newData: { key: "shows", index }, oldData: { id: get(activeProject) }, location: { page: "show", id: "section" } })
}
