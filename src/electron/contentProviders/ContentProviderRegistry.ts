import type { Main, MainSendPayloads } from "../../types/IPC/Main"
import { getContentProviderAccess } from "../data/contentProviders"

import { ContentProvider, ContentProviderFactory } from "./base/ContentProvider"
// Import original implementations for now
import { chumsDisconnect as originalChumsDisconnect, chumsLoadServices as originalChumsLoadServices, chumsStartupLoad as originalChumsStartupLoad } from "./chums"
import { pcoDisconnect as originalPcoDisconnect, pcoStartupLoad as originalPcoStartupLoad } from "./planningCenter/connect"
import { pcoLoadServices as originalPcoLoadServices } from "./planningCenter/request"

// Import simplified providers for demonstration
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
        ContentProviderFactory.register("planningCenter", PlanningCenterProvider)

        this.initialized = true
        console.log("Content provider registry initialized")
    }

    /**
     * Get a content provider by name
     */
    static getProvider<T extends ContentProvider = ContentProvider>(name: string): T | null {
        this.ensureInitialized()
        return ContentProviderFactory.getProvider<T>(name)
    }

    /**
     * Get all registered provider names
     */
    static getAvailableProviders(): string[] {
        this.ensureInitialized()
        return ContentProviderFactory.getRegisteredProviders()
    }

    /**
     * Connect to a content provider
     */
    static async connect(providerName: string, scope: string): Promise<boolean> {
        this.ensureInitialized()

        const provider = this.getProvider(providerName)
        if (!provider) {
            console.error(`Content provider '${providerName}' not found`)
            return false
        }

        try {
            const result = await provider.connect(scope as any)
            return !!result
        } catch (error) {
            console.error(`Failed to connect to ${providerName}:`, error)
            return false
        }
    }

    /**
     * Disconnect from a content provider
     */
    static disconnect(providerName: string, scope?: string): void {
        this.ensureInitialized()

        const provider = this.getProvider(providerName)
        if (!provider) {
            console.error(`Content provider '${providerName}' not found`)
            return
        }

        try {
            provider.disconnect(scope as any)
        } catch (error) {
            console.error(`Failed to disconnect from ${providerName}:`, error)
        }
    }

    /**
     * Load services from a content provider
     */
    static async loadServices(providerName: string, dataPath?: string): Promise<void> {
        this.ensureInitialized()

        const provider = this.getProvider(providerName)
        if (!provider) {
            console.error(`Content provider '${providerName}' not found`)
            return
        }

        try {
            await provider.loadServices(dataPath)
        } catch (error) {
            console.error(`Failed to load services from ${providerName}:`, error)
            throw error
        }
    }

    /**
     * Perform startup load for a content provider
     */
    static async startupLoad(providerName: string, scope: string, data?: any): Promise<void> {
        this.ensureInitialized()

        const provider = this.getProvider(providerName)
        if (!provider) {
            console.error(`Content provider '${providerName}' not found`)
            return
        }

        if (!getContentProviderAccess(providerName, scope)) {
            console.log(`No access configured for ${providerName}:${scope}`)
            return
        }

        try {
            await provider.startupLoad(scope as any, data)
        } catch (error) {
            console.error(`Failed to perform startup load for ${providerName}:`, error)
        }
    }

    /**
     * Export data to a content provider (if supported)
     */
    static async exportData(providerName: string, data: any): Promise<void> {
        this.ensureInitialized()

        const provider = this.getProvider(providerName)
        if (!provider) {
            console.error(`Content provider '${providerName}' not found`)
            return
        }

        if (!provider.exportData) {
            console.warn(`Content provider '${providerName}' does not support data export`)
            return
        }

        try {
            await provider.exportData(data)
        } catch (error) {
            console.error(`Failed to export data to ${providerName}:`, error)
            throw error
        }
    }

    /**
     * Check if a provider supports a specific scope
     */
    static supportsScope(providerName: string, scope: string): boolean {
        this.ensureInitialized()

        const provider = this.getProvider(providerName)
        if (!provider) {
            return false
        }

        return provider.supportedScopes.includes(scope)
    }

    /**
     * Get supported scopes for a provider
     */
    static getSupportedScopes(providerName: string): readonly string[] {
        this.ensureInitialized()

        const provider = this.getProvider(providerName)
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
 * Legacy function exports for backward compatibility
 * These maintain the same API as the original individual provider functions
 */

// Legacy functions that delegate to original implementations for now
// In a full migration, these would use the ContentProviderRegistry

// Chums legacy functions
export function chumsDisconnect(scope?: any) {
    return originalChumsDisconnect(scope)
}

export function chumsLoadServices() {
    return originalChumsLoadServices()
}

export function chumsStartupLoad(scope: any = "plans", data: MainSendPayloads[Main.CHUMS_STARTUP_LOAD]) {
    return originalChumsStartupLoad(scope, data)
}

// Planning Center legacy functions
export function pcoDisconnect(scope: any = "services") {
    return originalPcoDisconnect(scope)
}

export function pcoLoadServices(dataPath: string) {
    return originalPcoLoadServices(dataPath)
}

export function pcoStartupLoad(dataPath: string, scope: any = "services") {
    return originalPcoStartupLoad(dataPath, scope)
}

export async function pcoConnect(scope: any) {
    // Import and use original pcoConnect
    const { pcoConnect: originalPcoConnect } = await import("./planningCenter/connect")
    return originalPcoConnect(scope)
}

export async function pcoRequest(data: any, attempt = 0) {
    // Import and use original pcoRequest
    const { pcoRequest: originalPcoRequest } = await import("./planningCenter/request")
    return originalPcoRequest(data, attempt)
}

// Initialize the registry when this module is imported
ContentProviderRegistry.initialize()