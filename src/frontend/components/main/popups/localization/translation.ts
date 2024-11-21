import { get } from "svelte/store"
import type { Item, Line } from "../../../../../types/Show"
import { showsCache, templates } from "../../../../stores"
import { newToast } from "../../../../utils/common"
import { createDoubleTemplate } from "../../../../utils/createData"
import { getItemTextArray } from "../../../edit/scripts/textStyle"
import { clone, sortByName } from "../../../helpers/array"
import { history } from "../../../helpers/history"
import { isoLanguages } from "./isoLanguages"

// https://www.npmjs.com/package/translate
// https://github.com/ssut/py-googletrans/issues/268

const api = "https://translate.googleapis.com/translate_a/single"
export async function translate(text: string, language: string, source: string = "auto"): Promise<string> {
    const query = `${api}?client=gtx&sl=${source}&tl=${language}&dt=t&q=${encodeURI(text)}`

    return new Promise((resolve, reject) => {
        fetch(query)
            .then((a) => a.json())
            .then((text) => {
                text = text?.[0]?.[0]?.[0]
                if (!text) reject("Could not get translation!")
                return resolve(text)
            })
            .catch(reject)
    })
}

export function getIsoLanguages() {
    return sortByName(isoLanguages).map((a) => ({ id: a.code, name: `${a.flag ? a.flag + " " : ""}${a.name}${a.nativeName !== a.name ? " - " + a.nativeName : ""}` }))
}

export async function translateShow(showId: string, languageCode: string) {
    let show = get(showsCache)[showId]
    let slides = clone(show.slides)
    let changed = false
    let onlyOneTextbox = true

    await Promise.all(
        Object.keys(slides).map(async (slideId) => {
            let newItems: Item[] = []

            let items = slides[slideId].items.filter((a) => !a.language)
            if (onlyOneTextbox && (items.length > 1 || (items[0]?.type || "text") !== "text")) onlyOneTextbox = false

            await Promise.all(
                slides[slideId].items.map(async (item, i) => {
                    if (item.language) {
                        // remove if same as new
                        if (item.language === languageCode) slides[slideId].items.splice(i, 1)
                        return
                    }

                    let text = getItemTextArray(item)
                    if (!text.length) return

                    let translatedText = ""
                    try {
                        translatedText = await translate(text.join("[-] "), languageCode)
                    } catch (err) {
                        console.warn("Error when translating:", err)
                        let tip = err.message?.includes("Failed to fetch") ? ". Check your network and try again." : ""
                        newToast("Error when translating: " + err + tip)
                    }
                    if (!translatedText.length) return

                    let translatedLines = translatedText.split("[-]")

                    const alignStyle = item.lines?.[0]?.align || ""
                    const textStyle = item.lines?.[0]?.text?.[0]?.style || ""

                    let newLines: Line[] = []
                    translatedLines.forEach((lineText) => {
                        newLines.push({ align: alignStyle, text: [{ style: textStyle, value: lineText.trim() }] })
                    })

                    newItems.push({ ...item, language: languageCode, lines: newLines })
                    changed = true
                })
            )

            if (newItems.length) slides[slideId].items = [...newItems, ...slides[slideId].items]
        })
    )

    if (!changed) return

    history({ id: "UPDATE", newData: { key: "slides", data: slides }, oldData: { id: showId }, location: { id: "show_key", page: "show" } })

    // set custom template
    if (onlyOneTextbox) {
        // show.settings?.template
        if (!get(templates).double) createDoubleTemplate()
        history({ id: "TEMPLATE", save: false, newData: { id: "double", location: { page: "none", override: "show#" + showId } } })
    }
}

export function removeTranslationFromShow(showId: string, langId: string = "") {
    let show = get(showsCache)[showId]
    let slides = clone(show.slides)
    let changed = false

    Object.keys(slides).forEach((slideId) => {
        let previousSize = slides[slideId].items.length
        slides[slideId].items = slides[slideId].items.filter((item) => !item.language || (langId ? item.language !== langId : false))
        if (slides[slideId].items.length < previousSize) changed = true
    })

    if (!changed) return

    history({ id: "UPDATE", newData: { key: "slides", data: slides }, oldData: { id: showId }, location: { id: "show_key", page: "show" } })

    if (!langId) history({ id: "TEMPLATE", save: false, newData: { id: "default", location: { page: "none", override: "show#" + showId } } })
}
