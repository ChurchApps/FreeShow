import path from "path"
import { ToMain } from "../../types/IPC/ToMain"
import type { Show, Shows, TrimmedShow, TrimmedShows } from "../../types/Show"
import { sendToMain } from "../IPC/main"
import { deleteFile, doesPathExist, parseShow, readFile, readFileAsync, readFolder, readFolderAsync, renameFile } from "./files"

export function getAllShows(data: { path: string }) {
    if (!doesPathExist(data.path)) return []

    let filesInFolder: string[] = readFolder(data.path).filter((a) => a.includes(".show") && a.length > 5)
    return filesInFolder
}

export function renameShows(shows: { id: string; name: string; oldName: string }[], path: string) {
    for (const show of shows) checkFile(show)
    function checkFile(show: { id: string; name: string; oldName: string }) {
        let oldName = show.oldName + ".show"
        let newName = (show.name || show.id) + ".show"

        renameFile(path, oldName, newName)
    }
}

// WIP duplicate of setShow.ts
export function trimShow(showCache: Show) {
    let show: TrimmedShow | null = null
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
    return !!Object.values(show.layouts || {}).find((layout) => layout.slides.length)
}

export function getShowTextContent(show: Show) {
    let textContent = ""
    Object.values(show.slides || {}).forEach((slide) => {
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

export function deleteShows(data: { path: string; shows: { name: string; id: string }[] }) {
    let deleted: string[] = []

    data.shows.forEach(({ id, name }) => {
        name = (name || id) + ".show"
        let p: string = path.join(data.path, name)

        deleteFile(p)
        deleted.push(name)
    })

    refreshAllShows(data)
    return { deleted }
}

export function deleteShowsNotIndexed(data: { shows: TrimmedShows; path: string }) {
    // get all names
    let names: string[] = Object.entries(data.shows).map(([id, { name }]) => (name || id) + ".show")

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

    return { deleted }
}

export function refreshAllShows(data: { path: string }) {
    if (!doesPathExist(data.path)) return

    // list all shows in folder
    let filesInFolder: string[] = readFolder(data.path)
    if (!filesInFolder.length) return

    let newShows: TrimmedShows = {}

    for (const name of filesInFolder) loadFile(name)
    function loadFile(name: string) {
        if (!name.includes(".show")) return

        let p: string = path.join(data.path, name)
        let show = parseShow(readFile(p))

        if (!show || !show[1]) return

        const trimmedShow = trimShow({ ...show[1], name: name.replace(".show", "") })
        if (trimmedShow) newShows[show[0]] = trimmedShow
    }

    if (!Object.keys(newShows).length) return
    sendToMain(ToMain.REFRESH_SHOWS2, newShows)
}

export async function getEmptyShows(data: { path: string; cached: Shows }) {
    if (!doesPathExist(data.path)) return []

    // list all shows in folder
    let filesInFolder: string[] = await readFolderAsync(data.path)
    if (!filesInFolder.length || filesInFolder.length > 1000) return []

    let emptyShows: { id: string; name: string }[] = []

    for (const name of filesInFolder) await loadFile(name)
    async function loadFile(name: string) {
        if (!name.includes(".show")) return

        let p: string = path.join(data.path, name)
        let show = parseShow(await readFileAsync(p))
        if (!show || !show[1]) return

        // replace stored data with new unsaved cached data
        if (data.cached?.[show[0]]) show[1] = data.cached[show[0]]
        // check that it is empty
        if (showHasLayoutContent(show[1]) || getShowTextContent(show[1]).length) return

        emptyShows.push({ id: show[0], name: name.replace(".show", "") })
    }

    return emptyShows
}
