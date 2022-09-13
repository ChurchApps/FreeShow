import { get } from "svelte/store"
import { activeShow, shows } from "../../stores"

// check if name axists and add number
export function checkName(name: string = "") {
  let number = 1
  // remove illegal file name characters
  name = name.trim().replace(/[/\\?%*:|"<>]/g, "")
  // max 255 length
  if (name.length > 255) name = name.slice(0, 255)
  while (Object.values(get(shows)).find((a: any) => a.name === (number > 1 ? name + " " + number : name))) number++
  return number > 1 ? name + " " + number : name
}

export function getLabelId(label: string) {
  // TODO: disallow chars in labels: #:;!.,- ??
  return label
    .toLowerCase()
    .replace(/x[0-9]/g, "")
    .replace(/[[\]]/g, "")
    .replace(/[0-9'"]/g, "")
    .trim()
    .replaceAll(" ", "_")
}

// mirror & events
export function getListOfShows(removeCurrent: boolean = false) {
  let list: any[] = Object.entries(get(shows)).map(([id, show]: any) => ({ id, name: show.name }))
  if (removeCurrent) list = list.filter((a) => a.id !== get(activeShow)?.id)
  list = list.sort((a, b) => a.name?.localeCompare(b.name))
  return list
}
