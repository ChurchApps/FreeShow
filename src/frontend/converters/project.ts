import { get } from "svelte/store"
import { uid } from "uid"
import { history } from "../components/helpers/history"
import { checkName } from "../components/helpers/show"
import { shows } from "../stores"

export function importProject(files: any) {
  // TODO: remove duplicates ??
  files.forEach(({ content }: any) => {
    let { project, shows } = JSON.parse(content)
    Object.entries(shows).forEach(([id, show]: any) => createShow(id, show))
    history({ id: "newProject", newData: project, oldData: { id: uid() } })
  })
}

function createShow(id: string, show: any) {
  if (get(shows)[id]) return
  show.name = checkName(show.name)

  history({ id: "newShow", newData: { id, show } })
}
