import { get } from "svelte/store"
import { activeProfile, profiles } from "../stores"

export function getAccess(id: string) {
    return get(activeProfile) ? get(profiles)[get(activeProfile)!]?.access[id] || {} : {}
}

export function openProfileByName(profileName: string) {
    if (!profileName) return
    if (profileName.toLowerCase() === 'admin') {
        activeProfile.set("")
        return
    }

    // find profile by name (case-insensitive)
    const profileId = Object.keys(get(profiles)).find(id => (get(profiles)[id].name || "").toLowerCase() === profileName.toLowerCase())

    if (!profileId) return
    activeProfile.set(profileId)
}