// Shared store helpers for audio effect integration layers.
// Eliminates the repeated read/write boilerplate across effect modules.

import { get } from "svelte/store"
import { audioEffects, type AudioEffectsConfig } from "../../stores"

type EffectKey = keyof AudioEffectsConfig

/** Read the stored config for an effect, merged with its compile-time defaults. */
export function getEffectConfig<T>(key: EffectKey, defaults: T): T {
    return { ...defaults, ...(get(audioEffects).main?.[key] as unknown as Partial<T> | undefined) }
}

/** Merge a partial update into the store and apply it to the live effect instance. */
export function updateEffectInStore<T>(key: EffectKey, defaults: T, partial: Partial<T>, instance: { updateConfig(c: Partial<T>): void } | null): void {
    audioEffects.update((all) => {
        const next = { ...defaults, ...(all.main?.[key] as unknown as Partial<T> | undefined), ...partial }
        instance?.updateConfig(next)
        return { ...all, main: { ...all.main, [key]: next } as any }
    })
}

/** Toggle an effect's enabled flag in the store and on the live instance. */
export function setEffectEnabledInStore<T extends { enabled: boolean }>(key: EffectKey, defaults: T, enabled: boolean, instance: { setEnabled(e: boolean): void } | null): void {
    audioEffects.update((all) => {
        const next = { ...defaults, ...(all.main?.[key] as unknown as Partial<T> | undefined), enabled }
        instance?.setEnabled(enabled)
        return { ...all, main: { ...all.main, [key]: next } as any }
    })
}

/** Subscribe to a specific effect's config. Returns the unsubscribe function. */
export function subscribeEffect<T>(key: EffectKey, callback: (config: T) => void): () => void {
    return audioEffects.subscribe((all) => {
        const cfg = all.main?.[key] as unknown as T | undefined
        if (cfg) callback(cfg)
    })
}
