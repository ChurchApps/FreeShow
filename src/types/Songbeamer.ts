export enum TranslationMethod {
    MultiLine = "multiline",
    Textboxes = "textboxes",
    Layouts = "layouts"
}

// Shared between the frontend SongBeamer importer and the Electron CT provider

export const SNG_SECTION_RE = /(?:^|\n)--(?:-|A)?\s*\n/

const SongbeamerGroups: Record<string, string> = {
    unbekannt: "", unbenannt: "", unknown: "",
    intro: "Intro",
    vers: "Verse", verse: "Verse", strophe: "Verse",
    "pre-bridge": "Pre-Bridge", bridge: "Bridge",
    misc: "Misc",
    "pre-refrain": "Pre-Chorus", refrain: "Chorus",
    "pre-chorus": "Pre-Chorus", chorus: "Chorus",
    zwischenspiel: "Break", instrumental: "Break", interlude: "Break",
    "pre-coda": "Pre-Outro", coda: "Outro", ending: "Outro", outro: "Outro",
    teil: "Tag", part: "Tag", chor: "Tag", solo: "Tag"
}

const SongbeamerGlobalGroups: Record<string, string> = {
    Intro: "intro", Verse: "verse", "Pre-Bridge": "pre_bridge", Bridge: "bridge",
    "Pre-Chorus": "pre_chorus", Chorus: "chorus", Break: "break",
    "Pre-Outro": "pre_outro", Outro: "outro", Tag: "tag"
}

export function sngSlideTagToGroup(line: string): { group: string | null; globalGroup: string | null; groupNumber: number | null } {
    if (line.charAt(0) === "#") return { group: null, globalGroup: null, groupNumber: null }
    const parts = line.split(" ", 2)
    const tag = parts[0].toLowerCase()
    let groupNumber: number | null = parseInt(parts[1], 10)
    if (parts.length < 2 || isNaN(groupNumber) || groupNumber < 1) groupNumber = null

    let group: string | null = null
    let globalGroup: string | null = null
    if (tag in SongbeamerGroups) {
        group = SongbeamerGroups[tag]
        if (group in SongbeamerGlobalGroups) globalGroup = SongbeamerGlobalGroups[group]
    }
    return { group, globalGroup, groupNumber }
}

export interface SngMeta {
    title: string
    author: string
    composer: string
    ccli: string
    key: string
    copyright: string
}

// Lightweight header parser — extracts only the fields needed for song matching and slide metadata.
export function parseSngMeta(text: string): SngMeta {
    const meta: SngMeta = { title: "", author: "", composer: "", ccli: "", key: "", copyright: "" }
    const headerSection = text.split(SNG_SECTION_RE)[0]
    for (const line of headerSection.split("\n")) {
        if (!line || line[0] !== "#") continue
        const eq = line.indexOf("=")
        if (eq < 2) continue
        const val = line.slice(eq + 1).trim()
        switch (line.slice(1, eq)) {
            case "Title":   meta.title    = val; break
            case "Author":  meta.author   = val; break
            case "Melody":  meta.composer  = val; break
            case "Key":     meta.key       = val; break
            case "(c)":     meta.copyright = val; break
            case "CCLI": {
                let i = 0
                while (i < val.length && val[i] >= "0" && val[i] <= "9") i++
                meta.ccli = val.slice(0, i)
                break
            }
        }
    }
    return meta
}
