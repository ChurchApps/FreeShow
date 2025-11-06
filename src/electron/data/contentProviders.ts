// ----- FreeShow -----
// Content Provider Helper Functions
// Handles access and settings for external content providers like Planning Center, ChurchApps (B1), etc.

import type { ContentProviderId } from "../contentProviders/base/types"
import { stores } from "./store"

// ----- CONTENT PROVIDER HELPERS -----

export function getContentProviderAccess(providerId: ContentProviderId, scope: string) {
    const contentProviders = stores.ACCESS.get("contentProviders") || {}
    const providerData = contentProviders[providerId] || {}

    return providerData[scope] || null
}

export function setContentProviderAccess(providerId: ContentProviderId, scope: string, data: any) {
    const contentProviders = stores.ACCESS.get("contentProviders") || {}
    if (!contentProviders[providerId]) contentProviders[providerId] = {}
    contentProviders[providerId][scope] = data

    stores.ACCESS.set("contentProviders", contentProviders)
}

// ----- CONTENT PROVIDER MIGRATION -----
// TODO: This entire migration section can be removed after version 1.6.0
// Migrates legacy content provider settings to the new unified structure
export function migrateContentProviderSettings() {
    const keysToDelete: string[] = []

    // Migrate ACCESS store
    const accessKeys: { old: string; newProvider: ContentProviderId; newScope: string }[] = [
        { old: "pco_services", newProvider: "planningcenter", newScope: "services" },
        { old: "churchApps_plans", newProvider: "churchApps", newScope: "plans" }
    ]

    for (const { old, newProvider, newScope } of accessKeys) {
        const oldData = stores.ACCESS.get(old as any)
        if (oldData && !getContentProviderAccess(newProvider, newScope)) {
            setContentProviderAccess(newProvider, newScope, oldData)
            keysToDelete.push(old)
            console.info(`Migrated ${old} -> contentProviders.${newProvider}.${newScope}`)
        }
    }

    if (keysToDelete.length) {
        for (const key of keysToDelete) {
            stores.ACCESS.delete(key as any)
            console.info(`Deleted legacy key: ${key}`)
        }
    }
}
// Initialize migration on module load (after a brief delay to ensure stores are initialized)
setTimeout(() => {
    try {
        migrateContentProviderSettings()
    } catch (err) {
        console.error("Content Provider migration failed:", err)
    }
}, 100)