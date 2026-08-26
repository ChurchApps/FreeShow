// Shared store helpers for audio effect integration layers.
// Eliminates the repeated read/write boilerplate across effect modules.

import { get } from "svelte/store"
import { uid } from "uid"
import { activeAudioEffects, audioEffects, type AudioEffectsConfig, type AudioEffectInstance } from "../../stores"
import { clone } from "../../components/helpers/array"

export const ALL_EFFECT_KEYS = ["equalizer", "filter", "noiseGate", "compressor", "limiter", "reverb", "delay", "stereoShaper"] as const
export type EffectType = (typeof ALL_EFFECT_KEYS)[number]
export type EffectKey = EffectType

export type { AudioEffectInstance }

export interface EffectMetaItem {
    id: EffectType
    label: string
    description: string
    color: string
}

export const EFFECTS_LIST: EffectMetaItem[] = [
    { id: "equalizer", label: "audio.equalizer", description: "6-Band Parametric EQ", color: "#5295ad" },
    { id: "filter", label: "audio.filter", description: "Lowpass, Highpass & Notch filters", color: "#52ad7a" },
    { id: "noiseGate", label: "audio.gate", description: "Mute noise below threshold", color: "#ad9a52" },
    { id: "compressor", label: "audio.compressor", description: "Dynamic range compression", color: "#ad6852" },
    { id: "reverb", label: "audio.reverb", description: "Room & hall reverberation", color: "#9152ad" },
    { id: "delay", label: "audio.delay", description: "Echo & time delay", color: "#5273ad" },
    { id: "limiter", label: "audio.limiter", description: "Peak & clipping limiter", color: "#ad5252" },
    { id: "stereoShaper", label: "audio.stereo_shaper", description: "Stereo width & pan shaper", color: "#52adad" }
]

export const DEFAULT_EFFECT_CONFIGS: Record<EffectType, any> = {
    equalizer: {
        enabled: true,
        bands: [
            { id: "band_1", frequency: 60, gain: 0, q: 1.0, type: "lowshelf" },
            { id: "band_2", frequency: 170, gain: 0, q: 1.0, type: "peaking" },
            { id: "band_3", frequency: 500, gain: 0, q: 1.0, type: "peaking" },
            { id: "band_4", frequency: 1500, gain: 0, q: 1.0, type: "peaking" },
            { id: "band_5", frequency: 4500, gain: 0, q: 1.0, type: "peaking" },
            { id: "band_6", frequency: 12000, gain: 0, q: 1.0, type: "highshelf" }
        ]
    },
    filter: { enabled: true, type: "lowpass", frequency: 1000, q: 1.0, gain: 0 },
    noiseGate: { enabled: true, threshold: -40, hysteresis: -6, attack: 0.005, hold: 0.05, release: 0.1 },
    compressor: { enabled: true, threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 },
    reverb: { enabled: true, roomSize: 0.7, dampening: 0.3, wet: 0.3, width: 1.0 },
    delay: { enabled: true, delayTime: 0.35, feedback: 0.35, wet: 0.4 },
    limiter: { enabled: true, ceiling: -3, release: 0.05 },
    stereoShaper: { enabled: true, width: 100, pan: 0 }
}

// Private helper utilities
function getActiveChannelId(): string {
    return get(activeAudioEffects) || "main"
}

function findStackIndex(stack: AudioEffectInstance[], keyOrId: string, isEffectId = false): number {
    return isEffectId ? stack.findIndex((s) => s.id === keyOrId) : stack.findIndex((s) => s.type === keyOrId)
}

function updateStack(channelId: string | undefined, mutator: (stack: AudioEffectInstance[]) => void): void {
    const target = channelId || getActiveChannelId()
    audioEffects.update((all) => {
        const stack = [...(all[target]?.stack || [])]
        mutator(stack)
        return { ...all, [target]: { stack } }
    })
}

/** Migrates legacy configurations into the standard stack structure. */
export function migrateAudioEffects(raw: any): Record<string, AudioEffectsConfig> {
    if (!raw || typeof raw !== "object") return {}
    const result: Record<string, AudioEffectsConfig> = {}

    for (const [channelId, cfg] of Object.entries(raw)) {
        if (!cfg || typeof cfg !== "object") continue
        const stack: AudioEffectInstance[] = []

        if (Array.isArray((cfg as any).stack)) {
            for (const item of (cfg as any).stack) {
                const type = typeof item === "string" ? (item as EffectType) : item?.type
                if (ALL_EFFECT_KEYS.includes(type)) {
                    const savedConfig = typeof item === "string" ? (cfg as any)[type] : item.config
                    const defaultConfig = DEFAULT_EFFECT_CONFIGS[type] || { enabled: true }

                    stack.push({
                        id: (typeof item === "object" && item.id) || `${type}_${uid(6)}`,
                        type,
                        enabled: typeof item === "object" ? item.enabled !== false : savedConfig?.enabled !== false,
                        config: clone(savedConfig || defaultConfig)
                    })
                }
            }
        } else {
            // Legacy individual keys fallback
            ALL_EFFECT_KEYS.forEach((key) => {
                if ((cfg as any)[key]?.enabled) {
                    stack.push({
                        id: `${key}_${uid(6)}`,
                        type: key,
                        enabled: true,
                        config: clone((cfg as any)[key])
                    })
                }
            })
        }

        result[channelId] = { stack }
    }

    return result
}

/** Read effect config merged with runtime defaults. */
export function getEffectConfig<T>(key: EffectKey, defaults: T, channelId?: string, effectId?: string): T {
    const stack = getEffectStack(undefined, channelId)
    const item = effectId ? stack.find((s) => s.id === effectId) : stack.find((s) => s.type === key)
    return item?.config ? { ...defaults, ...item.config } : { ...defaults }
}

/** Merge partial update into store. */
export function updateEffectInStore<T>(key: EffectKey, defaults: T, partial: Partial<T>, channelId?: string, effectId?: string): void {
    updateStack(channelId, (stack) => {
        const idx = findStackIndex(stack, effectId || key, !!effectId)
        if (idx >= 0) {
            stack[idx] = {
                ...stack[idx],
                config: { ...defaults, ...stack[idx].config, ...partial }
            }
        }
    })
}

/** Toggle an effect's enabled state in store. */
export function setEffectEnabledInStore<T extends { enabled: boolean }>(key: EffectKey, defaults: T, enabled: boolean, channelId?: string, effectId?: string): void {
    updateStack(channelId, (stack) => {
        const idx = findStackIndex(stack, effectId || key, !!effectId)
        if (idx >= 0) {
            stack[idx] = {
                ...stack[idx],
                enabled,
                config: { ...defaults, ...stack[idx].config, enabled }
            }
        }
    })
}

/** Subscribe to an effect's config state. */
export function subscribeEffect<T>(key: EffectKey, callback: (config: T) => void, channelId?: string, effectId?: string): () => void {
    let prevCfgString = ""
    return audioEffects.subscribe((all) => {
        const stack = getEffectStack(all, channelId)
        const item = effectId ? stack.find((s) => s.id === effectId) : stack.find((s) => s.type === key)
        if (item?.config) {
            const str = JSON.stringify(item.config)
            if (str !== prevCfgString) {
                prevCfgString = str
                callback(item.config as T)
            }
        }
    })
}

export function createEffectIntegration<T>(effectKey: EffectKey, defaultConfig: T, EffectClass: new (ac: AudioContext, config: T) => any) {
    let globalInstance: any = null

    return {
        initialize: (ac: AudioContext) => {
            if (globalInstance) return globalInstance
            globalInstance = new EffectClass(ac, getEffectConfig(effectKey, defaultConfig, "main"))
            subscribeEffect(effectKey, (cfg: T) => globalInstance?.updateConfig(cfg), "main")
            return globalInstance
        },
        updateConfig: (partial: Partial<T>, channelId?: string, effectId?: string) => updateEffectInStore(effectKey, defaultConfig, partial, channelId, effectId),
        setEnabled: (enabled: boolean, channelId?: string, effectId?: string) => setEffectEnabledInStore(effectKey, defaultConfig as { enabled: boolean }, enabled, channelId, effectId),
        getInstance: () => globalInstance
    }
}

export function safelyDisconnect(...nodes: (AudioNode | null | undefined)[]) {
    for (const node of nodes) {
        if (!node) continue
        try {
            node.disconnect()
        } catch {}
    }
}

export function getEffectStack(allEffects?: Record<string, AudioEffectsConfig>, channelId?: string): AudioEffectInstance[] {
    const target = channelId || getActiveChannelId()
    const all = allEffects || get(audioEffects)
    return all?.[target]?.stack || []
}

export function addEffectToStack(effectType: EffectType, channelId?: string): AudioEffectInstance {
    const newInstance: AudioEffectInstance = {
        id: `${effectType}_${uid(6)}`,
        type: effectType,
        enabled: true,
        config: clone(DEFAULT_EFFECT_CONFIGS[effectType] || { enabled: true })
    }
    updateStack(channelId, (stack) => stack.push(newInstance))
    return newInstance
}

export function removeEffectFromStack(indexOrId: number | string, channelId?: string): void {
    updateStack(channelId, (stack) => {
        const idx = typeof indexOrId === "number" ? indexOrId : stack.findIndex((s) => s.id === indexOrId)
        if (idx >= 0 && idx < stack.length) stack.splice(idx, 1)
    })
}

export function duplicateEffectInStack(indexOrId: number | string, channelId?: string): AudioEffectInstance | null {
    let duplicated: AudioEffectInstance | null = null

    updateStack(channelId, (stack) => {
        const idx = typeof indexOrId === "number" ? indexOrId : stack.findIndex((s) => s.id === indexOrId)
        if (idx >= 0 && idx < stack.length) {
            const original = stack[idx]
            duplicated = {
                id: `${original.type}_${uid(6)}`,
                type: original.type,
                enabled: original.enabled,
                config: clone(original.config || DEFAULT_EFFECT_CONFIGS[original.type] || {})
            }
            stack.splice(idx + 1, 0, duplicated)
        }
    })

    return duplicated
}

export function moveEffectInStack(fromIndex: number, toIndex: number, channelId?: string): void {
    updateStack(channelId, (stack) => {
        if (fromIndex >= 0 && fromIndex < stack.length && toIndex >= 0 && toIndex < stack.length) {
            const [moved] = stack.splice(fromIndex, 1)
            stack.splice(toIndex, 0, moved)
        }
    })
}

export function toggleEffectInStack(indexOrId: number | string, channelId?: string): void {
    updateStack(channelId, (stack) => {
        const idx = typeof indexOrId === "number" ? indexOrId : stack.findIndex((s) => s.id === indexOrId)
        const item = stack[idx]
        if (item) {
            item.enabled = !item.enabled
            if (item.config) item.config.enabled = item.enabled
        }
    })
}
