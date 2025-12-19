import express from "express"
import { ToMain } from "../../../types/IPC/ToMain"
import { getContentProviderAccess, setContentProviderAccess } from "../../data/contentProviders"
import { sendToMain } from "../../IPC/main"
import { getKey } from "../../utils/keys"
import { OAuth2Helper } from "../base/OAuth2Helper"
import type { AmazingLifeAuthData, AmazingLifeScopes } from "./types"
import { AMAZING_LIFE_OAUTH_BASE } from "./types"

/**
 * Handles authentication and connection management with the AmazingLife (APlay) service.
 * Manages OAuth PKCE flow, token refresh, and connection state.
 *
 * WARNING: This class should ONLY be accessed through AmazingLifeProvider.
 * Do not import or use this class directly in other parts of the application.
 * Use ContentProviderRegistry or AmazingLifeProvider instead.
 */
export class AmazingLifeConnect {
    private static readonly AMAZING_LIFE_PORT = 5502
    private static AMAZING_LIFE_ACCESS: AmazingLifeAuthData | null = null
    private static readonly clientId: string = getKey("amazinglife_id") || ""
    private static oauthHelper: OAuth2Helper<AmazingLifeAuthData>
    private static app = express()
    private static routeSetup = false

    private static initializeOAuthHelper(): void {
        if (!this.oauthHelper) {
            const redirectUri = `http://localhost:${this.AMAZING_LIFE_PORT}/auth/complete`
            this.oauthHelper = new OAuth2Helper<AmazingLifeAuthData>({
                clientId: this.clientId,
                clientSecret: "", // Not needed for PKCE flow
                authUrl: `${AMAZING_LIFE_OAUTH_BASE}/authorize`,
                tokenUrl: `${AMAZING_LIFE_OAUTH_BASE}/token`,
                redirectUri,
                scopes: ["openid", "profile", "email"],
                usePKCE: true,
                additionalParams: { state: "xyz" }
            })
        }

        // Set up the auth callback route
        if (!this.routeSetup) {
            this.app.get("/auth/complete", (req, res) => {
                this.handleAuthCallback(req, res)
            })
            this.routeSetup = true
        }
    }

    public static initialize() {
        this.AMAZING_LIFE_ACCESS = null
    }

    public static async connect(scope: AmazingLifeScopes): Promise<AmazingLifeAuthData | null> {
        let accessData = this.AMAZING_LIFE_ACCESS || (getContentProviderAccess("amazinglife", scope) as AmazingLifeAuthData | null)

        if (this.isTokenExpired(accessData)) accessData = await this.refreshToken(scope)
        if (!accessData) accessData = await this.authenticate(scope)
        if (!accessData) return null

        if (!this.AMAZING_LIFE_ACCESS) connectionInitialized()
        this.AMAZING_LIFE_ACCESS = accessData

        return accessData
    }

    public static disconnect(scope: AmazingLifeScopes = "openid profile email"): void {
        console.log(`APlay: Disconnecting (scope: ${scope})`)
        setContentProviderAccess("amazinglife", scope, null)
        this.AMAZING_LIFE_ACCESS = null
    }

    public static getAccessToken(): string | null {
        return this.AMAZING_LIFE_ACCESS?.access_token || null
    }

    private static isTokenExpired(access: AmazingLifeAuthData | null): boolean {
        if (!access?.created_at || !access?.expires_in) return true
        return (access.created_at + access.expires_in) * 1000 < Date.now()
    }

    private static async refreshToken(scope: AmazingLifeScopes): Promise<AmazingLifeAuthData | null> {
        if (!this.AMAZING_LIFE_ACCESS?.refresh_token) {
            console.warn("No refresh token available for APlay")
            return null
        }

        try {
            this.initializeOAuthHelper()
            const refreshed = await this.oauthHelper.refreshAccessToken(this.AMAZING_LIFE_ACCESS.refresh_token, scope)
            if (refreshed) {
                this.AMAZING_LIFE_ACCESS = refreshed
                setContentProviderAccess("amazinglife", scope, refreshed)
            }
            return refreshed
        } catch (error) {
            console.error("Failed to refresh APlay token:", error)
            return null
        }
    }

    private static async authenticate(scope: AmazingLifeScopes): Promise<AmazingLifeAuthData | null> {
        this.initializeOAuthHelper()

        const server = this.app.listen(this.AMAZING_LIFE_PORT, () => {
            console.info(`Listening for APlay OAuth response at port ${this.AMAZING_LIFE_PORT}`)
        })

        server.once("error", (err: Error) => {
            if ((err as any).code === "EADDRINUSE") server.close()
        })

        try {
            const authData = await this.oauthHelper.authorize(scope)
            if (!authData) return null

            setContentProviderAccess("amazinglife", scope, authData)
            this.AMAZING_LIFE_ACCESS = authData
            connectionInitialized(true)
            return authData
        } catch (error) {
            console.error("APlay authentication failed:", error)
            return null
        } finally {
            server.close()
        }
    }

    public static handleAuthCallback(req: express.Request, res: express.Response): void {
        this.initializeOAuthHelper()
        this.oauthHelper.handleCallback(req, res)
    }
}

function connectionInitialized(isFirstConnection: boolean = false): void {
    sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "amazinglife", success: true, isFirstConnection })
}
