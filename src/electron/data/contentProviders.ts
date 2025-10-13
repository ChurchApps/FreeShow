// ----- FreeShow -----
// Content Provider Helper Functions
// Handles access and settings for external content providers like Planning Center, Chums (B1), etc.

import type { ContentProviderId } from "../contentProviders/base/types"
import { stores } from "./store"

// ----- CONTENT PROVIDER HELPERS -----

export function getContentProviderAccess(providerId: ContentProviderId, scope: string): any {
    const contentProviders = stores.ACCESS.get("contentProviders") || {}
    const providerData = (contentProviders as any)[providerId]
    return providerData?.[scope] || null
}

export function setContentProviderAccess(providerId: ContentProviderId, scope: string, data: any): void {
    const contentProviders = stores.ACCESS.get("contentProviders") || {}
    if (!(contentProviders as any)[providerId]) (contentProviders as any)[providerId] = {};
    (contentProviders as any)[providerId][scope] = data
    stores.ACCESS.set("contentProviders", contentProviders)
}

// ----- CONTENT PROVIDER MIGRATION -----
// TODO: This entire migration section can be removed after version 1.6.0
// Migrates legacy content provider settings to the new unified structure
export function migrateContentProviderSettings(): void {
    const keysToDelete: string[] = []

    // Migrate ACCESS store
    const accessKeys: { old: string; newProvider: ContentProviderId; newScope: string }[] = [
        { old: "pco_services", newProvider: "planningcenter", newScope: "services" },
        { old: "chums_plans", newProvider: "chums", newScope: "plans" }
    ]

    for (const { old, newProvider, newScope } of accessKeys) {
        const oldData = stores.ACCESS.get(old as any)
        if (oldData && !getContentProviderAccess(newProvider, newScope)) {
            setContentProviderAccess(newProvider, newScope, oldData)
            keysToDelete.push(old)
            console.info(`Migrated ${old} -> contentProviders.${newProvider}.${newScope}`)
        }
    }
}

// Initialize migration on module load (after a brief delay to ensure stores are initialized)
// TODO: This migration initialization can be removed after version 1.6.0
setTimeout(() => {
    try {
        migrateContentProviderSettings()
    } catch (err) {
        console.error("Content Provider migration failed:", err)
    }
}, 100)