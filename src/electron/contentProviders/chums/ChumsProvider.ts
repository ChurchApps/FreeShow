import { ContentProvider } from "../base/ContentProvider"
import { getKey } from "../../utils/keys"
import { ChumsConnect } from "./ChumsConnect"

// Import and re-export types
import type { ChumsScopes } from "./types"
export type { ChumsScopes } from "./types"

// Fix ChumsAuthData to not include null in the export
export interface ChumsAuthData {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: ChumsScopes
}

/**
 * Chums provider that acts as the sole interface to ChumsConnect
 */
export class ChumsProvider extends ContentProvider<ChumsScopes, ChumsAuthData> {
    constructor() {
        super({
            name: "chums",
            port: 5502,
            clientId: getKey("chums_id") || "",
            clientSecret: getKey("chums_secret") || "",
            apiUrl: "https://api.churchapps.org",
            scopes: ["plans"] as const
        })
    }

    async connect(scope: ChumsScopes): Promise<ChumsAuthData | null> {
        const result = await ChumsConnect.connect(scope)
        this.access = result
        return result
    }

    disconnect(scope: ChumsScopes = "plans"): void {
        ChumsConnect.disconnect(scope)
        this.access = null
    }

    async apiRequest(data: any): Promise<any> {
        return ChumsConnect.apiRequest(data)
    }

    async loadServices(): Promise<void> {
        // Delegate to original implementation for now
        // This will be implemented when we integrate the full ChumsImport functionality
        throw new Error("Use original chums implementation for now")
    }

    async startupLoad(_scope: ChumsScopes, _data?: any): Promise<void> {
        // Delegate to original implementation for now
        // This will be implemented when we integrate the full startup logic
        throw new Error("Use original chums implementation for now")
    }

    protected handleAuthCallback(_req: any, _res: any): void {
        // Not used - ChumsConnect handles authentication internally
    }

    protected async refreshToken(_scope: ChumsScopes): Promise<ChumsAuthData | null> {
        // Not used - ChumsConnect handles token refresh internally
        return null
    }

    protected async authenticate(_scope: ChumsScopes): Promise<ChumsAuthData | null> {
        // Not used - ChumsConnect handles authentication internally
        return null
    }
}