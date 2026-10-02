// Websites are kept loaded in a pool per output view (WebsitePool.svelte) instead of inside the slide,
// so leaving a slide and coming back shows the same page, in the same state (e.g. the same Canva slide).
// A website item on the current slide "claims" its url with a placeholder element the pooled website is placed over.

import { writable, type Writable } from "svelte/store"

export const WEBSITE_POOL = "websitePool"

export type WebsiteSlot = {
    src: string
    element: HTMLElement | null // placeholder in the slide (null = hidden, kept loaded)
    zoom?: number
    navigation: boolean
    slideControls: boolean
    lastUsed: number
}
export type WebsiteSlots = { [src: string]: WebsiteSlot }
export type WebsitePool = {
    slots: Writable<WebsiteSlots>
    claim: (src: string, element: HTMLElement, options: { zoom?: number; navigation: boolean; slideControls: boolean }) => void
    release: (src: string, element: HTMLElement) => void
}

// hidden websites kept loaded (each can use a lot of memory)
export const MAX_HIDDEN_WEBSITES = 3

export function createWebsitePool(): WebsitePool {
    const slots = writable<WebsiteSlots>({})

    return {
        slots,
        claim: (src, element, options) => slots.update((a) => claimSlot(a, src, element, options)),
        release: (src, element) => slots.update((a) => releaseSlot(a, src, element))
    }
}

export function claimSlot(slots: WebsiteSlots, src: string, element: HTMLElement, options: { zoom?: number; navigation: boolean; slideControls: boolean }, now = Date.now()) {
    if (!src) return slots
    slots[src] = { src, element, ...options, lastUsed: now }
    return slots
}

export function releaseSlot(slots: WebsiteSlots, src: string, element: HTMLElement, now = Date.now()) {
    // another slide might have claimed it already (e.g. during a transition)
    if (!slots[src] || slots[src].element !== element) return slots

    slots[src] = { ...slots[src], element: null, lastUsed: now }

    // unload the least recently used hidden websites
    const hidden = Object.values(slots)
        .filter((slot) => !slot.element)
        .sort((x, y) => y.lastUsed - x.lastUsed)
    hidden.slice(MAX_HIDDEN_WEBSITES).forEach((slot) => delete slots[slot.src])

    return slots
}
