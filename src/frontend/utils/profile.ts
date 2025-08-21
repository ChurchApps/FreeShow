import { get } from "svelte/store"
import { activeProfile, profiles } from "../stores"

export function getAccess(id: string) {
    return get(profiles)[get(activeProfile) || ""]?.access[id] || {}
}
