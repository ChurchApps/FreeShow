/**
 * Content Providers Module
 *
 * This module provides a unified interface for managing different content providers
 * like Chums and Planning Center. It includes:
 *
 * - Base classes and interfaces for creating new content providers
 * - Common authentication flows (OAuth2, PKCE)
 * - Registry for managing provider instances
 * - Legacy function exports for backward compatibility
 */

// Base classes and types
export { ContentProvider, ContentProviderFactory } from "./base/ContentProvider"
export { OAuth2Helper, PKCEHelper } from "./base/OAuth2Helper"
export {
    ContentProviderError,
    ContentProviderErrorType,
    type ContentProviderSongData,
    type ContentProviderServicePlan,
    type ContentProviderPlanItem,
    type ContentProviderService,
    type LoadServicesOptions,
    type ExportDataOptions,
    type ContentProviderStatus
} from "./base/types"

// Provider implementations (simplified versions for now)
export { ChumsProvider, type ChumsScopes, type ChumsAuthData } from "./chums/ChumsProvider"
export { PlanningCenterProvider, type PCOScopes, type PCOAuthData } from "./planningCenter/PlanningCenterProvider"

// Registry and legacy functions
export {
    ContentProviderRegistry,
    // Legacy exports for backward compatibility
    chumsLoadServices,
    chumsStartupLoad,
    pcoLoadServices,
    pcoStartupLoad,
    pcoConnect,
    pcoRequest
} from "./ContentProviderRegistry"

/**
 * How to add a new content provider:
 *
 * 1. Create a new directory under contentProviders/ (e.g., contentProviders/newProvider/)
 *
 * 2. Create your provider class extending ContentProvider:
 * ```typescript
 * export class NewProvider extends ContentProvider<NewProviderScopes, NewProviderAuthData> {
 *     constructor() {
 *         super({
 *             name: "newProvider",
 *             port: 5504, // Choose unique port
 *             clientId: getKey("newprovider_id"),
 *             clientSecret: getKey("newprovider_secret"),
 *             apiUrl: "https://api.newprovider.com",
 *             scopes: ["scope1", "scope2"] as const
 *         })
 *     }
 *
 *     // Implement required abstract methods
 *     async connect(scope: NewProviderScopes): Promise<NewProviderAuthData | null> { ... }
 *     disconnect(scope?: NewProviderScopes): void { ... }
 *     async apiRequest(data: NewProviderRequestData): Promise<any> { ... }
 *     async loadServices(dataPath?: string): Promise<void> { ... }
 *     async startupLoad(scope: NewProviderScopes, data?: any): Promise<void> { ... }
 *
 *     // Implement OAuth handlers
 *     protected handleAuthCallback(req: express.Request, res: express.Response): void { ... }
 *     protected async refreshToken(scope: NewProviderScopes): Promise<NewProviderAuthData | null> { ... }
 *     protected async authenticate(scope: NewProviderScopes): Promise<NewProviderAuthData | null> { ... }
 * }
 * ```
 *
 * 3. Register your provider in ContentProviderRegistry.ts:
 * ```typescript
 * ContentProviderFactory.register("newProvider", NewProvider)
 * ```
 *
 * 4. Add legacy function exports if needed for backward compatibility
 *
 * 5. Export your provider from this index.ts file
 *
 * 6. Update IPC handlers in responsesMain.ts to use the registry:
 * ```typescript
 * ContentProviderRegistry.connect("newProvider", scope)
 * ContentProviderRegistry.loadServices("newProvider", dataPath)
 * ```
 */