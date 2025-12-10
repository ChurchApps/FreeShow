import type express from "express"
import { ContentProvider } from "../base/ContentProvider"
import { AmazingLifeConnect } from "./AmazingLifeConnect"
import { AmazingLifeContentLibrary } from "./AmazingLifeContentLibrary"
import type { ContentFile, ContentLibraryCategory } from "../base/types"
import { AMAZING_LIFE_API_URL } from "./types"
import { getKey } from "../../utils/keys"
import { getMachineId } from "../../IPC/responsesMain"

// Import and re-export types
import type { AmazingLifeScopes, AmazingLifeAuthData } from "./types"
export type { AmazingLifeScopes, AmazingLifeAuthData } from "./types"

/**
 * AmazingLife (APlay) provider that acts as the sole interface to AmazingLife functionality.
 *
 * This is the ONLY class that should import from AmazingLifeConnect.ts and AmazingLifeContentLibrary.ts.
 * All external code should use this provider through ContentProviderRegistry.
 */
export class AmazingLifeProvider extends ContentProvider<AmazingLifeScopes, AmazingLifeAuthData> {
    hasContentLibrary = true

    constructor() {
        const port = 5502
        const clientId = getKey("amazinglife_id") || ""

        super({
            providerId: "amazinglife",
            displayName: "APlay",
            port,
            clientId,
            clientSecret: "",
            apiUrl: AMAZING_LIFE_API_URL,
            scopes: ["openid profile email"] as const
        })
    }

    async connect(scope: AmazingLifeScopes): Promise<AmazingLifeAuthData | null> {
        const result = await AmazingLifeConnect.connect(scope)
        this.access = result
        return result
    }

    disconnect(scope: AmazingLifeScopes = "openid profile email"): void {
        AmazingLifeConnect.disconnect(scope)
        AmazingLifeContentLibrary.clearCache()
        this.access = null
    }

    async apiRequest(data: any): Promise<any> {
        console.log(data)
        return null
    }

    async loadServices(): Promise<void> {
        const connected = await this.connect("openid profile email")
        if (!connected) {
            console.error("Failed to connect to APlay")
            return
        }
    }

    async startupLoad(scope: AmazingLifeScopes): Promise<void> {
        const connected = await this.connect(scope)
        if (!connected) return

        await this.loadServices()
    }

    /**
     * Retrieves the content library hierarchy: Modules -> Products -> Libraries
     */
    async getContentLibrary(): Promise<ContentLibraryCategory[]> {
        return AmazingLifeContentLibrary.getContentLibrary()
    }

    /**
     * Retrieves media content for a specific library
     */
    async getContent(libraryId: string): Promise<ContentFile[]> {
        return AmazingLifeContentLibrary.getContent(libraryId)
    }

    /**
     * Checks if a media item is licensed and returns its pingback URL
     * This should be called when the user actually tries to use/play a media item
     */
    async checkMediaLicense(mediaId: string): Promise<string | null> {
        return AmazingLifeContentLibrary.checkMediaLicense(mediaId)
    }

    /**
     * Determines if a specific URL should be encrypted
     * AmazingLife media should only be encrypted if it has a pingback URL (licensed content)
     */
    shouldEncrypt(_url: string, pingbackUrl?: string): boolean {
        // Only encrypt if this has a pingback URL (indicating licensed content)
        return !!pingbackUrl
    }

    /**
     * Returns the encryption key for AmazingLife media
     * Uses the machine ID as the encryption key
     */
    getEncryptionKey(): string {
        return getMachineId()
    }

    protected handleAuthCallback(req: express.Request, res: express.Response): void {
        AmazingLifeConnect.handleAuthCallback(req, res)
    }

    protected async refreshToken(_scope: AmazingLifeScopes): Promise<AmazingLifeAuthData | null> {
        // Handled internally by AmazingLifeConnect
        return null
    }

    protected async authenticate(_scope: AmazingLifeScopes): Promise<AmazingLifeAuthData | null> {
        // Handled internally by AmazingLifeConnect
        return null
    }
}
