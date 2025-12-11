import express from "express"
import { ToMain } from "../../../types/IPC/ToMain"
import { getContentProviderAccess, setContentProviderAccess } from "../../data/contentProviders"
import { sendToMain } from "../../IPC/main"
import { openURL } from "../../IPC/responsesMain"
import { getKey } from "../../utils/keys"
import { httpsRequest } from "../../utils/requests"
import type { ChurchAppsAuthData, ChurchAppsRequestData, ChurchAppsScopes } from "./types"
import { CHURCHAPPS_API_URL, CHURCHAPPS_APP_URL } from "./types"

/**
 * Handles authentication and API communication with the ChurchApps service.
 * Manages OAuth flow, token refresh, and provides methods for making authenticated API requests.
 *
 * WARNING: This class should ONLY be accessed through ChurchAppsProvider.
 * Do not import or use this class directly in other parts of the application.
 * Use ContentProviderRegistry or ChurchAppsProvider instead.
 */
export class ChurchAppsConnect {
    private static app = express()
    private static readonly CHURCHAPPS_PORT = 5502
    private static CHURCHAPPS_ACCESS: ChurchAppsAuthData = null
    private static readonly clientId: string = getKey("churchApps_id")
    private static readonly clientSecret: string = getKey("churchApps_secret")

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

    public static async connect(scope: ChurchAppsScopes): Promise<ChurchAppsAuthData> {
        const storedAccess: any = this.CHURCHAPPS_ACCESS || getContentProviderAccess("churchApps", scope)

        if (storedAccess?.created_at) {
            if (this.hasExpired(storedAccess)) {
                this.CHURCHAPPS_ACCESS = await this.refreshToken(storedAccess)
                return this.CHURCHAPPS_ACCESS
            }

            sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "churchApps", success: true })
            if (!this.CHURCHAPPS_ACCESS) this.CHURCHAPPS_ACCESS = storedAccess
            return storedAccess
        }

        this.CHURCHAPPS_ACCESS = await this.authenticate(scope)
        return this.CHURCHAPPS_ACCESS
    }

    public static disconnect(scope: ChurchAppsScopes = "plans"): { success: boolean } {
        setContentProviderAccess("churchApps", scope, null)
        this.CHURCHAPPS_ACCESS = null
        return { success: true }
    }

    public static async apiRequest(data: ChurchAppsRequestData): Promise<any> {
        let CHURCHAPPS_ACCESS: any = {}
        if (data.authenticated) {
            CHURCHAPPS_ACCESS = await this.connect(data.scope)
            if (!CHURCHAPPS_ACCESS) {
                sendToMain(ToMain.ALERT, "Not authorized at ChurchApps (try logging out and in again)!")
                return null
            }
        }

        return new Promise((resolve) => {
            const apiUrl = CHURCHAPPS_API_URL
            const pathPrefix = data.api === "doing" ? "/doing" : "/content"
            const fullEndpoint = `${pathPrefix}${data.endpoint}`
            const headers = data.authenticated ? { Authorization: `Bearer ${CHURCHAPPS_ACCESS.access_token}` } : {}
            httpsRequest(apiUrl, fullEndpoint, data.method || "GET", headers, data.data || {}, (err, result) => {
                if (err) {
                    console.error("Could not get data", apiUrl, fullEndpoint)
                    sendToMain(ToMain.ALERT, "Could not get data! " + err.message + "\n" + apiUrl + fullEndpoint)
                    return resolve(null)
                } else resolve(result)
            })
        })
    }

    private static async authenticate(scope: ChurchAppsScopes): Promise<ChurchAppsAuthData> {
        const path = "/auth/complete"
        const redirect_uri = `http://localhost:${this.CHURCHAPPS_PORT}${path}`

        const server = this.app.listen(this.CHURCHAPPS_PORT, () => {
            console.info(`Listening for ChurchApps OAuth response at port ${this.CHURCHAPPS_PORT}`)
        })

        server.once("error", (err: Error) => {
            if ((err as any).code === "EADDRINUSE") server.close()
        })

        this.app.use(express.json())

        return new Promise((resolve) => {
            this.app.get(path, (req, res) => {
                const code = req.query.code?.toString() || ""
                if (!code) return resolve(null)

                console.info("OAuth code received!")

                const params = {
                    grant_type: "authorization_code",
                    code,
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    redirect_uri
                }

                httpsRequest(CHURCHAPPS_API_URL, "/membership/oauth/token", "POST", {}, params, (err, data: ChurchAppsAuthData) => {
                    if (err) {
                        res.setHeader("Content-Type", "text/html")
                        const errorPage = this.HTML_ERROR.replace("{error_msg}", err.message)
                        res.send(errorPage)

                        sendToMain(ToMain.ALERT, "Could not authorize! " + err.message)
                        return resolve(null)
                    }

                    console.info("OAuth completed!")

                    res.setHeader("Content-Type", "text/html")
                    res.send(this.HTML_SUCCESS)

                    server.close()

                    setContentProviderAccess("churchApps", scope, data)
                    sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "churchApps", success: true, isFirstConnection: true })
                    resolve(data)
                })
            })

            const URL = `${CHURCHAPPS_APP_URL}/login?returnUrl=` + encodeURIComponent(`/oauth?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${scope}`)
            openURL(URL)
        })
    }

    private static hasExpired(access: ChurchAppsAuthData): boolean {
        if (access === null) return true
        return (access.created_at + access.expires_in) * 1000 < Date.now()
    }

    private static refreshToken(access: ChurchAppsAuthData): Promise<ChurchAppsAuthData> {
        return new Promise((resolve) => {
            if (!access?.refresh_token) return resolve(null)
            console.info("Refreshing ChurchApps OAuth token")

            const params = {
                grant_type: "refresh_token",
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: access.refresh_token
            }

            httpsRequest(CHURCHAPPS_API_URL, "/membership/oauth/token", "POST", {}, params, (err, data: ChurchAppsAuthData) => {
                if (err || data === null) {
                    this.disconnect()
                    sendToMain(ToMain.ALERT, "Could not refresh token! " + String(err?.message))
                    resolve(null)
                    return
                }

                this.CHURCHAPPS_ACCESS = data
                setContentProviderAccess("churchApps", data.scope, data)
                sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "churchApps", success: true })
                resolve(data)
            })
        })
    }
}
