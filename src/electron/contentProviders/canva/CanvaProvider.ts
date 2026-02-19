import { ContentProvider } from "../base/ContentProvider"
import type { ContentFile, ContentLibraryCategory } from "../base/types"
import { CanvaConnect, OAUTH_PORT } from "./CanvaConnect"
import { CanvaContentLibrary } from "./CanvaContentLibrary"

export type CanvaScopes = "folder:read design:meta:read"

export interface CanvaAuthData {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: CanvaScopes
}

const CANVA_APP_URL = "https://www.canva.com"
export const CANVA_API_URL = "https://api.canva.com/rest"

export class CanvaProvider extends ContentProvider<CanvaScopes, CanvaAuthData> {
    hasContentLibrary = true

    constructor() {
        super({
            providerId: "canva",
            displayName: "Canva",
            port: OAUTH_PORT,
            clientId: "",
            clientSecret: "",
            apiUrl: CANVA_API_URL,
            appUrl: CANVA_APP_URL,
            scopes: ["folder:read design:meta:read"] as const
        })
    }

    isConnected(scope: CanvaScopes): boolean {
        return this.access !== null && this.access.scope === scope
    }

    async connect(scope: CanvaScopes): Promise<CanvaAuthData | null> {
        const result = await CanvaConnect.connect(scope)
        this.access = result
        return result
    }

    disconnect(scope: CanvaScopes = "folder:read design:meta:read"): void {
        CanvaConnect.disconnect(scope)
        CanvaContentLibrary.clearCache()
        this.access = null
    }

    async apiRequest(_data: any): Promise<any> {
        return null
    }

    async loadServices(): Promise<void> {
        const connected = await this.connect("folder:read design:meta:read")
        if (!connected) {
            console.error("Failed to connect to Canva")
        }
    }

    async startupLoad(scope: CanvaScopes): Promise<void> {
        CanvaConnect.initialize()

        const connected = await this.connect(scope)
        if (!connected) return

        await this.loadServices()
    }

    async getContentLibrary(): Promise<ContentLibraryCategory[]> {
        try {
            return CanvaContentLibrary.getContentLibrary()
        } catch (err) {
            return []
        }
    }

    async getContent(folderId: string): Promise<ContentFile[]> {
        return CanvaContentLibrary.getContent(folderId)
    }

    protected handleAuthCallback() {}

    protected async refreshToken(_scope: CanvaScopes): Promise<CanvaAuthData | null> {
        return null
    }

    protected async authenticate(_scope: CanvaScopes): Promise<CanvaAuthData | null> {
        return null
    }
}
