/**
 * ChurchTools provider — sole public interface for all ChurchTools functionality.
 *
 * WARNING: This is the ONLY class that should import from connect.ts and request.ts.
 * All external code should use this provider through ContentProviderRegistry.
 */

import { ContentProvider } from "../base/ContentProvider"
import { ctConnect, ctDisconnect, ctInitialize, ctStartupLoad } from "./connect"
import { ctLoadServices } from "./request"
import type { CTScopes } from "./types"

export type { CTScopes } from "./types"

export interface CTAuthDataExport {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: CTScopes
    domain: string
}

export class ChurchToolsProvider extends ContentProvider<CTScopes, CTAuthDataExport> {
    constructor() {
        super({
            providerId: "churchtools",
            displayName: "ChurchTools",
            port: 5503, // reserved; CT uses token auth, no local redirect server
            clientId: "",
            clientSecret: "",
            apiUrl: "", // dynamic per installation
            scopes: ["services"] as const
        })
    }

    isConnected(_scope: CTScopes): boolean {
        return this.access !== null
    }

    async connect(_scope: CTScopes, data?: { url?: string; token?: string }): Promise<CTAuthDataExport | null> {
        const result = await ctConnect(data)
        this.access = result as CTAuthDataExport | null
        return this.access
    }

    disconnect(_scope?: CTScopes): void {
        ctDisconnect()
        this.access = null
    }

    async apiRequest(_data: any): Promise<any> {
        return null // all requests go through request.ts directly
    }

    async loadServices(data?: { url?: string; token?: string; serviceId?: number; sngFolder?: string; sngTranslationMethod?: string; weeksAhead?: number }): Promise<void> {
        const connected = await this.connect("services", data)
        if (!connected) return
        return ctLoadServices(data?.serviceId)
    }

    async startupLoad(_scope: CTScopes): Promise<void> {
        ctInitialize()
        await ctStartupLoad(() => ctLoadServices())
    }

    protected handleAuthCallback(_req: any, _res: any): void {}
    protected async refreshToken(_scope: CTScopes): Promise<CTAuthDataExport | null> { return null }
    protected async authenticate(_scope: CTScopes): Promise<CTAuthDataExport | null> { return null }
}
