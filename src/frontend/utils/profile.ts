import { get } from "svelte/store"
import { activeProfile, profiles } from "../stores"

export function getAccess(id: string) {
    return get(activeProfile) ? get(profiles)[get(activeProfile)!]?.access[id] || {} : {}
}

export function openProfileByName(profileName: string) {
    if (!profileName) return
    if (profileName.toLowerCase() === "admin") {
        activeProfile.set("")
        return
    }

    // find profile by name (case-insensitive)
    const profileId = Object.keys(get(profiles)).find((id) => (get(profiles)[id].name || "").toLowerCase() === profileName.toLowerCase())

    if (!profileId) return
    activeProfile.set(profileId)
}

// doesn't need to be secure
export function encodePassword(password: string) {
    return encrypt(password)
}
export function checkPassword(password: string, encoded: string) {
    if (!password || !encoded) return false
    return encoded === encrypt(password)
}
const k = "bw46feskw4"
const encrypt = (text) => Array.from(text, (char: string, i) => ("0" + (char.charCodeAt(0) ^ k.charCodeAt(i % k.length)).toString(16)).slice(-2)).join("")
