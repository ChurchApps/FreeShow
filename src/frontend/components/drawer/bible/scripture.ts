import { get } from "svelte/store"
import { BIBLE } from "../../../../types/Channels"
import type { StringObject } from "../../../../types/Main"
import { scripturePath, scriptures, scripturesCache } from "../../../stores"

// API.Bible key. Will propably change in the future (Please don't abuse)
let key: string = "320b5b593fa790ced135a98861de51a9"

export async function fetchBible(load: string, active: string, ref: any = { versesList: [], bookId: "GEN", chapterId: "GEN.1" }) {
    const api = "https://api.scripture.api.bible/v1/bibles/"
    let versesId: any = null
    if (ref.versesList.length) {
        versesId = ref.versesList[0].id + "-" + ref.versesList[ref.versesList.length - 1].id
        versesId = versesId.split("-")
        versesId = versesId[0] + "-" + versesId[versesId.length - 1]
    }

    const urls: StringObject = {
        books: `${api}${active}/books`,
        chapters: `${api}${active}/books/${ref.bookId}/chapters`,
        verses: `${api}${active}/chapters/${ref.chapterId}/verses`,
        versesText: `${api}${active}/verses/${versesId}`,
    }

    return new Promise((resolve, reject) => {
        if (urls[load].includes("null")) return reject("Something went wrong!")

        fetch(urls[load], { headers: { "api-key": key } })
            .then((response) => response.json())
            .then((data) => {
                resolve(data.data)
            })
            .catch((e) => {
                reject(e)
            })
    })
}

export function loadBible(active: string, index: number = 0, bible: any) {
    Object.entries(get(scriptures)).forEach(([id, scripture]: any) => {
        if (scripture.id !== active && id !== active) return
        let name = scripture.name
        let isAPI = scripture.api

        if (isAPI) {
            bible.api = true
            bible.version = name
            return
        }
        delete bible.api

        if (get(scripturesCache)[id]) {
            bible.version = name
            bible.copyright = get(scripturesCache)[id].copyright
            bible.id = id
            return
        }

        window.api.send(BIBLE, { name, id: scripture.id || id, data: { index }, path: get(scripturePath) })
    })

    return bible
}

export function joinRange(array: string[]) {
    let prev: number = -1
    let range: string = ""
    array.forEach((a: string, i: number) => {
        if (Number(a) - 1 === prev) {
            if (i + 1 === array.length) range += "-" + a
        } else {
            if (range.length) {
                if (prev !== Number(range[range.length - 1])) range += "-" + prev
                range += "+"
            }
            range += a
        }
        prev = Number(a)
    })
    return range
}
