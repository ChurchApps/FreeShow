import { get } from "svelte/store"
import type { ShowType } from "../../types/Show"
import { history } from "../components/helpers/history"
import { getExtension, getFileName, getMediaType, removeExtension } from "../components/helpers/media"
import { checkName } from "../components/helpers/show"
import { activeProject, activeShow, projects } from "../stores"

export function importProject(files: any) {
    files.forEach(({ content }: any) => {
        let { project, shows } = JSON.parse(content)

        let newShows: any[] = []
        Object.entries(shows).forEach(([id, show]: any) => {
            if (!show) return
            newShows.push({ id, show: { ...show, name: checkName(show.name, id) } })
        })

        history({ id: "SHOWS", newData: { data: newShows } })

        history({ id: "UPDATE", newData: { data: project }, location: { page: "show", id: "project" } })
    })
}

export function addToProject(type: ShowType, filePaths: string[]) {
    let currentProject = get(activeProject)
    if (!currentProject) {
        // ALERT please open a project
        return
    }

    let projectShows = get(projects)[currentProject]?.shows || []

    let newProjectItems = filePaths.map((filePath: any) => {
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
    let activeShowIndex = get(activeShow)?.index !== undefined ? (get(activeShow)?.index || -1) + 1 : null
    let index: number = activeShowIndex ?? get(projects)[get(activeProject) || ""]?.shows?.length ?? 0

    history({ id: "UPDATE", newData: { key: "shows", index }, oldData: { id: get(activeProject) }, location: { page: "show", id: "section" } })
}
