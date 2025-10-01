import { ContentProvider } from "../base/ContentProvider"
import { getKey } from "../../utils/keys"
import { AMAZING_LIFE_API_URL } from "./types"

// Import and re-export types
import type { AmazingLifeScopes } from "./types"
export type { AmazingLifeScopes } from "./types"

export interface AmazingLifeAuthData {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: AmazingLifeScopes
}

/**
 * Amazing Life provider that acts as the sole interface to Amazing Life functionality.
 *
 * This is the ONLY class that should interface with Amazing Life services.
 * All external code should use this provider through ContentProviderRegistry.
 */
export class AmazingLifeProvider extends ContentProvider<AmazingLifeScopes, AmazingLifeAuthData> {
    constructor() {
        super({
            name: "amazingLife",
            displayName: "Amazing Life",
            port: 5503,
            clientId: getKey("amazinglife_id") || "",
            clientSecret: getKey("amazinglife_secret") || "",
            apiUrl: AMAZING_LIFE_API_URL,
            scopes: ["services"] as const
        })
    }

    async connect(scope: AmazingLifeScopes): Promise<AmazingLifeAuthData | null> {
        // TODO: Implement Amazing Life authentication
        console.log(`Connecting to Amazing Life with scope: ${scope}`)
        return null
    }

    disconnect(scope: AmazingLifeScopes = "services"): void {
        // TODO: Implement Amazing Life disconnection
        console.log(`Disconnecting from Amazing Life with scope: ${scope}`)
        this.access = null
    }

    async apiRequest(data: any): Promise<any> {
        // TODO: Implement Amazing Life API requests
        console.log(`Making Amazing Life API request:`, data)
        return null
    }

    async loadServices(dataPath?: string): Promise<void> {
        // TODO: Implement Amazing Life service loading
        console.log(`Loading services from Amazing Life${dataPath ? ` at ${dataPath}` : ""}`)
    }

    async startupLoad(scope: AmazingLifeScopes, data?: any): Promise<void> {
        const connected = await this.connect(scope)
        if (!connected) return

        // Load services from Amazing Life
        await this.loadServices(data?.dataPath)
    }

    protected handleAuthCallback(_req: any, _res: any): void {
        // TODO: Implement Amazing Life auth callback handling
    }

    protected async refreshToken(_scope: AmazingLifeScopes): Promise<AmazingLifeAuthData | null> {
        // TODO: Implement Amazing Life token refresh
        return null
    }

    protected async authenticate(_scope: AmazingLifeScopes): Promise<AmazingLifeAuthData | null> {
        // TODO: Implement Amazing Life authentication
        return null
    }
}
