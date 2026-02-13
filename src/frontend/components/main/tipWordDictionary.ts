import { get } from "svelte/store"
import { language } from "../../stores"
import { translateText } from "../../utils/language"

const dictionary = [
    { fallbackValue: "dynamic values", localValue: "popup.dynamic_values", tip: "Text that can change dynamically.<br>Right click any textbox to add." },
    { fallbackValue: "metadata", localValue: "tools.metadata", tip: "Information about the current show.<br>Often song attribution/source." },
    { fallbackValue: "category", localValue: "info.category", tip: "Used in the drawer to organize content." }
]

const localizedKeys = new Map<string, { word: string; fallbackWord: string; tip: string }>()
function getLocalizedKeys() {
    const lang = get(language)

    dictionary.forEach((entry) => {
        const keyId = `${lang}:${entry.localValue}`
        if (localizedKeys.has(keyId)) return

        const word = lang === "en" ? entry.fallbackValue : translateText(entry.localValue)
        const fallbackWord = entry.fallbackValue
        const tip = entry.tip

        localizedKeys.set(keyId, { word, fallbackWord, tip })
    })

    return localizedKeys
}

export function markTipString(value: string) {
    const localizedKeys = getLocalizedKeys()
    const valueLower = value.toLowerCase()

    localizedKeys.forEach((data) => {
        let hasWord = valueLower.includes(data.word) ? data.word : null
        if (!hasWord && valueLower.includes(data.fallbackWord)) hasWord = data.fallbackWord
        if (!hasWord) return

        value = value.replaceAll(new RegExp(hasWord, "gi"), `<span class="tip-word" data-title="${data.tip}">${hasWord}</span>`)
    })

    return value
}
