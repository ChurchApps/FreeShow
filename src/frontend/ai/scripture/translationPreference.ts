// AI AUTO SCRIPTURE - TRANSLATION PREFERENCE
// which translation leads: the favourites are the priority pool, the main translation (or the
// first favourite) is the projection/grounding target, and the spoken cycle ranking orders both

import { get } from "svelte/store"
import { getShortBibleName } from "../../components/drawer/bible/scripture"
import { drawerTabsData, scriptures } from "../../stores"

// "another translation" visits the familiar ones first - however the search selection is ordered.
// Each entry lists the abbreviation AND full-name phrasings, since libraries store either
// ("NASB" / "New American Standard Bible"). NKJV ranks before KJV so its full name is not
// swallowed by the "KING JAMES" alias
const CYCLE_PREFERENCE: string[][] = [
    ["NASB", "NEW AMERICAN STANDARD BIBLE"],
    ["NLT", "NEW LIVING TRANSLATION"],
    ["AMP", "AMPLIFIED BIBLE"],
    ["AMPC", "AMPLIFIED BIBLE CLASSIC"],
    ["MSG", "THE MESSAGE BIBLE"],
    ["CEV", "CONTEMPORARY ENGLISH VERSION"],
    ["CEB", "COMMON ENGLISH BIBLE"],
    ["NIV", "NEW INTERNATIONAL VERSION"],
    ["NIRV", "NEW INTERNATIONAL READERS' VERSION"],
    ["ERV", "EASY-TO-READ VERSION", "EASY TO READ VERSION"],
    ["ESV", "ENGLISH STANDARD VERSION"],
    ["GNT", "GOOD NEWS TRANSLATION"],
    ["NKJV", "NEW KING JAMES VERSION"],
    ["KJV", "KING JAMES VERSION"]
]

function toUpperTrimmed(value: string | undefined): string {
    return (value || "").toUpperCase().trim()
}

function matchesAlias(names: string[], alias: string): boolean {
    return names.some((name) => name === alias || name.includes(alias))
}

export function cycleRank(id: string): number {
    const bible = get(scriptures)[id]
    const names = [bible?.customName, bible?.name, getShortBibleName(bible?.name || "")].map(toUpperTrimmed).filter(Boolean)
    const rank = CYCLE_PREFERENCE.findIndex((aliases) => aliases.some((alias) => matchesAlias(names, alias)))
    return rank < 0 ? CYCLE_PREFERENCE.length : rank
}

/** The translation detections project in (unless display is "matched") and matching grounds to. */
export function preferredTranslationId(): string {
    return get(drawerTabsData).scripture?.activeSubTab || ""
}
