import { get } from "svelte/store"
import { uid } from "uid"
import { Main } from "../../types/IPC/Main"
import type { ProjectShowRef } from "../../types/Projects"
import type { Show, ShowType } from "../../types/Show"
import { keysToID } from "../components/helpers/array"
import { history } from "../components/helpers/history"
import { getExtension, getFileName, getMediaType, removeExtension } from "../components/helpers/media"
import { checkName } from "../components/helpers/show"
import { sendMain } from "../IPC/main"
import { actions as actionsStores, activePage, activePopup, activeProject, activeShow, alertMessage, editingProjectTemplate, effects as effectsStores, focusMode, folders, media as mediaStores, overlays as overlayStores, projects, projectTemplates, projectView, recentFiles } from "../stores"
import { translateText } from "../utils/language"
import { confirmCustom } from "../utils/popup"
import { audioExtensions, mediaExtensions } from "../values/extensions"
import { newToast } from "../utils/common"

export function importProject(files: { content: string; path?: string; name?: string; extension?: string }[]) {
    files.forEach(({ content, path }) => {
        const { project, parentFolder, shows, overlays, effects, actions, media } = JSON.parse(content)
        if (!project) return

        // find any parent folder with the same name as previous parent, or place at root
        if (parentFolder) project.parent = Object.entries(get(folders)).find(([_id, folder]) => folder.name === parentFolder)?.[0] || "/"
        const projectId = project.id || ""
        delete project.id
        if (path) project.sourcePath = path

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

    if (get(activePopup)) {
        alertMessage.set("actions.imported")
        activePopup.set("alert")
    } else {
        newToast("actions.imported")
    }
}

export function addToProject(type: ShowType | null, filePaths: string[]) {
    const isTemplate = !!get(editingProjectTemplate)
    let projectId = isTemplate ? get(editingProjectTemplate) : get(activeProject)
    if (!isTemplate && !projectId) {
        // get the latest empty project
        projectId =
            Object.entries(get(projects))
                .sort((a, b) => a[1].created - b[1].created)
                .find(([_id, project]) => project.shows && !project.shows.length)?.[0] || null

        if (!projectId) {
            // auto-create a new project
            projectId = uid()
            history({ id: "UPDATE", oldData: { id: projectId }, location: { page: "show", id: "project" } })
        }

        activeProject.set(projectId)
        projectView.set(false)
    }
    if (!projectId) return

    const currentProject = isTemplate ? get(projectTemplates)[projectId] : get(projects)[projectId]
    const projectShows = currentProject?.shows || []

    const newProjectItems = filePaths.map((filePath) => {
        const name: string = getFileName(filePath)
        if (!type) type = getMediaType(getExtension(filePath))

        return { name: removeExtension(name), id: filePath, type }
    })

    const project = { key: "shows", data: [...projectShows, ...newProjectItems] }
    history({ id: "UPDATE", newData: project, oldData: { id: projectId }, location: { page: "show", id: isTemplate ? "project_template" : "project_ref" } })

    // open project item
    const lastItem = newProjectItems[newProjectItems.length - 1]
    activeShow.set({ ...lastItem, index: project.data.length - 1 })
}

export function addProjectItem(data: ProjectShowRef) {
    const isTemplate = !!get(editingProjectTemplate)
    const projectId = isTemplate ? get(editingProjectTemplate) : get(activeProject)
    if (!projectId) return

    const currentProject = isTemplate ? get(projectTemplates)[projectId] : get(projects)[projectId]
    const projectShows = currentProject?.shows || []

    const project = { key: "shows", data: [...projectShows, data] }
    history({ id: "UPDATE", newData: project, oldData: { id: projectId }, location: { page: "show", id: isTemplate ? "project_template" : "project_ref" } })

    if (get(focusMode)) return

    // open project item
    activePage.set("show")
    activeShow.set({ ...data, index: project.data.length - 1 })
}

export function addSection() {
    const activeShowIndex = get(activeShow)?.index !== undefined ? (get(activeShow)?.index ?? -1) + 1 : null
    const isTemplate = !!get(editingProjectTemplate)
    const projectId = isTemplate ? get(editingProjectTemplate) : get(activeProject)
    if (!projectId) return

    const index: number = activeShowIndex ?? (isTemplate ? get(projectTemplates)[projectId]?.shows?.length : get(projects)[projectId]?.shows?.length) ?? 0

    history({ id: "UPDATE", newData: { key: "shows", index }, oldData: { id: projectId }, location: { page: "show", id: "section" + (isTemplate ? "_template" : "") } })
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

// recently added files
const projectMediaExtensions = ["pdf", ...mediaExtensions, ...audioExtensions]
export async function updateRecentlyAddedFiles(paths: string[] | null = null) {
    if (paths === null) paths = get(recentFiles).all || []
    const cleared = get(recentFiles).cleared || []
    const filteredPaths = paths.filter((a) => !cleared.includes(a))

    let projectFiles: { path: string; name: string }[] = []
    let projectMedia: string[] = []

    filteredPaths.forEach((a) => {
        const ext = getExtension(a)

        if (ext === "project") {
            // check if project with same name already exists
            const name = removeExtension(getFileName(a))
            const existingProject = Object.values(get(projects)).find((b) => b.name === name)
            // WIP check actual content name/id?
            if (existingProject) return

            projectFiles.push({ path: a, name })
        } else if (projectMediaExtensions.includes(ext)) {
            projectMedia.push(a)
        }
    })

    recentFiles.set({ all: filteredPaths, cleared, projectMedia })

    // auto import recent project file
    const projectFile = projectFiles[0]
    if (!projectFile) return

    const importProject = await confirmCustom(`${translateText("actions.import_project_file")}<br><b>${projectFile.name}</b>`)
    recentFiles.update((a) => ({ ...a, cleared: [...a.cleared, ...projectFiles.map((p) => p.path)] }))
    if (!importProject) return

    sendMain(Main.IMPORT_FILES, { id: "freeshow_project", paths: [projectFile.path] })
}

export function markItemsAsPlayed(indexes: number[] | "active", customNewState?: boolean | undefined) {
    const projectId = get(activeProject)
    if (!projectId) return

    if (indexes === "active") {
        const activeShowIndex = get(activeShow)?.index
        if (activeShowIndex === undefined) return
        indexes = [activeShowIndex]
    }

    projects.update((a) => {
        if (!a[projectId]?.shows) return a

        const newState = customNewState === undefined ? !a[projectId].shows[indexes[0]]?.played : customNewState

        indexes.forEach((index) => {
            if (!a[projectId].shows[index]) return
            if (typeof a[projectId].shows[index] !== "object") return

            a[projectId].shows[index].played = newState
        })

        return a
    })
}
