// ----- FreeShow -----
// Non-reactive capability checks for use in plain .ts action code.
// In Svelte markup prefer `{#if $capabilities.<key>}` directly.

import { get } from "svelte/store"
import type { CapabilitySet } from "../../shared/platform/capabilities"
import { capabilities } from "../stores"

export function can(key: keyof CapabilitySet): boolean {
    return get(capabilities)[key]
}
