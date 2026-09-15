/**
 * Builds a FreeShow show out of the songs OnStage schedules.
 *
 * Kept free of electron imports so it can be reasoned about (and tested) on its own: it takes
 * OnStage's song payload plus the user's formatting settings and returns show data, nothing else.
 */

import { uid } from "uid"
import type { Show, SlideData } from "../../../types/Show"
import { formatSectionSlides, getLyricsSignature, stripSectionNumber, type OnStageFormatSettings } from "./format"

export type OnStageSlide = { lines: string[] }
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
const itemStyle = "left:50px;top:120px;width:1820px;height:840px;"
// Repeated sections are expressed as repeated layout references to one slide. Legacy imports have
// carried absurd counts (a real song arrived with reps 104), so occurrences are capped.
const MAX_REPEAT_OCCURRENCES = 16

// One song under construction: its slides are shared by every arrangement, so two services
// playing the same section reference one slide instead of duplicating the lyrics.
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
    return {
        show: {
            name: song.title || "",
            category: "onstage",
            timestamps: { created: Date.now(), modified: null, used: null },
            meta: {
                title: song.title || "",
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
export function addSongArrangement(build: SongBuild, song: OnStageSong, format: OnStageFormatSettings, arrangementName: string): string {
    const { show, parentBySection, numbersByParent } = build
    const layoutSlides: SlideData[] = []
    // the section keys behind the layout, in presentation order — stable across syncs, unlike the
    // generated slide ids, so they can identify the arrangement itself
    const layoutKeys: string[] = []

    song.sections.forEach((section) => {
        const rawSlides: OnStageSlide[] = section.slides.length ? section.slides : [{ lines: [] }]
        const sectionSlides = formatSectionSlides(rawSlides, format)

        // Same label + identical lyrics is one group: OnStage numbers every occurrence, so a song
        // repeating its chorus verbatim would otherwise import as Chorus 1, Chorus 2, Chorus 3.
        // An empty (instrumental) section has no lyrics to compare, so it stays keyed by number.
        const signature = format.mergeIdenticalSections ? getLyricsSignature(sectionSlides) : ""
        const sectionKey = signature ? `${section.label}|${signature}` : `${section.label} ${section.number}`
        let parentId = parentBySection[sectionKey]

        if (!parentId) {
            const children: string[] = []

            sectionSlides.forEach((sectionSlide, i) => {
                const slideId = uid()
                show.slides[slideId] = {
                    // Only the parent carries the group — a labeled child would count as its own group.
                    group: i === 0 ? section.name : null,
                    ...(i === 0 ? { globalGroup: section.label.toLowerCase() } : {}),
                    color: null,
                    settings: {},
                    notes: section.notes || "",
                    items: sectionSlide.lines.length
                        ? [
                              {
                                  style: itemStyle,
                                  lines: sectionSlide.lines.map((line) => ({ align: "", text: [{ style: "", value: line }] }))
                              }
                          ]
                        : []
                }

                if (i === 0) parentId = slideId
                else children.push(slideId)
            })

            if (children.length && parentId) show.slides[parentId].children = children
            parentBySection[sectionKey] = parentId!
        }

        const numbers = numbersByParent[parentId] || (numbersByParent[parentId] = [])
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
    })

    const arrangementSignature = layoutKeys.join(",")
    const knownLayoutId = build.layoutBySignature[arrangementSignature]
    if (knownLayoutId) return knownLayoutId

    // the first arrangement is the song's own; later ones are named after the service that plays them
    const isFirst = !Object.keys(show.layouts).length
    // the song id is part of the hash: two different songs sharing a structure (common without
    // merged sections, when keys are just "Verse 1,Chorus 1") must not share a layout id, since
    // the frontend maps the ids of a whole sync in one pool
    const layoutId = getStableLayoutId(`${song.id}|${arrangementSignature}`)
    show.layouts[layoutId] = { name: isFirst ? "Default" : getUniqueLayoutName(show, arrangementName), notes: "", slides: layoutSlides }
    build.layoutBySignature[arrangementSignature] = layoutId
    if (isFirst) show.settings.activeLayout = layoutId

    return layoutId
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
    const takenNames = Object.keys(show.layouts).map((layoutId) => show.layouts[layoutId].name)
    if (!takenNames.includes(name)) return name

    let counter = 2
    while (takenNames.includes(`${name} ${counter}`)) counter++
    return `${name} ${counter}`
}

export function finalizeSongBuild(build: SongBuild): Show {
    // a group that absorbed more than one numbered section is no longer "the second chorus"
    Object.keys(build.numbersByParent).forEach((parentId) => {
        if (build.numbersByParent[parentId].length < 2) return

        const group = build.show.slides[parentId]?.group
        if (group) build.show.slides[parentId].group = stripSectionNumber(group)
    })

    return build.show
}
