// ----- FreeShow -----
// The interface style is a local (non-synced) setting, so every device can pick
// between the classic layout and the modern one.

import { get } from "svelte/store"
import { uiStyle } from "../stores"

export type UIStyle = "classic" | "modern"

const ATTRIBUTE = "data-ui"

export function applyUIStyle(style: UIStyle | string | null | undefined = "classic") {
    const value: UIStyle = style === "modern" ? "modern" : "classic"
    uiStyle.set(value)
    document.documentElement.setAttribute(ATTRIBUTE, value)
}

export function setUIStyle(style: UIStyle) {
    applyUIStyle(style)
}

export function toggleUIStyle() {
    applyUIStyle(get(uiStyle) === "modern" ? "classic" : "modern")
}
