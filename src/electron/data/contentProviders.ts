// ----- FreeShow -----
// Content Provider Helper Functions
// Handles access and settings for external content providers like Planning Center, Chums, etc.

import { stores } from "./store"

// ----- CONTENT PROVIDER HELPERS -----

export function getContentProviderAccess(provider: string, scope: string): any {
    const contentProviders = stores.ACCESS.get("contentProviders") || {}
    const providerData = (contentProviders as any)[provider]
    return providerData?.[scope] || null
}

export function setContentProviderAccess(provider: string, scope: string, data: any): void {
    const contentProviders = stores.ACCESS.get("contentProviders") || {}
    if (!(contentProviders as any)[provider]) (contentProviders as any)[provider] = {};
    (contentProviders as any)[provider][scope] = data
    stores.ACCESS.set("contentProviders", contentProviders)
}

export function getContentProviderSettings(provider: string, key?: string): any {
    const contentProviders = stores.SETTINGS.get("contentProviders") || {}
    const providerSettings = (contentProviders as any)[provider] || {}
    return key ? providerSettings[key] : providerSettings
}

export function setContentProviderSettings(provider: string, key: string, value: any): void {
    const contentProviders = stores.SETTINGS.get("contentProviders") || {}
    if (!(contentProviders as any)[provider]) (contentProviders as any)[provider] = {}
        ; (contentProviders as any)[provider][key] = value
    stores.SETTINGS.set("contentProviders", contentProviders)
}

// ----- CONTENT PROVIDER MIGRATION -----
// TODO: This is temporary and can be removed after 1.6.0
export function migrateContentProviderSettings(): void {
    let migrationNeeded = false
    const keysToDelete: string[] = []

    // Migrate ACCESS store
    const accessKeys = [
        { old: "pco_services", newProvider: "planningcenter", newScope: "services" },
        { old: "pco_calendar", newProvider: "planningcenter", newScope: "calendar" },
        { old: "chums_plans", newProvider: "chums", newScope: "plans" }
    ]

    for (const { old, newProvider, newScope } of accessKeys) {
        const oldData = stores.ACCESS.get(old as any)
        if (oldData && !getContentProviderAccess(newProvider, newScope)) {
            setContentProviderAccess(newProvider, newScope, oldData)
            keysToDelete.push(old)
            migrationNeeded = true
            console.info(`Migrated ${old} -> contentProviders.${newProvider}.${newScope}`)
        }
    }

    // Migrate SETTINGS store
    const contentProviders = stores.SETTINGS.get("contentProviders") || {}

    // Migrate Chums sync categories
    const chumsSyncCategories = stores.SETTINGS.get("chumsSyncCategories")
    if (chumsSyncCategories && (!(contentProviders as any).chums || !(contentProviders as any).chums.syncCategories)) {
        if (!(contentProviders as any).chums) (contentProviders as any).chums = {}
            ; (contentProviders as any).chums.syncCategories = chumsSyncCategories
        migrationNeeded = true
        console.info("Migrated chumsSyncCategories -> contentProviders.chums.syncCategories")
        // Note: We keep chumsSyncCategories for now as it's still in the SaveListSettings type
    }

    // Migrate Planning Center local always setting
    const special = stores.SETTINGS.get("special") || {}
    if (special.pcoLocalAlways !== undefined && (!(contentProviders as any).planningcenter || (contentProviders as any).planningcenter.localAlways === undefined)) {
        if (!(contentProviders as any).planningcenter) (contentProviders as any).planningcenter = {}
            ; (contentProviders as any).planningcenter.localAlways = special.pcoLocalAlways
        // Remove from special object and update
        delete special.pcoLocalAlways
        stores.SETTINGS.set("special", special)
        migrationNeeded = true
        console.info("Migrated special.pcoLocalAlways -> contentProviders.planningcenter.localAlways")
    }

    if (migrationNeeded) {
        stores.SETTINGS.set("contentProviders", contentProviders)

        // Delete old ACCESS keys
        for (const key of keysToDelete) {
            stores.ACCESS.set(key as any, undefined)
            console.info(`Deleted legacy key: ${key}`)
        }

        console.info("Content Provider migration completed")
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