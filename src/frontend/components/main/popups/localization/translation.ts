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
export async function translate(text: string, language: string, source = "auto"): Promise<string> {
    const query = `${api}?client=gtx&sl=${source}&tl=${language}&dt=t&q=${encodeURI(text)}`

    return new Promise((resolve, reject) => {
        fetch(query)
            .then(a => a.json())
            .then(json => {
                const txt: string = json?.[0]?.[0]?.[0] || ""
                return resolve(txt)
            })
            .catch(reject)
    })
}

export function getIsoLanguages() {
    return sortByName(isoLanguages).map(a => ({ value: a.code, label: `${a.name}${a.nativeName !== a.name ? " - " + a.nativeName : ""}`, prefix: a.flag }))
}

export async function translateShow(showId: string, languageCode: string) {
    const show = get(showsCache)[showId]
    const slides = clone(show.slides)
    let changed = false
    let onlyOneTextbox = true

    await Promise.all(
        Object.keys(slides).map(async slideId => {
            const items = slides[slideId].items
            const untranslatedItems = items.filter(a => !a.language)
            if (onlyOneTextbox && (untranslatedItems.length > 1 || (untranslatedItems[0]?.type || "text") !== "text")) onlyOneTextbox = false

            const toRemove = new Set<number>()
            const translations = await Promise.all(
                items.map(async (item, i) => {
                    if (item.language) {
                        // mark for removal if same language already exists on slide
                        if (item.language === languageCode) toRemove.add(i)
                        return null
                    }

                    const text = getItemTextArray(item)
                    if (!text.length) return null

                    let translatedText = ""
                    try {
                        translatedText = await translate(text.join("[-] "), languageCode)
                    } catch (err) {
                        console.warn("Error when translating:", err)
                        const tip = err.message?.includes("Failed to fetch") ? ". Check your network and try again." : ""
                        newToast("Error when translating: " + String(err) + tip)
                    }
                    if (!translatedText.length) return null

                    const translatedLines = translatedText.split("[-]")

                    const alignStyle = item.lines?.[0]?.align || ""
                    const textStyle = item.lines?.[0]?.text?.[0]?.style || ""

                    const newLines: Line[] = []
                    translatedLines.forEach(lineText => {
                        newLines.push({ align: alignStyle, text: [{ style: textStyle, value: lineText.trim() }] })
                    })

                    changed = true
                    return { ...item, language: languageCode, lines: newLines } as Item
                })
            )

            // place translated items at correct index
            if (translations.some(t => t !== null) || toRemove.size) {
                const rebuilt: Item[] = []
                for (let i = 0; i < items.length; i++) {
                    const t = translations[i]
                    if (t) rebuilt.push(t)
                    if (!toRemove.has(i)) rebuilt.push(items[i])
                }
                slides[slideId].items = rebuilt
            }
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

export function removeTranslationFromShow(showId: string, langId = "") {
    const show = get(showsCache)[showId]
    const slides = clone(show.slides)
    let changed = false

    Object.keys(slides).forEach(slideId => {
        const previousSize = slides[slideId].items.length
        slides[slideId].items = slides[slideId].items.filter(item => !item.language || (langId ? item.language !== langId : false))
        if (slides[slideId].items.length < previousSize) changed = true
    })

    if (!changed) return

    history({ id: "UPDATE", newData: { key: "slides", data: slides }, oldData: { id: showId }, location: { id: "show_key", page: "show" } })

    if (!langId) history({ id: "TEMPLATE", save: false, newData: { id: "default", location: { page: "none", override: "show#" + showId } } })
}
