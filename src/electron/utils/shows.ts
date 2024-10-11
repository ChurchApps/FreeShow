import path from "path"
import { toApp } from ".."
import { Show } from "../../types/Show"
import { deleteFile, doesPathExist, parseShow, readFile, readFolder, renameFile } from "./files"

export function getAllShows(data: any) {
    if (!doesPathExist(data.path)) return []

    let filesInFolder: string[] = readFolder(data.path).filter((a) => a.includes(".show") && a.length > 5)
    return filesInFolder
}

export function renameShows(shows: any, path: string) {
    for (const show of shows) checkFile(show)
    function checkFile(show: any) {
        let oldName = show.oldName + ".show"
        let newName = (show.name || show.id) + ".show"

        renameFile(path, oldName, newName)
    }
}

// WIP duplicate of setShow.ts
export function trimShow(showCache: Show) {
    let show: any = {}
    if (!showCache) return show

    show = {
        name: showCache.name,
        category: showCache.category,
        timestamps: showCache.timestamps,
        quickAccess: showCache.quickAccess || {},
    }
    if (showCache.private) show.private = true
    if (showCache.locked) show.locked = true

    return show
}

/////

// let hasContent = !!Object.values(show.slides).find((slide) => slide.items.find((item) => item.lines?.find((line) => line.text?.find((text) => text.value?.length))))

function showHasLayoutContent(show: Show) {
    return !!Object.values(show.layouts).find((layout) => layout.slides.length)
}

export function getShowTextContent(show: Show) {
    let textContent = ""
    Object.values(show.slides).forEach((slide) => {
        slide.items.forEach((item) => {
            item.lines?.forEach((line) => {
                line.text?.forEach((text) => {
                    textContent += text.value
                })
            })
        })
    })
    return textContent
}

/////

export function deleteShows(data: any) {
    let deleted: string[] = []

    data.shows.forEach(({ id, name }: any) => {
        name = (name || id) + ".show"
        let p: string = path.join(data.path, name)

        deleteFile(p)
        deleted.push(name)
    })

    refreshAllShows(data)
    toApp("MAIN", { channel: "DELETE_SHOWS", data: { deleted } })
}

export function deleteShowsNotIndexed(data: any) {
    // get all names
    let names: string[] = Object.entries(data.shows).map(([id, { name }]: any) => (name || id) + ".show")

    // list all shows in folder
    let filesInFolder: string[] = readFolder(data.path)
    if (!filesInFolder.length) return

    let deleted: string[] = []

    for (const name of filesInFolder) checkFile(name)
    function checkFile(name: string) {
        if (names.includes(name) || !name.includes(".show")) return

        let p: string = path.join(data.path, name)
        deleteFile(p)
        deleted.push(name)
    }

    toApp("MAIN", { channel: "DELETE_SHOWS", data: { deleted } })
}

export function refreshAllShows(data: any) {
    if (!doesPathExist(data.path)) return

    // list all shows in folder
    let filesInFolder: string[] = readFolder(data.path)
    if (!filesInFolder.length) return

    let newShows: any = {}

    for (const name of filesInFolder) loadFile(name)
    function loadFile(name: string) {
        if (!name.includes(".show")) return

        let p: string = path.join(data.path, name)
        let show = parseShow(readFile(p))

        if (!show || !show[1]) return

        newShows[show[0]] = trimShow({ ...show[1], name: name.replace(".show", "") })
    }

    if (!Object.keys(newShows).length) return
    toApp("MAIN", { channel: "REFRESH_SHOWS", data: newShows })
}

export function getEmptyShows(data: any) {
    if (!doesPathExist(data.path)) return []

    // list all shows in folder
    let filesInFolder: string[] = readFolder(data.path)
    if (!filesInFolder.length) return []

    let emptyShows: { id: string; name: string }[] = []

    for (const name of filesInFolder) loadFile(name)
    function loadFile(name: string) {
        if (!name.includes(".show")) return

        let p: string = path.join(data.path, name)
        let show = parseShow(readFile(p))
        if (!show || !show[1]) return

        // replace stored data with new unsaved cached data
        if (data.cached?.[show[0]]) show[1] = data.cached[show[0]]
        // check that it is empty
        if (showHasLayoutContent(show[1]) || getShowTextContent(show[1]).length) return

        emptyShows.push({ id: show[0], name: name.replace(".show", "") })
    }

    return emptyShows
}
