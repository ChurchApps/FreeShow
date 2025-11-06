import { createHash, randomFillSync } from "crypto"
import type express from "express"
import { openURL } from "../../IPC/responsesMain"
import { httpsRequest } from "../../utils/requests"
import type { BaseAuthData } from "./ContentProvider"
import { ContentProviderError, ContentProviderErrorType } from "./types"

/**
 * OAuth2 configuration for different providers
 */
interface OAuth2Config {
    clientId: string
    clientSecret: string
    authUrl: string
    tokenUrl: string
    redirectUri: string
    scopes: string[]
    usePKCE?: boolean
    additionalParams?: Record<string, string>
}

/**
 * PKCE (Proof Key for Code Exchange) helper methods
 */
export class PKCEHelper {
    static generateCodeVerifier(): string {
        const buffer = Buffer.alloc(32)
        randomFillSync(buffer)
        return buffer.toString('base64url')
    }

    static generateCodeChallenge(verifier: string): string {
        const hash = createHash('sha256')
        hash.update(verifier)
        return hash.digest().toString('base64url')
    }
}

/**
 * OAuth2 authentication helper that handles common OAuth2 flows
 */
export class OAuth2Helper<TAuthData extends BaseAuthData = BaseAuthData> {
    private config: OAuth2Config
    private codeVerifier?: string
    private resolveAuth?: (value: TAuthData | null) => void
    private rejectAuth?: (reason: any) => void

    constructor(config: OAuth2Config) {
        this.config = config
    }

    /**
     * Starts the OAuth2 authorization flow
     */
    async authorize(scope: string): Promise<TAuthData | null> {
        return new Promise((resolve, reject) => {
            this.resolveAuth = resolve
            this.rejectAuth = reject

            const authUrl = this.buildAuthUrl(scope)

            // Open the authorization URL in the user's browser
            openURL(authUrl)
        })
    }

    /**
     * Handles the OAuth2 callback from the authorization server
     */
    async handleCallback(req: express.Request, res: express.Response): Promise<void> {
        try {
            const { code, error, error_description } = req.query

            if (error) {
                const errorMsg = error_description || error
                res.send(this.getErrorHtml(errorMsg as string))
                this.rejectAuth?.(new ContentProviderError(
                    ContentProviderErrorType.AUTHENTICATION_FAILED,
                    `Authorization failed: ${errorMsg}`
                ))
                return
            }

            if (!code) {
                res.send(this.getErrorHtml("No authorization code received"))
                this.rejectAuth?.(new ContentProviderError(
                    ContentProviderErrorType.AUTHENTICATION_FAILED,
                    "No authorization code received"
                ))
                return
            }

            // Exchange code for tokens
            const tokens = await this.exchangeCodeForTokens(code as string)

            res.send(this.getSuccessHtml())
            this.resolveAuth?.(tokens)

        } catch (error) {
            console.error("OAuth callback error:", error)
            res.send(this.getErrorHtml("Authentication failed"))
            this.rejectAuth?.(error)
        }
    }

    /**
     * Refreshes an access token using the refresh token
     */
    async refreshAccessToken(refreshToken: string, scope: string): Promise<TAuthData | null> {
        return new Promise((resolve, reject) => {
            const params = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                scope
            })

            const url = new URL(this.config.tokenUrl)
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
            const content = Object.fromEntries(params.entries())

            httpsRequest(url.hostname, url.pathname, "POST", headers, content, (err, result) => {
                if (err) {
                    reject(new ContentProviderError(
                        ContentProviderErrorType.TOKEN_EXPIRED,
                        `Token refresh failed: ${err.message}`
                    ))
                    return
                }

                try {
                    const data = result
                    resolve({
                        access_token: data.access_token,
                        refresh_token: data.refresh_token || refreshToken,
                        token_type: data.token_type || "Bearer",
                        created_at: Math.floor(Date.now() / 1000),
                        expires_in: data.expires_in,
                        scope
                    } as TAuthData)
                } catch (error) {
                    reject(new ContentProviderError(
                        ContentProviderErrorType.NETWORK_ERROR,
                        `Token refresh failed: ${error.message}`
                    ))
                }
            })
        })
    }

    /**
     * Builds the authorization URL
     */
    private buildAuthUrl(scope: string): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            scope,
            ...this.config.additionalParams
        })

        if (this.config.usePKCE) {
            this.codeVerifier = PKCEHelper.generateCodeVerifier()
            const codeChallenge = PKCEHelper.generateCodeChallenge(this.codeVerifier)
            params.append('code_challenge', codeChallenge)
            params.append('code_challenge_method', 'S256')
        }

        return `${this.config.authUrl}?${params.toString()}`
    }

    /**
     * Exchanges authorization code for access tokens
     */
    private async exchangeCodeForTokens(code: string): Promise<TAuthData> {
        return new Promise((resolve, reject) => {
            const params = new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.config.redirectUri,
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret
            })

            if (this.config.usePKCE && this.codeVerifier) {
                params.append('code_verifier', this.codeVerifier)
            }

            const url = new URL(this.config.tokenUrl)
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
            const content = Object.fromEntries(params.entries())

            httpsRequest(url.hostname, url.pathname, "POST", headers, content, (err, result) => {
                if (err) {
                    reject(new ContentProviderError(
                        ContentProviderErrorType.AUTHENTICATION_FAILED,
                        `Token exchange failed: ${err.message}`
                    ))
                    return
                }

                try {
                    const data = result
                    resolve({
                        access_token: data.access_token,
                        refresh_token: data.refresh_token,
                        token_type: data.token_type || "Bearer",
                        created_at: Math.floor(Date.now() / 1000),
                        expires_in: data.expires_in,
                        scope: data.scope
                    } as TAuthData)
                } catch (error) {
                    reject(new ContentProviderError(
                        ContentProviderErrorType.AUTHENTICATION_FAILED,
                        `Token exchange failed: ${error.message}`
                    ))
                }
            })
        })
    }

    private getSuccessHtml(): string {
        return `
        <head>
            <title>Success!</title>
        </head>
        <body style="padding: 80px;background: #242832;color: #f0f0ff;font-family: system-ui;font-size: 1.2em;">
            <h1 style="color: #f0008c;">Success!</h1>
            <p>You can close this page</p>
        </body>`
    }

    private getErrorHtml(error: string): string {
        return `
        <head>
            <title>Error!</title>
        </head>
        <body style="padding: 80px;background: #242832;color: #f0f0ff;font-family: system-ui;font-size: 1.2em;">
            <h1>Could not complete authentication!</h1>
            <p>${error}</p>
        </body>`
    }
}