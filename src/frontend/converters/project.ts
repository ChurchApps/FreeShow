import { get } from "svelte/store"
import { history } from "../components/helpers/history"
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

export function addSection() {
    let activeShowIndex = get(activeShow)?.index !== undefined ? (get(activeShow)?.index || -1) + 1 : null
    let index: number = activeShowIndex ?? get(projects)[get(activeProject) || ""]?.shows?.length ?? 0

    history({ id: "UPDATE", newData: { key: "shows", index }, oldData: { id: get(activeProject) }, location: { page: "show", id: "section" } })
}
