import { get } from "svelte/store"
import type { Slide } from "../../../types/Show"
import { activeShow, dictionary, groups, shows } from "../../stores"

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

// convert any text to a label id format
export function getLabelId(label: string) {
    // TODO: disallow chars in labels: #:;!.,- ??
    return label
        .toLowerCase()
        .replace(/x[0-9]/g, "")
        .replace(/[[\]]/g, "")
        .replace(/[0-9'"]/g, "")
        .trim()
        .replaceAll(" ", "_")
        .replaceAll("-", "_")
    // .replace(/[0-9-]/g, "")
}

// check if label exists as a global label
export function getGlobalGroup(group: string, returnInputIfNull: boolean = false): string {
    group = getLabelId(group)

    if (get(groups)[group]) return group

    let globalGroup: any = ""
    Object.entries(get(dictionary).groups).forEach(([groupId, name]) => {
        if (name.toLowerCase() === group) globalGroup = groupId
    })
    return globalGroup || (returnInputIfNull ? group : "")
}

// mirror & events
export function getListOfShows(removeCurrent: boolean = false) {
    let list: any[] = Object.entries(get(shows)).map(([id, show]: any) => ({ id, name: show.name }))
    if (removeCurrent) list = list.filter((a) => a.id !== get(activeShow)?.id)
    list = list.sort((a, b) => a.name?.localeCompare(b.name))
    return list
}

// meta
export function initializeMetadata({ title = "", artist = "", author = "", composer = "", publisher = "", copyright = "", CCLI = "", year = "" }) {
    return { title, artist, author, composer, publisher, copyright, CCLI, year }
}

// create new slides
export function newSlide(data: any): Slide {
    return {
        group: null,
        color: null,
        settings: {},
        notes: "",
        items: [],
        ...data,
    }
}
