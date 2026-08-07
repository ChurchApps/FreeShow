// Shared store helpers for audio effect integration layers.
// Eliminates the repeated read/write boilerplate across effect modules.

import { get } from "svelte/store"
import { activeAudioEffects, audioEffects, type AudioEffectsConfig } from "../../stores"

type EffectKey = keyof AudioEffectsConfig

function getActiveChannelId(): string {
    return get(activeAudioEffects) || "main"
}

/** Read the stored config for an effect, merged with its compile-time defaults. */
export function getEffectConfig<T>(key: EffectKey, defaults: T, channelId?: string): T {
    const target = channelId || getActiveChannelId()
    return { ...defaults, ...(get(audioEffects)[target]?.[key] as unknown as Partial<T> | undefined) }
}
/** Merge a partial update into the store. */
export function updateEffectInStore<T>(key: EffectKey, defaults: T, partial: Partial<T>, channelId?: string): void {
    const target = channelId || getActiveChannelId()
    audioEffects.update((all) => {
        const channelConfig = all[target] || ({} as AudioEffectsConfig)
        const next = { ...defaults, ...(channelConfig[key] as unknown as Partial<T> | undefined), ...partial }
        return {
            ...all,
            [target]: { ...channelConfig, [key]: next } as any
        }
    })
}

/** Toggle an effect's enabled flag in the store. */
export function setEffectEnabledInStore<T extends { enabled: boolean }>(key: EffectKey, defaults: T, enabled: boolean, channelId?: string): void {
    const target = channelId || getActiveChannelId()
    audioEffects.update((all) => {
        const channelConfig = all[target] || ({} as AudioEffectsConfig)
        const next = { ...defaults, ...(channelConfig[key] as unknown as Partial<T> | undefined), enabled }
        return {
            ...all,
            [target]: { ...channelConfig, [key]: next } as any
        }
    })
}

/** Subscribe to a specific effect's config. Returns the unsubscribe function. */
export function subscribeEffect<T>(key: EffectKey, callback: (config: T) => void, channelId?: string): () => void {
    let prevCfgString = ""
    return audioEffects.subscribe((all) => {
        const target = channelId || getActiveChannelId()
        const cfg = all[target]?.[key] as unknown as T | undefined
        if (cfg) {
            const str = JSON.stringify(cfg)
            if (str !== prevCfgString) {
                prevCfgString = str
                callback(cfg)
            }
        }
    })
}
