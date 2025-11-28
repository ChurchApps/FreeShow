import type { Dictionary } from "../../../types/Settings"
import { clone } from "../../common/util/helpers"
import { _get, _set } from "./stores"

export function translate(key: string, d: Dictionary = _get("dictionary")) {
    let keys = key.split(".")
    return d[keys[0]]?.[keys[1]] || ""
}

export function setError(err: string) {
    let errors = _get("errors")
    if (errors.includes(err)) return

    _set("errors", [...errors, err])

    setTimeout(() => {
        errors = clone(_get("errors"))
        errors.shift()
        _set("errors", errors)
    }, 2000)
}

// Common utility functions used across components

/** Convert object with IDs as keys to array with id property */
export function keysToID<T>(obj: Record<string, T>): (T & { id: string })[] {
    return Object.keys(obj || {}).map(key => ({ id: key, ...obj[key] }))
}

/** Sort array by a string property (case-insensitive) */
export function sortByName<T>(list: T[], key: keyof T = "name" as keyof T, lowercase = true): T[] {
    return [...list].sort((a, b) => {
        const aVal = lowercase ? String(a[key] || "").toLowerCase() : String(a[key] || "")
        const bVal = lowercase ? String(b[key] || "").toLowerCase() : String(b[key] || "")
        return aVal.localeCompare(bVal)
    })
}

/** Sort by multiple criteria */
export function sortByProperty<T>(list: T[], key: keyof T, colorKey?: keyof T): T[] {
    return [...list].sort((a, b) => {
        if (colorKey) {
            const colorCompare = String(a[colorKey] || "").localeCompare(String(b[colorKey] || ""))
            if (colorCompare !== 0) return colorCompare
        }
        return String(a[key] || "").localeCompare(String(b[key] || ""))
    })
}

/** Format timestamp to relative date string */
export function formatRelativeDate(timestamp: number): string {
    if (!timestamp) return ""
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return "Today"
    if (days === 1) return "Yesterday"
    if (days < 7) return `${days} days ago`

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined
    })
}

/** Format seconds to time string (H:MM:SS or M:SS) */
export function formatTime(seconds: number): string {
    seconds = Math.abs(Math.floor(seconds))
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    return `${m}:${s.toString().padStart(2, "0")}`
}
