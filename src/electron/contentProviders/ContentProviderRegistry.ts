import { getContentProviderAccess } from "../data/contentProviders"
import { AmazingLifeProvider } from "./amazingLife/AmazingLifeProvider"
import { CanvaProvider } from "./canva/CanvaProvider"
import type { ContentProvider } from "./base/ContentProvider"
import { ContentProviderFactory } from "./base/ContentProvider"
import type { ContentProviderId } from "./base/types"
import { ChurchAppsProvider } from "./churchApps/ChurchAppsProvider"
import { OnStageProvider } from "./onStage/OnStageProvider"
import { PlanningCenterProvider } from "./planningCenter/PlanningCenterProvider"
import type { PCOFolderTreeNode } from "./planningCenter/request"
import type { PCOLiveData } from "./planningCenter/live"

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
        ContentProviderFactory.register("churchApps", ChurchAppsProvider)
        ContentProviderFactory.register("planningcenter", PlanningCenterProvider)
        ContentProviderFactory.register("amazinglife", AmazingLifeProvider)
        ContentProviderFactory.register("onstage", OnStageProvider)
        ContentProviderFactory.register("canva", CanvaProvider)

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
     * The providers that already hold an access token, so the app knows what is connected before
     * any sync has run this session.
     */
    static getConnectedProviders(): { [key in ContentProviderId]?: boolean } {
        this.ensureInitialized()

        const connections: { [key in ContentProviderId]?: boolean } = {}
        this.getAvailableProviders().forEach((providerId) => {
            const provider = this.getProvider(providerId)
            const hasAccess = (provider?.supportedScopes || []).some((scope) => !!getContentProviderAccess(providerId, scope))
            if (hasAccess) connections[providerId] = true
        })

        return connections
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
     * Reload a single show from a provider, leaving everything else it manages alone
     */
    static async reloadShow(providerId: ContentProviderId, showId: string, data?: any): Promise<void> {
        this.ensureInitialized()

        const provider = this.getProvider(providerId)
        if (!provider?.reloadShow) {
            console.error(`Content provider '${providerId}' cannot reload a single show`)
            return
        }

        try {
            await provider.reloadShow(showId, data)
        } catch (error) {
            console.error(`Failed to reload show from ${providerId}:`, error)
        }
    }

    /**
     * Load services from a content provider
     */
    static async loadServices(providerId: ContentProviderId, cloudOnly: boolean, data: any): Promise<void> {
        this.ensureInitialized()

        const provider = this.getProvider(providerId)
        if (!provider) {
            console.error(`Content provider '${providerId}' not found`)
            return
        }

        if (cloudOnly) {
            await this.connect(providerId, provider.supportedScopes[0])
            return
        }

        try {
            await provider.loadServices(data)
        } catch (error) {
            console.error(`Failed to load services from ${providerId}:`, error)
            throw error
        }
    }

    /**
     * Perform startup load for a content provider
     */
    static async startupLoad(providerId: ContentProviderId, scope: string, data?: any, cloudOnly?: boolean): Promise<void> {
        this.ensureInitialized()

        const provider = this.getProvider(providerId)
        if (!provider) {
            console.error(`Content provider '${providerId}' not found`)
            return
        }

        if (!getContentProviderAccess(providerId, scope)) {
            return
        }

        if (cloudOnly) {
            await this.connect(providerId, provider.supportedScopes[0])
            return
        }

        try {
            await provider.startupLoad(scope as any, data)
        } catch (error) {
            console.error(`Failed to perform startup load for ${providerId}:`, error)
        }
    }

    /**
     * Fetch the folder/service-type tree for a provider (Planning Center only for now)
     */
    static async fetchFolderTree(providerId: ContentProviderId): Promise<PCOFolderTreeNode[]> {
        this.ensureInitialized()
        return this.getProvider<PlanningCenterProvider>(providerId)?.fetchFolderTree?.() ?? []
    }

    /**
     * Fetch the full folder/service-type/plan tree for selecting a specific PCO plan
     */
    static async fetchServiceTree(providerId: ContentProviderId): Promise<PCOFolderTreeNode[]> {
        this.ensureInitialized()
        return this.getProvider<PlanningCenterProvider>(providerId)?.fetchServiceTree?.() ?? []
    }

    /**
     * Load a single PCO plan by service type and plan ID
     */
    static async loadSinglePlan(serviceTypeId: string, planId: string): Promise<void> {
        this.ensureInitialized()
        return this.getProvider<PlanningCenterProvider>("planningcenter")?.loadSinglePlan?.(serviceTypeId, planId)
    }

    /**
     * List the OnStage teams available for switching
     */
    static async getOnStageTeams(): Promise<{ id: string; name: string; current: boolean }[]> {
        this.ensureInitialized()
        return this.getProvider<OnStageProvider>("onstage")?.getTeams?.() ?? []
    }

    /**
     * Switch the active OnStage team (may launch a browser consent for a new team)
     */
    static async switchOnStageTeam(teamId: string): Promise<{ success: boolean }> {
        this.ensureInitialized()
        return this.getProvider<OnStageProvider>("onstage")?.switchTeam?.(teamId) ?? { success: false }
    }

    /**
     * Get PCO Live countdown data for a specific plan
     */
    static async getPcoLiveData(serviceTypeId: string, planId: string): Promise<PCOLiveData | null> {
        this.ensureInitialized()
        return this.getProvider<PlanningCenterProvider>("planningcenter")?.getLiveData?.(serviceTypeId, planId) ?? null
    }

    /**
     * Authorize a Pusher channel subscription for PCO Live real-time updates
     */
    static async getPcoPusherAuth(socketId: string, channelName: string, serviceTypeId: string): Promise<{ auth: string; channel_data?: string } | null> {
        this.ensureInitialized()
        return this.getProvider<PlanningCenterProvider>("planningcenter")?.getPusherAuth?.(socketId, channelName, serviceTypeId) ?? null
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

export async function pcoRequest(data: any) {
    const provider = ContentProviderRegistry.getProvider<PlanningCenterProvider>("planningcenter")
    if (provider) {
        return provider.apiRequest(data)
    }
}

// Initialize the registry when this module is imported
ContentProviderRegistry.initialize()
