import { ContentProvider } from "../base/ContentProvider"
import { getContentProviderAccess, setContentProviderAccess } from "../../data/contentProviders"
import { sendToMain } from "../../IPC/main"
import { ToMain } from "../../../types/IPC/ToMain"
import { getKey } from "../../utils/keys"

// Re-export original types for compatibility
export type PCOScopes = "calendar" | "check_ins" | "giving" | "groups" | "people" | "publishing" | "services"
export interface PCOAuthData {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: PCOScopes
}

/**
 * Simplified Planning Center provider that demonstrates the new architecture
 * while maintaining compatibility with existing code
 */
export class PlanningCenterProvider extends ContentProvider<PCOScopes, PCOAuthData> {
    constructor() {
        super({
            name: "planningCenter",
            port: 5503,
            clientId: getKey("pco_id") || "",
            clientSecret: getKey("pco_secret") || "",
            apiUrl: "https://api.planningcenteronline.com",
            scopes: ["calendar", "check_ins", "giving", "groups", "people", "publishing", "services"] as const
        })
    }

    async connect(scope: PCOScopes): Promise<PCOAuthData | null> {
        // For now, delegate to the original implementation
        const existingAccess = getContentProviderAccess("planningCenter", scope)
        if (existingAccess) {
            this.access = existingAccess as PCOAuthData
            return this.access
        }
        return null
    }

    disconnect(scope?: PCOScopes): void {
        this.access = null
        if (scope) {
            setContentProviderAccess("planningCenter", scope, null)
        }
        sendToMain(ToMain.PCO_CONNECT, { success: false })
    }

    async apiRequest(_data: any): Promise<any> {
        // Delegate to original implementation for now
        throw new Error("Use original planning center implementation for now")
    }

    async loadServices(_dataPath?: string): Promise<void> {
        // Delegate to original implementation
        throw new Error("Use original planning center implementation for now")
    }

    async startupLoad(_scope: PCOScopes, _data?: any): Promise<void> {
        // Delegate to original implementation
        throw new Error("Use original planning center implementation for now")
    }

    protected handleAuthCallback(_req: any, _res: any): void {
        // Delegate to original implementation
    }

    protected async refreshToken(_scope: PCOScopes): Promise<PCOAuthData | null> {
        return null
    }

    protected async authenticate(_scope: PCOScopes): Promise<PCOAuthData | null> {
        return null
    }
}