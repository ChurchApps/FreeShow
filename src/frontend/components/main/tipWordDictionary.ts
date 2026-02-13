import { get } from "svelte/store"
import { language } from "../../stores"
import { translateText } from "../../utils/language"

const dictionary = [
    { fallback: "dynamic values", key: "popup.dynamic_values", tip: "Text that can change dynamically.<br>Right click any textbox to add." },
    { fallback: "metadata", key: "tools.metadata", tip: "Information about the current show.<br>Often song attribution/source." },
    { fallback: "category", key: "info.category", tip: "Used in the drawer to organize content." }
]

type TipData = { tip: string }
let compiled: { lang: string; regex: RegExp; map: Map<string, TipData> } | null = null

function ensureCompiled() {
    const lang = get(language)
    if (compiled?.lang === lang) return compiled

    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    const map = new Map<string, TipData>()
    const words: string[] = []

    for (const entry of dictionary) {
        const word = lang === "en" ? entry.fallback : translateText(entry.key)

        for (const w of [word, entry.fallback]) {
            const lower = w.toLowerCase()
            map.set(lower, { tip: entry.tip })
            words.push(escapeRegex(w))
        }
    }

    // longest first avoids partial matches ("meta" before "metadata")
    words.sort((a, b) => b.length - a.length)

    compiled = { lang, regex: new RegExp(`\\b(${words.join("|")})\\b`, "gi"), map }
    return compiled
}

export function markTipString(value: string) {
    const { regex, map } = ensureCompiled()

    return value.replace(regex, (match) => {
        const data = map.get(match.toLowerCase())
        if (!data) return match

        return `<span class="tip-word" data-title="${data.tip}">${match}</span>`
    })
}
