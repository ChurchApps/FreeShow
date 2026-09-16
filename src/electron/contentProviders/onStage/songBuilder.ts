import { uid } from "uid"
import type { Show, SlideData } from "../../../types/Show"

type OnStageSlide = { lines: string[] }
export type OnStageSection = {
    label: string
    number: number
    name: string
    repeats: number
    notes: string | null
    instrumental: boolean
    unscheduled: boolean
    slides: OnStageSlide[]
}
export type OnStageSong = {
    id: string
    title: string
    artist: string | null
    key: string | null
    originalKey: string | null
    tempo: number | null
    meter: string | null
    ccli: string | null
    copyright: string | null
    sections: OnStageSection[]
}

const ITEM_STYLE = "left:50px;top:120px;width:1820px;height:840px;"
const MAX_REPEAT_OCCURRENCES = 16

export type SongBuild = {
    show: Show
    // section key -> parent slide id
    parentBySection: { [key: string]: string }
    // section numbers that landed on each group, to drop the number from a merged group's name
    numbersByParent: { [key: string]: number[] }
    // the ordered slide ids of an arrangement -> its layout id, so services that play the song
    // the same way share one arrangement instead of adding a duplicate
    layoutBySignature: { [key: string]: string }
}

export function createSongBuild(song: OnStageSong): SongBuild {
    const title = song.title || ""
    return {
        show: {
            name: title,
            category: "onstage",
            timestamps: { created: Date.now(), modified: null, used: null },
            meta: {
                title,
                artist: song.artist || "",
                CCLI: song.ccli || "",
                copyright: song.copyright || "",
                key: song.key || ""
            },
            settings: { activeLayout: "", template: null },
            layouts: {},
            slides: {},
            media: {}
        },
        parentBySection: {},
        numbersByParent: {},
        layoutBySignature: {}
    }
}

/**
 * Add one service's arrangement of a song to the show, reusing the slides (and the arrangement
 * itself) whenever the same structure was already built. Returns the layout id the service item
 * should point at.
 */
export function addSongArrangement(build: SongBuild, song: OnStageSong, arrangementName: string): string {
    const { show, parentBySection, numbersByParent } = build
    const layoutSlides: SlideData[] = []
    const layoutKeys: string[] = []

    for (const section of song.sections) {
        const sectionSlides = section.slides.length ? section.slides : [{ lines: [] }]

        // Same label + identical lyrics is one group: OnStage numbers every occurrence, so a song
        // repeating its chorus verbatim would otherwise import as Chorus 1, Chorus 2, Chorus 3.
        // An empty (instrumental) section has no lyrics to compare, so it stays keyed by number.
        const signature = getLyricsSignature(sectionSlides)
        const sectionKey = signature ? `${section.label}|${signature}` : `${section.label} ${section.number}`
        
        let parentId = parentBySection[sectionKey]
        if (!parentId) {
            const children: string[] = []

            sectionSlides.forEach((sectionSlide, i) => {
                const slideId = uid()
                const isParent = i === 0

                show.slides[slideId] = {
                    group: isParent ? section.name : null,
                    ...(isParent ? { globalGroup: section.label.toLowerCase() } : {}),
                    color: null,
                    settings: {},
                    notes: section.notes || "",
                    items: sectionSlide.lines.length ? [{
                        style: ITEM_STYLE,
                        lines: sectionSlide.lines.map((line) => ({ align: "", text: [{ style: "", value: line }] }))
                    }] : []
                }

                if (isParent) parentId = slideId
                else children.push(slideId)
            })

            if (children.length && parentId) show.slides[parentId].children = children
            parentBySection[sectionKey] = parentId!
        }

        if (!numbersByParent[parentId]) numbersByParent[parentId] = []
        const numbers = numbersByParent[parentId]
        if (!numbers.includes(section.number)) numbers.push(section.number)

        // A muted (repeats 0) or unscheduled section stays part of the song but out of the
        // presented layout; an instrumental section is presented as a single empty slide; a
        // repeated section is referenced by the layout once per play-through.
        const occurrences = section.unscheduled ? 0 : Math.min(section.repeats, MAX_REPEAT_OCCURRENCES)
        if (section.repeats > MAX_REPEAT_OCCURRENCES) console.warn(`OnStage: capping section "${section.name}" of "${song.title}" from ${section.repeats} to ${MAX_REPEAT_OCCURRENCES} repeats`)
        for (let repeat = 0; repeat < occurrences; repeat++) {
            layoutSlides.push({ id: parentId! })
            layoutKeys.push(sectionKey)
        }
    }

    const arrangementSignature = layoutKeys.join(",")
    const knownLayoutId = build.layoutBySignature[arrangementSignature]
    if (knownLayoutId) return knownLayoutId

    const isFirst = !Object.keys(show.layouts).length
    const layoutId = getStableLayoutId(`${song.id}|${arrangementSignature}`)
    show.layouts[layoutId] = { 
        name: isFirst ? "Default" : getUniqueLayoutName(show, arrangementName), 
        notes: "", 
        slides: layoutSlides 
    }
    build.layoutBySignature[arrangementSignature] = layoutId
    if (isFirst) show.settings.activeLayout = layoutId

    return layoutId
}

// Matches anything that is NOT a Unicode letter (\p{L}), number (\p{N}), or space
const NON_LYRIC_REGEX = /[^\p{L}\p{N}\s]/gu
function getLyricsSignature(sectionSlides: { lines: string[] }[]): string {
    return sectionSlides
        .flatMap((slide) => slide.lines || [])
        .map((line) => line.toLowerCase().replace(NON_LYRIC_REGEX, "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
}

/**
 * An arrangement id derived from its content instead of a random one, so re-syncing (or reloading
 * a single song) rebuilds the same ids and the project items keep pointing at the right
 * arrangement. FNV-1a plus the length is plenty to keep a song's handful of arrangements apart.
 */
function getStableLayoutId(signature: string): string {
    let hash = 0x811c9dc5
    for (let i = 0; i < signature.length; i++) {
        hash ^= signature.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193)
    }
    return `os${(hash >>> 0).toString(36)}${signature.length.toString(36)}`
}

function getUniqueLayoutName(show: Show, name: string): string {
    const takenNames = new Set(Object.values(show.layouts).map((l) => l.name))
    if (!takenNames.has(name)) return name

    let counter = 2
    while (takenNames.has(`${name} ${counter}`)) counter++
    return `${name} ${counter}`
}

export function finalizeSongBuild(build: SongBuild): Show {
    // a group that absorbed more than one numbered section is no longer "the second chorus"
    for (const [parentId, numbers] of Object.entries(build.numbersByParent)) {
        if (numbers.length < 2) continue
        const group = build.show.slides[parentId]?.group
        if (group) build.show.slides[parentId].group = stripSectionNumber(group)
    }
    return build.show
}

// "Chorus 2" -> "Chorus": used when a label's numbered sections all collapsed into one group.
function stripSectionNumber(name: string): string {
    return name.replace(/\s*\d+\s*$/, "").trim() || name
}