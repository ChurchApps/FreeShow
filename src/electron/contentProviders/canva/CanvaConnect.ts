import express from "express"
import { ToMain } from "../../../types/IPC/ToMain"
import { getContentProviderAccess, setContentProviderAccess } from "../../data/contentProviders"
import { sendToMain } from "../../IPC/main"
import { getKey } from "../../utils/keys"
import { OAuth2Helper } from "../base/OAuth2Helper"
import { CanvaAuthData, CanvaScopes } from "./CanvaProvider"

const CANVA_OAUTH_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize"
const CANVA_OAUTH_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token"

export class CanvaConnect {
    private static readonly CANVA_PORT = 5505
    private static CANVA_ACCESS: CanvaAuthData | null = null
    private static oauthHelper: OAuth2Helper<CanvaAuthData>
    private static app = express()
    private static routeSetup = false

    private static initializeOAuthHelper(): void {
        if (!this.oauthHelper) {
            const redirectUri = `http://127.0.0.1:${this.CANVA_PORT}/auth/complete`
            this.oauthHelper = new OAuth2Helper<CanvaAuthData>({
                clientId: getKey("canva_id"),
                clientSecret: getKey("canva_secret"),
                authUrl: CANVA_OAUTH_AUTHORIZE_URL,
                tokenUrl: CANVA_OAUTH_TOKEN_URL,
                redirectUri,
                scopes: ["folder:read", "design:meta:read"],
                usePKCE: true,
                additionalParams: { state: "freeshow_canva" }
            })
        }

        if (!this.routeSetup) {
            this.app.get("/auth/complete", (req, res) => {
                try {
                    this.handleAuthCallback(req, res)
                } catch (error) {
                    console.error("Error in Canva auth callback:", error)
                    res.status(500).send("Authentication failed")
                }
            })
            this.routeSetup = true
        }
    }

    public static initialize() {
        this.CANVA_ACCESS = null
    }

    public static async connect(scope: CanvaScopes): Promise<CanvaAuthData | null> {
        let accessData = this.CANVA_ACCESS || (getContentProviderAccess("canva", scope) as CanvaAuthData | null)

        if (this.isTokenExpired(accessData)) accessData = await this.refreshToken(scope)
        if (!accessData) accessData = await this.authenticate(scope)
        if (!accessData) return null

        if (!this.CANVA_ACCESS) connectionInitialized()
        this.CANVA_ACCESS = accessData

        return accessData
    }

    public static disconnect(scope: CanvaScopes = "folder:read design:meta:read"): void {
        setContentProviderAccess("canva", scope, null)
        this.CANVA_ACCESS = null
    }

    public static async ensureValidToken(scope: CanvaScopes = "folder:read design:meta:read"): Promise<string | null> {
        let accessData = this.CANVA_ACCESS || (getContentProviderAccess("canva", scope) as CanvaAuthData | null)

        if (!accessData) {
            return null
        }

        if (this.isTokenExpired(accessData)) {
            accessData = await this.refreshToken(scope)
            if (!accessData) {
                return null
            }
            this.CANVA_ACCESS = accessData
        }

        return accessData.access_token
    }

    private static isTokenExpired(access: CanvaAuthData | null): boolean {
        if (!access?.created_at) return true
        const bufferTime = 5 * 60 * 1000
        return (access.created_at + access.expires_in) * 1000 < Date.now() + bufferTime
    }

    private static async refreshToken(scope: CanvaScopes): Promise<CanvaAuthData | null> {
        const existingAccess = this.CANVA_ACCESS || (getContentProviderAccess("canva", scope) as CanvaAuthData | null)
        if (!existingAccess?.refresh_token) {
            return null
        }

        try {
            this.initializeOAuthHelper()
            const refreshed = await this.oauthHelper.refreshAccessToken(existingAccess.refresh_token, scope)
            if (refreshed) {
                this.CANVA_ACCESS = refreshed
                setContentProviderAccess("canva", scope, refreshed)
            }
            return refreshed
        } catch (error) {
            console.error("Failed to refresh Canva token:", error)
            return null
        }
    }

    private static async authenticate(scope: CanvaScopes): Promise<CanvaAuthData | null> {
        this.initializeOAuthHelper()

        const server = this.app.listen(this.CANVA_PORT, () => {
            console.info(`Listening for Canva OAuth response at port ${this.CANVA_PORT}`)
        })

        server.once("error", (err: Error) => {
            if ((err as any).code === "EADDRINUSE") server.close()
        })

        try {
            const authData = await this.oauthHelper.authorize(scope)
            if (!authData) return null

            setContentProviderAccess("canva", scope, authData)
            this.CANVA_ACCESS = authData
            connectionInitialized(true)
            return authData
        } catch (error) {
            console.error("Canva authentication failed:", error)
            return null
        } finally {
            // DEBUG (the request is loaded twice)
            // server.close()
        }
    }

    public static handleAuthCallback(req: express.Request, res: express.Response): void {
        this.initializeOAuthHelper()
        this.oauthHelper.handleCallback(req, res)
    }
}

function connectionInitialized(isFirstConnection: boolean = false): void {
    sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "canva", success: true, isFirstConnection })
}
