import express from "express"
import { randomFillSync, createHash } from "crypto"
import { ContentProvider } from "../base/ContentProvider"
import { getContentProviderAccess, setContentProviderAccess } from "../../data/contentProviders"
import { sendToMain } from "../../IPC/main"
import { ToMain } from "../../../types/IPC/ToMain"
import { getKey } from "../../utils/keys"
import { openURL } from "../../IPC/responsesMain"
import { httpsRequest } from "../../utils/requests"

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
 * Planning Center provider that handles authentication and API communication
 */
export class PlanningCenterProvider extends ContentProvider<PCOScopes, PCOAuthData> {
    private static app = express()
    private static readonly HTML_SUCCESS = `
    <head>
        <title>Success!</title>
    </head>
    <body style="padding: 80px;background: #242832;color: #f0f0ff;font-family: system-ui;font-size: 1.2em;">
        <h1 style="color: #f0008c;">Success!</h1>
        <p>You can close this page</p>
    </body>
`
    private static readonly HTML_ERROR = `
    <head>
        <title>Error!</title>
    </head>
    <body style="padding: 80px;background: #242832;color: #f0f0ff;font-family: system-ui;font-size: 1.2em;">
        <h1>Could not complete authentication!</h1>
        <p>{error_msg}</p>
    </body>
`

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
        const storedAccess = this.access || getContentProviderAccess("planningcenter", scope)

        if (storedAccess?.created_at) {
            if (this.hasExpired(storedAccess)) {
                this.access = storedAccess // Store before refresh
                this.access = await this.refreshToken(scope)
                return this.access
            }

            sendToMain(ToMain.PCO_CONNECT, { success: true })
            if (!this.access) this.access = storedAccess
            return storedAccess
        }

        this.access = await this.authenticate(scope)
        return this.access
    }

    disconnect(scope: PCOScopes = "services"): void {
        setContentProviderAccess("planningcenter", scope, null)
        this.access = null
        sendToMain(ToMain.PCO_CONNECT, { success: false })
    }

    async apiRequest(_data: any): Promise<any> {
        // Delegate to original implementation for now
        throw new Error("Use original planning center implementation for now")
    }

    async loadServices(dataPath?: string): Promise<void> {
        // Delegate to original implementation for now
        const { pcoLoadServices } = await import("./request")
        return pcoLoadServices(dataPath || "")
    }

    async startupLoad(scope: PCOScopes, data?: any): Promise<void> {
        if (!getContentProviderAccess("planningcenter", scope)) return
        await this.loadServices(data?.dataPath || "")
    }

    private codeVerifier: string = ""

    protected handleAuthCallback(req: any, res: any): void {
        const code = req.query.code?.toString() || ""
        if (!code) return

        console.info(`OAuth code received: ${code}`)

        const path = "/auth/complete"
        const redirect_uri = `http://localhost:${this.config.port}${path}`

        const params = {
            grant_type: "authorization_code",
            code,
            client_id: this.config.clientId,
            redirect_uri,
            code_verifier: this.codeVerifier
        }

        httpsRequest(this.config.apiUrl, "/oauth/token", "POST", {}, params, (err, data: PCOAuthData) => {
            if (err) {
                res.setHeader("Content-Type", "text/html")
                const errorPage = PlanningCenterProvider.HTML_ERROR.replace("{error_msg}", err.message)
                res.send(errorPage)

                sendToMain(ToMain.ALERT, "Could not authorize! " + err.message)
                return
            }

            console.info("OAuth completed!")

            res.setHeader("Content-Type", "text/html")
            res.send(PlanningCenterProvider.HTML_SUCCESS)

            setContentProviderAccess("planningcenter", data.scope, data)
            sendToMain(ToMain.PCO_CONNECT, { success: true, isFirstConnection: true })
        })
    }

    protected async refreshToken(scope: PCOScopes): Promise<PCOAuthData | null> {
        return new Promise((resolve) => {
            const access = this.access
            if (!access?.refresh_token) {
                console.warn("No refresh token available, cannot refresh PCO OAuth token")
                return resolve(null)
            }

            console.info("refreshToken: Refreshing PCO OAuth token")

            const params = { grant_type: "refresh_token", client_id: this.config.clientId, refresh_token: access.refresh_token }

            httpsRequest(this.config.apiUrl, "/oauth/token", "POST", {}, params, (err: any, data: PCOAuthData) => {
                if (err || data === null) {
                    // If refresh fails, fallback to full authentication flow
                    this.handleRefreshFailure(scope).then(resolve)
                    return
                }

                setContentProviderAccess("planningcenter", data.scope, data)
                sendToMain(ToMain.PCO_CONNECT, { success: true })

                resolve(data)
            })
        })
    }

    protected async authenticate(scope: PCOScopes): Promise<PCOAuthData | null> {
        const path = "/auth/complete"
        const redirect_uri = `http://localhost:${this.config.port}${path}`

        // Generate PKCE values
        this.codeVerifier = this.generateCodeVerifier()
        const codeChallenge = this.generateCodeChallenge(this.codeVerifier)

        const server = PlanningCenterProvider.app.listen(this.config.port, () => {
            console.info(`Listening for Planning Center OAuth response at port ${this.config.port}`)
        })

        server.once("error", (err: Error) => {
            if ((err as any).code === "EADDRINUSE") server.close()
        })

        PlanningCenterProvider.app.use(express.json())

        return new Promise((resolve) => {
            PlanningCenterProvider.app.get(path, (req, res) => {
                this.handleAuthCallback(req, res)
                server.close()
                const code = req.query.code?.toString() || ""
                if (code) {
                    // Wait a bit for the callback to complete
                    setTimeout(() => {
                        const storedAccess = getContentProviderAccess("planningcenter", scope)
                        resolve(storedAccess as PCOAuthData)
                    }, 1000)
                } else {
                    resolve(null)
                }
            })

            const URL = `${this.config.apiUrl}/oauth/authorize?client_id=${this.config.clientId}&redirect_uri=${redirect_uri}&response_type=code&scope=${scope}&code_challenge=${codeChallenge}&code_challenge_method=S256`

            openURL(URL)
        })
    }

    private async handleRefreshFailure(scope: PCOScopes): Promise<PCOAuthData | null> {
        try {
            const newData = await this.authenticate(scope)
            return newData
        } catch (authErr: any) {
            sendToMain(ToMain.ALERT, "Could not refresh token! " + String(authErr?.message))
            return null
        }
    }

    private generateCodeVerifier() {
        const array = new Uint8Array(32)
        randomFillSync(array)
        return Buffer.from(array).toString("base64url")
    }

    private generateCodeChallenge(verifier: string) {
        const hash = createHash("sha256").update(verifier).digest()
        return Buffer.from(hash).toString("base64url")
    }

    private hasExpired(access: PCOAuthData): boolean {
        if (access === null) return true

        const expirationTime = (access.created_at + access.expires_in) * 1000
        const currentTime = Date.now()

        return currentTime >= expirationTime
    }
}