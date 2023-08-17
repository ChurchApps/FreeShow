import { history } from "../components/helpers/history"
import { checkName } from "../components/helpers/show"

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
