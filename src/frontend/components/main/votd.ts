import { get } from "svelte/store"
import { drawerTabsData, language } from "../../stores"

// https://votd.org/
// https://github.com/ChurchApps/VotdContent/blob/main/index.html

const ONE_DAY = 1000 * 60 * 60 * 24
const getDayOfYear = () => {
    let now = new Date()
    let start = new Date(now.getFullYear(), 0, 0)
    let diff = now.getTime() - start.getTime()
    return Math.floor(diff / ONE_DAY)
}

async function fetchData(): Promise<{ text: string; reference: string } | null> {
    try {
        const response = await fetch("https://churchapps.github.io/VotdContent/v1/verses.json")
        const data = await response.json()

        const day = getDayOfYear()
        const verse = data?.verses?.[day - 1]

        return verse || null
    } catch (err) {
        return null
    }
}

export async function getVOTD(): Promise<string> {
    // verses are only in English currently
    if (!get(language).startsWith("en")) return ""
    if (get(drawerTabsData).scripture?.enabled === false) return ""

    const data = await fetchData()
    if (!data) return ""

    // WIP get actually selected Bible translation
    // problem is some translations might have a different verse on the same reference

    return `${data.text} — ${data.reference}`
}
