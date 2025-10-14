import { getContentProviderAccess } from "../data/contentProviders"
import { ContentProvider, ContentProviderFactory } from "./base/ContentProvider"
import type { ContentProviderId } from "./base/types"

// Import providers
import { AmazingLifeProvider } from "./amazingLife/AmazingLifeProvider"
import { ChumsProvider } from "./chums/ChumsProvider"
import { PlanningCenterProvider } from "./planningCenter/PlanningCenterProvider"

/**
 * Registry for all content providers in the application.
 * Provides a unified interface for managing different content providers.
 */
export class ContentProviderRegistry {
    private static initialized = false

    /**
     * Initialize all content providers
     */
    static initialize(): void {
        if (this.initialized) return

        // Register all available content providers
        ContentProviderFactory.register("chums", ChumsProvider)
        ContentProviderFactory.register("planningcenter", PlanningCenterProvider)
        ContentProviderFactory.register("amazinglife", AmazingLifeProvider)

        this.initialized = true
        // console.log("Content provider registry initialized")
    }

    /**
     * Get a content provider by name
     */
    static getProvider<T extends ContentProvider = ContentProvider>(providerId: ContentProviderId): T | null {
        this.ensureInitialized()
        return ContentProviderFactory.getProvider<T>(providerId)
    }

    /**
     * Get all registered provider names
     */
    static getAvailableProviders(): ContentProviderId[] {
        this.ensureInitialized()
        return ContentProviderFactory.getRegisteredProviders()
    }

    /**
     * Connect to a content provider
     */
    static async connect(providerId: ContentProviderId, scope: string): Promise<boolean> {
        this.ensureInitialized()

        const provider = this.getProvider(providerId)
        if (!provider) {
            console.error(`Content provider '${providerId}' not found`)
            return false
        }

        try {
            const result = await provider.connect(scope as any)
            return !!result
        } catch (error) {
            console.error(`Failed to connect to ${providerId}:`, error)
            return false
        }
    }

    /**
     * Disconnect from a content provider
     */
    static disconnect(providerId: ContentProviderId, scope?: string): void {
        this.ensureInitialized()

        const provider = this.getProvider(providerId)
        if (!provider) {
            console.error(`Content provider '${providerId}' not found`)
            return
        }

        try {
            provider.disconnect(scope as any)
        } catch (error) {
            console.error(`Failed to disconnect from ${providerId}:`, error)
        }
    }

    /**
     * Load services from a content provider
     */
    static async loadServices(providerId: ContentProviderId, dataPath?: string): Promise<void> {
        this.ensureInitialized()

        const provider = this.getProvider(providerId)
        if (!provider) {
            console.error(`Content provider '${providerId}' not found`)
            return
        }

        try {
            await provider.loadServices(dataPath)
        } catch (error) {
            console.error(`Failed to load services from ${providerId}:`, error)
            throw error
        }
    }

    /**
     * Perform startup load for a content provider
     */
    static async startupLoad(providerId: ContentProviderId, scope: string, data?: any): Promise<void> {
        this.ensureInitialized()

        const provider = this.getProvider(providerId)
        if (!provider) {
            console.error(`Content provider '${providerId}' not found`)
            return
        }

        if (!getContentProviderAccess(providerId, scope)) {
            return
        }

        try {
            await provider.startupLoad(scope as any, data)
        } catch (error) {
            console.error(`Failed to perform startup load for ${providerId}:`, error)
        }
    }

    /**
     * Export data to a content provider (if supported)
     */
    static async exportData(providerId: ContentProviderId, data: any): Promise<void> {
        this.ensureInitialized()

        const provider = this.getProvider(providerId)
        if (!provider) {
            console.error(`Content provider '${providerId}' not found`)
            return
        }

        if (!provider.exportData) {
            console.warn(`Content provider '${providerId}' does not support data export`)
            return
        }

        try {
            await provider.exportData(data)
        } catch (error) {
            console.error(`Failed to export data to ${providerId}:`, error)
            throw error
        }
    }

    /**
     * Check if a provider supports a specific scope
     */
    static supportsScope(providerId: ContentProviderId, scope: string): boolean {
        this.ensureInitialized()

        const provider = this.getProvider(providerId)
        if (!provider) {
            return false
        }

        return provider.supportedScopes.includes(scope)
    }

    /**
     * Get supported scopes for a provider
     */
    static getSupportedScopes(providerId: ContentProviderId): readonly string[] {
        this.ensureInitialized()

        const provider = this.getProvider(providerId)
        if (!provider) {
            return []
        }

        return provider.supportedScopes
    }

    private static ensureInitialized(): void {
        if (!this.initialized) {
            this.initialize()
        }
    }
}

/**
 * Legacy function exports for backward compatibility.
 * These now delegate to the ContentProviderRegistry and providers.
 */

// Planning Center legacy functions (still used internally)
export async function pcoConnect(scope: any) {
    const provider = ContentProviderRegistry.getProvider<PlanningCenterProvider>("planningcenter")
    if (provider) {
        return provider.connect(scope)
    }
    return null
}

export async function pcoRequest(data: any, _attempt = 0) {
    const provider = ContentProviderRegistry.getProvider<PlanningCenterProvider>("planningcenter")
    if (provider) {
        return provider.apiRequest(data)
    }
}

// Initialize the registry when this module is imported
ContentProviderRegistry.initialize()