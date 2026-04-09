import { get } from "svelte/store"
import type { Show, Shows } from "../../../types/Show"
import { getLayoutRef as getRef } from "../../common/util/show"
import { awaitRequest } from "../util/socket"
import { showsCache } from "../util/stores"

export function getLayoutRef(showId: string, layoutId: string = "", _updater?: Shows | Show) {
    let currentShow = get(showsCache)[showId]
    return getRef(currentShow, layoutId)
}

const MAX_CACHE_SIZE = 100
let cached: { [key: string]: string } = {}
export function getDynamicValue(value: string) {
    return cached[value] ?? value
}
let isRequested = new Map<string, number>()

function pruneCache() {
    const keys = Object.keys(cached)
    if (keys.length > MAX_CACHE_SIZE) {
        keys.slice(0, keys.length - MAX_CACHE_SIZE).forEach((key) => delete cached[key])
    }

    const now = Date.now()
    for (const [key, timestamp] of isRequested) {
        if (now - timestamp > 60_000) isRequested.delete(key)
    }
}

export async function replaceDynamicValues(value: string, _updater: number = 0) {
    if (!value.includes("{")) return value

    const now = Date.now()
    if (isRequested.has(value) && now - (isRequested.get(value) || 0) < 1000) return getDynamicValue(value)
    isRequested.set(value, now)

    pruneCache()

    const newValue = await awaitRequest("API:get_dynamic_value", { value, ref: { type: "stage" } })
    if (newValue !== undefined) cached[value] = newValue
    return newValue ?? cached[value] ?? value
}
