import express from "express"
import { ToMain } from "../../../types/IPC/ToMain"
import { getContentProviderAccess, setContentProviderAccess } from "../../data/contentProviders"
import { sendToMain } from "../../IPC/main"
import { getKey } from "../../utils/keys"
import { OAuth2Helper } from "../base/OAuth2Helper"
import { CanvaAuthData, CanvaScopes } from "./CanvaProvider"

const CANVA_OAUTH_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize"
const CANVA_OAUTH_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token"
export const OAUTH_PORT = 5520
const AUTH_REDIRECT_URL = "https://freeshow.app/auth_redirect"

export class CanvaConnect {
    private static CANVA_ACCESS: CanvaAuthData | null = null
    private static oauthHelper: OAuth2Helper<CanvaAuthData>
    private static oauthServer: any = null

    private static initializeOAuthHelper(): void {
        if (!this.oauthHelper) {
            this.oauthHelper = new OAuth2Helper<CanvaAuthData>({
                clientId: getKey("canva_id"),
                clientSecret: getKey("canva_secret"),
                authUrl: CANVA_OAUTH_AUTHORIZE_URL,
                tokenUrl: CANVA_OAUTH_TOKEN_URL,
                redirectUri: AUTH_REDIRECT_URL,
                scopes: ["folder:read", "design:meta:read"],
                usePKCE: true,
                additionalParams: { state: "freeshow_canva" }
            })
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

        const app = express()
        const authCompleted = new Promise<CanvaAuthData>((resolve, reject) => {
            app.get("/auth_redirect", async (req, res) => {
                const code = req.query.code as string
                const error = req.query.error as string
                const error_description = req.query.error_description as string

                if (error) {
                    res.send(this.oauthHelper.getErrorHtml(`${error_description || error}`))
                    reject(new Error(`OAuth error: ${error_description || error}`))
                    return
                }

                if (!code) {
                    res.send(this.oauthHelper.getErrorHtml("No authorization code received"))
                    reject(new Error("No authorization code received"))
                    return
                }

                try {
                    const tokens = await this.oauthHelper.exchangeCodeForTokens(code, scope)

                    res.send(this.oauthHelper.getSuccessHtml())
                    resolve(tokens)
                } catch (exchangeError) {
                    res.send(this.oauthHelper.getErrorHtml(`Token exchange failed: ${exchangeError}`))
                    reject(new Error(`Token exchange failed: ${exchangeError}`))
                }
            })

            this.oauthServer = app.listen(OAUTH_PORT, "127.0.0.1", () => {
                console.info(`Canva OAuth server listening on http://127.0.0.1:${OAUTH_PORT}`)
            })

            this.oauthServer.once("error", (err: Error) => {
                console.error("OAuth server error:", err)
                if ((err as any).code === "EADDRINUSE") {
                    reject(new Error(`Port ${OAUTH_PORT} is already in use`))
                } else {
                    reject(err)
                }
            })

            // Set a timeout in case user doesn't complete OAuth
            setTimeout(
                () => {
                    this.oauthServer?.close()
                    this.oauthServer = null
                    reject(new Error("OAuth authentication timeout"))
                },
                10 * 60 * 1000
            ) // 10 minute timeout
        })

        try {
            // Open authorization URL
            this.oauthHelper.authorize(scope)

            // Wait for callback to complete
            const authData = await authCompleted
            if (!authData) return null

            setContentProviderAccess("canva", scope, authData)
            this.CANVA_ACCESS = authData
            connectionInitialized(true)
            return authData
        } catch (error) {
            console.error("Canva authentication failed:", error)
            return null
        } finally {
            // Close the OAuth server
            this.oauthServer?.close()
            this.oauthServer = null
        }
    }
}

function connectionInitialized(isFirstConnection: boolean = false): void {
    sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "canva", success: true, isFirstConnection })
}
