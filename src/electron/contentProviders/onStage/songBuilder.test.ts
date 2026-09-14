import { describe, expect, it } from "vitest"
import { defaultOnStageFormat, type OnStageFormatSettings } from "./format"
import { addSongArrangement, createSongBuild, finalizeSongBuild, type OnStageSection, type OnStageSong } from "./songBuilder"

const format = (overrides: Partial<OnStageFormatSettings> = {}): OnStageFormatSettings => ({ ...defaultOnStageFormat, ...overrides })

function section(label: string, number: number, lines: string[], overrides: Partial<OnStageSection> = {}): OnStageSection {
    return {
        label,
        number,
        name: `${label} ${number}`,
        repeats: 1,
        notes: null,
        instrumental: false,
        unscheduled: false,
        slides: [{ lines }],
        ...overrides
    }
}

const VERSE = () => section("Verse", 1, ["mare este Domnul", "vrednic de laudă"])
const CHORUS = () => section("Chorus", 1, ["cânt spre Tine"])
const BRIDGE = () => section("Bridge", 1, ["punte nouă"])

function song(sections: OnStageSection[]): OnStageSong {
    return {
        id: "song-1",
        title: "Mare este Domnul",
        artist: "Artist",
        key: "G",
        originalKey: "G",
        tempo: null,
        meter: null,
        ccli: "12345",
        copyright: null,
        sections
    }
}

/** the slide ids an arrangement presents, in order */
function arrangementSlideIds(show: ReturnType<typeof finalizeSongBuild>, layoutId: string) {
    return show.layouts[layoutId].slides.map((slide) => slide.id)
}

describe("song shared by several services", () => {
    it("keeps one arrangement per structure", () => {
        const build = createSongBuild(song([]))

        const first = addSongArrangement(build, song([VERSE(), CHORUS(), BRIDGE()]), format(), "Sunday")
        const second = addSongArrangement(build, song([VERSE(), CHORUS()]), format(), "Wednesday")
        const show = finalizeSongBuild(build)

        expect(first).not.toBe(second)
        expect(Object.keys(show.layouts)).toHaveLength(2)
        expect(arrangementSlideIds(show, first)).toHaveLength(3)
        expect(arrangementSlideIds(show, second)).toHaveLength(2)
    })

    it("shares one arrangement between services that play it the same way", () => {
        const build = createSongBuild(song([]))

        const first = addSongArrangement(build, song([VERSE(), CHORUS()]), format(), "Sunday")
        const second = addSongArrangement(build, song([VERSE(), CHORUS()]), format(), "Wednesday")
        const show = finalizeSongBuild(build)

        expect(second).toBe(first)
        expect(Object.keys(show.layouts)).toHaveLength(1)
    })

    it("reuses the slides instead of duplicating the lyrics", () => {
        const build = createSongBuild(song([]))

        const first = addSongArrangement(build, song([VERSE(), CHORUS(), BRIDGE()]), format(), "Sunday")
        const second = addSongArrangement(build, song([CHORUS(), VERSE()]), format(), "Wednesday")
        const show = finalizeSongBuild(build)

        // verse + chorus + bridge, each stored once
        expect(Object.keys(show.slides)).toHaveLength(3)

        const [verseId, chorusId] = arrangementSlideIds(show, first)
        expect(arrangementSlideIds(show, second)).toEqual([chorusId, verseId])
    })

    it("names the first arrangement Default and the later ones after their service", () => {
        const build = createSongBuild(song([]))

        const first = addSongArrangement(build, song([VERSE(), CHORUS()]), format(), "Sunday")
        const second = addSongArrangement(build, song([VERSE()]), format(), "Wednesday")
        const show = finalizeSongBuild(build)

        expect(show.layouts[first].name).toBe("Default")
        expect(show.layouts[second].name).toBe("Wednesday")
    })

    it("does not reuse an arrangement name", () => {
        const build = createSongBuild(song([]))

        addSongArrangement(build, song([VERSE(), CHORUS()]), format(), "Sunday")
        const second = addSongArrangement(build, song([VERSE()]), format(), "Sunday")
        const third = addSongArrangement(build, song([CHORUS()]), format(), "Sunday")
        const show = finalizeSongBuild(build)

        expect(show.layouts[second].name).toBe("Sunday")
        expect(show.layouts[third].name).toBe("Sunday 2")
    })

    it("makes the first service's arrangement the active one", () => {
        const build = createSongBuild(song([]))

        const first = addSongArrangement(build, song([VERSE(), CHORUS()]), format(), "Sunday")
        addSongArrangement(build, song([VERSE()]), format(), "Wednesday")

        expect(finalizeSongBuild(build).settings.activeLayout).toBe(first)
    })
})

describe("arrangement ids", () => {
    it("stay the same when the song is built again", () => {
        const sections = [VERSE(), CHORUS(), BRIDGE()]

        const first = createSongBuild(song([]))
        const firstId = addSongArrangement(first, song(sections), format(), "Sunday")

        // a later sync (or a single song reload) rebuilds the show from scratch
        const second = createSongBuild(song([]))
        const secondId = addSongArrangement(second, song(sections), format(), "Sunday")

        expect(secondId).toBe(firstId)
    })

    it("differ between two structures of the same song", () => {
        const build = createSongBuild(song([]))

        const full = addSongArrangement(build, song([VERSE(), CHORUS(), BRIDGE()]), format(), "Sunday")
        const short = addSongArrangement(build, song([VERSE(), CHORUS()]), format(), "Wednesday")

        expect(short).not.toBe(full)
    })

    it("differ when only the repeat count changes", () => {
        const build = createSongBuild(song([]))

        const once = addSongArrangement(build, song([section("Chorus", 1, ["cânt spre Tine"], { repeats: 1 })]), format(), "Sunday")
        const twice = addSongArrangement(build, song([section("Chorus", 1, ["cânt spre Tine"], { repeats: 2 })]), format(), "Wednesday")

        expect(twice).not.toBe(once)
    })

    it("differ between two songs sharing the same structure", () => {
        // without merged sections the keys carry no lyrics, so the structure alone would collide
        const noMerge = format({ mergeIdenticalSections: false })

        const firstSong = song([VERSE(), CHORUS()])
        const firstId = addSongArrangement(createSongBuild(firstSong), firstSong, noMerge, "Sunday")

        const secondSong = { ...song([VERSE(), CHORUS()]), id: "song-2" }
        const secondId = addSongArrangement(createSongBuild(secondSong), secondSong, noMerge, "Sunday")

        expect(secondId).not.toBe(firstId)
    })

    it("survive a change to the lines per slide setting", () => {
        const verse = () => section("Verse", 1, ["linia unu", "linia doi", "linia trei"])

        const first = createSongBuild(song([]))
        const firstId = addSongArrangement(first, song([verse()]), format(), "Sunday")

        const second = createSongBuild(song([]))
        const secondId = addSongArrangement(second, song([verse()]), format({ linesPerSlide: 2 }), "Sunday")

        // the slides are rebuilt, but the project items still point at a valid arrangement
        expect(secondId).toBe(firstId)
    })
})

describe("section structure", () => {
    it("merges same-label sections with identical lyrics and drops the number", () => {
        const build = createSongBuild(song([]))
        const chorus2 = section("Chorus", 2, ["cânt spre Tine"])

        const layoutId = addSongArrangement(build, song([CHORUS(), VERSE(), chorus2]), format(), "Sunday")
        const show = finalizeSongBuild(build)

        const [firstChorus, , secondChorus] = arrangementSlideIds(show, layoutId)
        expect(secondChorus).toBe(firstChorus)
        expect(show.slides[firstChorus].group).toBe("Chorus")
    })

    it("keeps same-label sections apart when the lyrics differ", () => {
        const build = createSongBuild(song([]))
        const verse2 = section("Verse", 2, ["altă strofă"])

        const layoutId = addSongArrangement(build, song([VERSE(), verse2]), format(), "Sunday")
        const show = finalizeSongBuild(build)

        const [firstVerse, secondVerse] = arrangementSlideIds(show, layoutId)
        expect(secondVerse).not.toBe(firstVerse)
        expect(show.slides[firstVerse].group).toBe("Verse 1")
        expect(show.slides[secondVerse].group).toBe("Verse 2")
    })

    it("merges identical sections across services too", () => {
        const build = createSongBuild(song([]))

        addSongArrangement(build, song([CHORUS()]), format(), "Sunday")
        addSongArrangement(build, song([section("Chorus", 2, ["cânt spre Tine"])]), format(), "Wednesday")
        const show = finalizeSongBuild(build)

        expect(Object.keys(show.slides)).toHaveLength(1)
        expect(Object.values(show.slides)[0].group).toBe("Chorus")
    })

    it("does not merge when the setting is off", () => {
        const build = createSongBuild(song([]))
        const chorus2 = section("Chorus", 2, ["cânt spre Tine"])

        addSongArrangement(build, song([CHORUS(), chorus2]), format({ mergeIdenticalSections: false }), "Sunday")

        expect(Object.keys(finalizeSongBuild(build).slides)).toHaveLength(2)
    })

    it("splits a section into slides of the configured size", () => {
        const build = createSongBuild(song([]))
        const verse = section("Verse", 1, ["linia unu", "linia doi", "linia trei", "linia patru"])

        const layoutId = addSongArrangement(build, song([verse]), format({ linesPerSlide: 2 }), "Sunday")
        const show = finalizeSongBuild(build)

        const parentId = arrangementSlideIds(show, layoutId)[0]
        expect(show.slides[parentId].children).toHaveLength(1)
        expect(show.slides[parentId].items[0].lines).toHaveLength(2)
    })

    it("keeps a repeated section out of the layout when it is unscheduled", () => {
        const build = createSongBuild(song([]))
        const muted = section("Bridge", 1, ["punte"], { unscheduled: true })

        const layoutId = addSongArrangement(build, song([VERSE(), muted]), format(), "Sunday")
        const show = finalizeSongBuild(build)

        expect(arrangementSlideIds(show, layoutId)).toHaveLength(1)
        // the lyrics are still part of the song
        expect(Object.keys(show.slides)).toHaveLength(2)
    })

    it("references a repeated section once per play-through", () => {
        const build = createSongBuild(song([]))
        const repeated = section("Chorus", 1, ["cânt spre Tine"], { repeats: 3 })

        const layoutId = addSongArrangement(build, song([repeated]), format(), "Sunday")
        const show = finalizeSongBuild(build)

        const ids = arrangementSlideIds(show, layoutId)
        expect(ids).toHaveLength(3)
        expect(new Set(ids).size).toBe(1)
    })
})
