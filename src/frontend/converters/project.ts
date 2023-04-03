import { history } from "../components/helpers/history"
import { checkName } from "../components/helpers/show"

export function importProject(files: any) {
    files.forEach(({ content }: any) => {
        let { project, shows } = JSON.parse(content)

        let data = Object.entries(shows).map(([id, show]: any) => ({ id, show: { ...show, name: checkName(show.name) } }))
        history({ id: "SHOWS", newData: { data } })

        history({ id: "UPDATE", newData: { data: project }, location: { page: "show", id: "project" } })
    })
}
