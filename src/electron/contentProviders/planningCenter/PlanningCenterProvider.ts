import { ContentProvider } from "../base/ContentProvider"
import { getKey } from "../../utils/keys"
import { pcoConnect, pcoDisconnect, pcoStartupLoad, type PCOScopes } from "./connect"
import { pcoRequest, pcoLoadServices } from "./request"

// Re-export types from connect file
export type { PCOScopes } from "./connect"

// Fix PCOAuthData to not include null in the export
export interface PCOAuthData {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: PCOScopes
}

/**
 * Planning Center provider that acts as the sole interface to Planning Center functionality.
 *
 * This is the ONLY class that should import from connect.ts and request.ts.
 * All external code should use this provider through ContentProviderRegistry.
 */
export class PlanningCenterProvider extends ContentProvider<PCOScopes, PCOAuthData> {
    constructor() {
        super({
            name: "planningCenter",
            port: 5501,
            clientId: getKey("pco_id") || "",
            clientSecret: getKey("pco_secret") || "",
            apiUrl: "https://api.planningcenteronline.com",
            scopes: ["calendar", "check_ins", "giving", "groups", "people", "publishing", "services"] as const
        })
    }

    async connect(scope: PCOScopes): Promise<PCOAuthData | null> {
        const result = await pcoConnect(scope)
        this.access = result
        return result
    }

    disconnect(scope: PCOScopes = "services"): void {
        pcoDisconnect(scope)
        this.access = null
    }

    async apiRequest(data: any): Promise<any> {
        return pcoRequest(data)
    }

    async loadServices(dataPath?: string): Promise<void> {
        return pcoLoadServices(dataPath || "")
    }

    async startupLoad(scope: PCOScopes, data?: any): Promise<void> {
        const dataPath = data?.dataPath || ""
        return pcoStartupLoad(dataPath, scope)
    }

    protected handleAuthCallback(_req: any, _res: any): void {
        // Not used - connect.ts handles authentication internally
    }

    protected async refreshToken(_scope: PCOScopes): Promise<PCOAuthData | null> {
        // Not used - connect.ts handles token refresh internally
        return null
    }

    protected async authenticate(_scope: PCOScopes): Promise<PCOAuthData | null> {
        // Not used - connect.ts handles authentication internally
        return null
    }
}