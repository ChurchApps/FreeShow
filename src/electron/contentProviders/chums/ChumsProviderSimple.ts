import { ContentProvider } from "../base/ContentProvider"
import { getContentProviderAccess, setContentProviderAccess } from "../../data/contentProviders"
import { sendToMain } from "../../IPC/main"
import { ToMain } from "../../../types/IPC/ToMain"
import { getKey } from "../../utils/keys"

// Re-export original types for compatibility
export type ChumsScopes = "plans"
export interface ChumsAuthData {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: ChumsScopes
}

/**
 * Simplified Chums provider that demonstrates the new architecture
 * while maintaining compatibility with existing code
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
        // For now, delegate to the original implementation
        // In a full migration, this would use the OAuth2Helper
        const existingAccess = getContentProviderAccess("chums", scope)
        if (existingAccess) {
            this.access = existingAccess as ChumsAuthData
            return this.access
        }
        return null
    }

    disconnect(scope?: ChumsScopes): void {
        this.access = null
        if (scope) {
            setContentProviderAccess("chums", scope, null)
        }
        sendToMain(ToMain.CHUMS_CONNECT, { success: false })
    }

    async apiRequest(_data: any): Promise<any> {
        // Delegate to original implementation for now
        // This would be replaced with standardized API request logic
        throw new Error("Use original chums implementation for now")
    }

    async loadServices(): Promise<void> {
        // Delegate to original implementation
        throw new Error("Use original chums implementation for now")
    }

    async startupLoad(_scope: ChumsScopes, _data?: any): Promise<void> {
        // Delegate to original implementation
        throw new Error("Use original chums implementation for now")
    }

    protected handleAuthCallback(_req: any, _res: any): void {
        // Delegate to original implementation
    }

    protected async refreshToken(_scope: ChumsScopes): Promise<ChumsAuthData | null> {
        return null
    }

    protected async authenticate(_scope: ChumsScopes): Promise<ChumsAuthData | null> {
        return null
    }
}