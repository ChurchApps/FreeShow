import { get } from "svelte/store"
import { BIBLE } from "../../../../types/Channels"
import type { StringObject } from "../../../../types/Main"
import { bibleApiKey, scripturePath, scriptures, scripturesCache } from "../../../stores"

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
        if (!get(bibleApiKey)) return reject("No API key!")
        if (urls[load].includes("null")) return reject("Something went wrong!")

        fetch(urls[load], { headers: { "api-key": get(bibleApiKey) } })
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
        if (!scripture || (scripture.id !== active && id !== active)) return

        let customName = get(scriptures)[id]?.customName || scripture.name || get(scriptures)[id]?.name
        let isAPI = scripture.api

        if (isAPI) {
            bible.api = true
            bible.version = customName
            return
        }
        delete bible.api

        if (get(scripturesCache)[id]) {
            bible.version = customName
            bible.copyright = get(scripturesCache)[id].copyright
            bible.id = id
            return
        }

        window.api.send(BIBLE, { name: scripture.name, id: scripture.id || id, data: { index }, path: get(scripturePath) })
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
