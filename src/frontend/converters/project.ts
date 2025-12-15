import { get } from "svelte/store"
import type { ProjectShowRef } from "../../types/Projects"
import type { Show, ShowType } from "../../types/Show"
import { keysToID } from "../components/helpers/array"
import { history } from "../components/helpers/history"
import { getExtension, getFileName, getMediaType, removeExtension } from "../components/helpers/media"
import { checkName } from "../components/helpers/show"
import { actions as actionsStores, activePage, activePopup, activeProject, activeShow, alertMessage, effects as effectsStores, focusMode, folders, media as mediaStores, overlays as overlayStores, projects } from "../stores"

export function importProject(files: { content: string; name?: string; extension?: string }[]) {
    files.forEach(({ content }) => {
        const { project, parentFolder, shows, overlays, effects, actions, media } = JSON.parse(content)
        if (!project) return

        // find any parent folder with the same name as previous parent, or place at root
        if (parentFolder) project.parent = Object.entries(get(folders)).find(([_id, folder]) => folder.name === parentFolder)?.[0] || "/"
        const projectId = project.id || ""
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

        // add effects
        if (effects) {
            effectsStores.update((a) => {
                Object.entries(effects).forEach(([id, effect]: any) => {
                    // create new or replace existing
                    a[id] = effect
                })
                return a
            })
        }

        // add actions
        if (actions) {
            actionsStores.update((a) => {
                Object.entries(actions).forEach(([id, action]: any) => {
                    // create new or replace existing
                    a[id] = action
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
        const newShows: { id: string; show: Show }[] = []
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
    const currentProject = get(activeProject)
    if (!currentProject) {
        // ALERT please open a project
        return
    }

    const projectShows = get(projects)[currentProject]?.shows || []

    const newProjectItems = filePaths.map((filePath) => {
        const name: string = getFileName(filePath)
        if (!type) type = getMediaType(getExtension(filePath))

        return { name: removeExtension(name), id: filePath, type }
    })

    const project = { key: "shows", data: [...projectShows, ...newProjectItems] }
    history({ id: "UPDATE", newData: project, oldData: { id: currentProject }, location: { page: "show", id: "project_ref" } })

    // open project item
    const lastItem = newProjectItems[newProjectItems.length - 1]
    activeShow.set({ ...lastItem, index: project.data.length - 1 })
}

export function addProjectItem(data: ProjectShowRef) {
    const currentProject = get(activeProject)
    if (!currentProject) return

    const projectShows = get(projects)[currentProject]?.shows || []

    const project = { key: "shows", data: [...projectShows, data] }
    history({ id: "UPDATE", newData: project, oldData: { id: currentProject }, location: { page: "show", id: "project_ref" } })

    if (get(focusMode)) return

    // open project item
    activePage.set("show")
    activeShow.set({ ...data, index: project.data.length - 1 })
}

export function addSection() {
    const activeShowIndex = get(activeShow)?.index !== undefined ? (get(activeShow)?.index ?? -1) + 1 : null
    const index: number = activeShowIndex ?? get(projects)[get(activeProject) || ""]?.shows?.length ?? 0

    history({ id: "UPDATE", newData: { key: "shows", index }, oldData: { id: get(activeProject) }, location: { page: "show", id: "section" } })
}

export function getProjectsInFolder(id: string) {
    let projectIds: string[] = []
    let folderIds: string[] = []

    const projectsList = keysToID(get(projects))
    const foldersList = keysToID(get(folders))

    const foldersToCheck = [id]
    while (foldersToCheck.length > 0) {
        const folderId = foldersToCheck.pop()
        if (!folderId) continue

        projectsList.forEach((a) => {
            if (a.parent === folderId) projectIds.push(a.id)
        })

        // add subfolders
        foldersList.forEach((a) => {
            if (a.parent === folderId) {
                folderIds.push(a.id)
                foldersToCheck.push(a.id)
            }
        })
    }

    return { projectIds, folderIds }
}
