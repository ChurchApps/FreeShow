import express from "express"
import { ContentProvider } from "../base/ContentProvider"
import { getContentProviderAccess, setContentProviderAccess } from "../../data/contentProviders"
import { sendToMain } from "../../IPC/main"
import { ToMain } from "../../../types/IPC/ToMain"
import { getKey } from "../../utils/keys"
import { openURL } from "../../IPC/responsesMain"
import { httpsRequest } from "../../utils/requests"

// Re-export original types for compatibility
export type ChumsScopes = "plans"
export interface ChumsAuthData {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: ChumsScopes
}

const CHURCHAPPS_API_URL = "https://api.churchapps.org"
const CHUMS_APP_URL = "https://app.churchapps.org"

/**
 * Chums provider that handles authentication and API communication
 */
export class ChumsProvider extends ContentProvider<ChumsScopes, ChumsAuthData> {
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
            name: "chums",
            port: 5502,
            clientId: getKey("chums_id") || "",
            clientSecret: getKey("chums_secret") || "",
            apiUrl: CHURCHAPPS_API_URL,
            scopes: ["plans"] as const
        })
    }

    async connect(scope: ChumsScopes): Promise<ChumsAuthData | null> {
        const storedAccess: any = this.access || getContentProviderAccess("chums", scope)

        if (storedAccess?.created_at) {
            if (this.hasExpired(storedAccess)) {
                this.access = storedAccess // Store before refresh
                this.access = await this.refreshToken(scope)
                return this.access
            }

            sendToMain(ToMain.CHUMS_CONNECT, { success: true })
            if (!this.access) this.access = storedAccess
            return storedAccess
        }

        this.access = await this.authenticate(scope)
        return this.access
    }

    disconnect(scope: ChumsScopes = "plans"): void {
        setContentProviderAccess("chums", scope, null)
        this.access = null
        sendToMain(ToMain.CHUMS_CONNECT, { success: false })
    }

    async apiRequest(data: any): Promise<any> {
        let CHUMS_ACCESS: any = {}
        if (data.authenticated) {
            CHUMS_ACCESS = await this.connect(data.scope)
            if (!CHUMS_ACCESS) {
                sendToMain(ToMain.ALERT, "Not authorized at Chums (try logging out and in again)!")
                return null
            }
        }

        return new Promise((resolve) => {
            const apiUrl = CHURCHAPPS_API_URL
            const pathPrefix = data.api === "doing" ? "/doing" : "/content"
            const fullEndpoint = `${pathPrefix}${data.endpoint}`
            const headers = data.authenticated ? { Authorization: `Bearer ${CHUMS_ACCESS.access_token}` } : {}
            httpsRequest(apiUrl, fullEndpoint, data.method || "GET", headers, data.data || {}, (err, result) => {
                if (err) {
                    console.error("Could not get data", apiUrl, fullEndpoint)
                    sendToMain(ToMain.ALERT, "Could not get data! " + err.message + "\n" + apiUrl + fullEndpoint)
                    return resolve(null)
                } else resolve(result)
            })
        })
    }

    async loadServices(): Promise<void> {
        // Delegate to original implementation for now
        throw new Error("Use original chums implementation for now")
    }

    async startupLoad(_scope: ChumsScopes, _data?: any): Promise<void> {
        // Delegate to original implementation for now
        throw new Error("Use original chums implementation for now")
    }

    protected handleAuthCallback(req: any, res: any): void {
        const code = req.query.code?.toString() || ""
        if (!code) return

        console.info("OAuth code received!")

        const path = "/auth/complete"
        const redirect_uri = `http://localhost:${this.config.port}${path}`

        const params = {
            grant_type: "authorization_code",
            code,
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            redirect_uri,
        }

        httpsRequest(CHURCHAPPS_API_URL, "/membership/oauth/token", "POST", {}, params, (err, data: ChumsAuthData) => {
            if (err) {
                res.setHeader("Content-Type", "text/html")
                const errorPage = ChumsProvider.HTML_ERROR.replace("{error_msg}", err.message)
                res.send(errorPage)

                sendToMain(ToMain.ALERT, "Could not authorize! " + err.message)
                return
            }

            console.info("OAuth completed!")

            res.setHeader("Content-Type", "text/html")
            res.send(ChumsProvider.HTML_SUCCESS)

            setContentProviderAccess("chums", data.scope, data)
            sendToMain(ToMain.CHUMS_CONNECT, { success: true, isFirstConnection: true })
        })
    }

    protected async refreshToken(scope: ChumsScopes): Promise<ChumsAuthData | null> {
        return new Promise((resolve) => {
            const access = this.access
            if (!access?.refresh_token) return resolve(null)
            console.info("Refreshing Chums OAuth token")

            const params = {
                grant_type: "refresh_token",
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                refresh_token: access.refresh_token,
            }

            httpsRequest(CHURCHAPPS_API_URL, "/membership/oauth/token", "POST", {}, params, (err, data: ChumsAuthData) => {
                if (err || data === null) {
                    this.disconnect(scope)
                    sendToMain(ToMain.ALERT, "Could not refresh token! " + String(err?.message))
                    resolve(null)
                    return
                }

                this.access = data
                setContentProviderAccess("chums", data.scope, data)
                sendToMain(ToMain.CHUMS_CONNECT, { success: true })
                resolve(data)
            })
        })
    }

    protected async authenticate(scope: ChumsScopes): Promise<ChumsAuthData | null> {
        const path = "/auth/complete"
        const redirect_uri = `http://localhost:${this.config.port}${path}`

        const server = ChumsProvider.app.listen(this.config.port, () => {
            console.info(`Listening for Chums OAuth response at port ${this.config.port}`)
        })

        server.once("error", (err: Error) => {
            if ((err as any).code === "EADDRINUSE") server.close()
        })

        ChumsProvider.app.use(express.json())

        return new Promise((resolve) => {
            ChumsProvider.app.get(path, (req, res) => {
                this.handleAuthCallback(req, res)
                server.close()
                const code = req.query.code?.toString() || ""
                if (code) {
                    // Wait a bit for the callback to complete
                    setTimeout(() => {
                        const storedAccess = getContentProviderAccess("chums", scope)
                        resolve(storedAccess as ChumsAuthData)
                    }, 1000)
                } else {
                    resolve(null)
                }
            })

            const URL = `${CHUMS_APP_URL}/login?returnUrl=` + encodeURIComponent(`/oauth?client_id=${this.config.clientId}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${scope}`)
            openURL(URL)
        })
    }

    private hasExpired(access: ChumsAuthData): boolean {
        if (access === null) return true
        return (access.created_at + access.expires_in) * 1000 < Date.now()
    }
}