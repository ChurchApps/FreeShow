import express from "express"
import { ToMain } from "../../types/IPC/ToMain"
import { getContentProviderAccess, setContentProviderAccess } from "../data/contentProviders"
import { sendToMain } from "../IPC/main"
import { openURL } from "../IPC/responsesMain"
import { getKey } from "../utils/keys"
import { httpsRequest } from "../utils/requests"
import type { ChumsAuthData, ChumsRequestData, ChumsScopes } from "./types"
import { CHURCHAPPS_API_URL, CHUMS_APP_URL } from "./types"

/**
 * Handles authentication and API communication with the Chums service.
 * Manages OAuth flow, token refresh, and provides methods for making authenticated API requests.
 */
export class ChumsConnect {
    private static app = express()
    private static readonly CHUMS_PORT = 5502
    private static CHUMS_ACCESS: ChumsAuthData = null
    private static readonly clientId: string = getKey("chums_id")
    private static readonly clientSecret: string = getKey("chums_secret")

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

    public static async connect(scope: ChumsScopes): Promise<ChumsAuthData> {
        const storedAccess: any = this.CHUMS_ACCESS || getContentProviderAccess("chums", scope)

        if (storedAccess?.created_at) {
            if (this.hasExpired(storedAccess)) {
                this.CHUMS_ACCESS = await this.refreshToken(storedAccess)
                return this.CHUMS_ACCESS
            }

            sendToMain(ToMain.CHUMS_CONNECT, { success: true })
            if (!this.CHUMS_ACCESS) this.CHUMS_ACCESS = storedAccess
            return storedAccess
        }

        this.CHUMS_ACCESS = await this.authenticate(scope)
        return this.CHUMS_ACCESS
    }

    public static disconnect(scope: ChumsScopes = "plans"): { success: boolean } {
        setContentProviderAccess("chums", scope, null)
        this.CHUMS_ACCESS = null
        return { success: true }
    }

    public static async apiRequest(data: ChumsRequestData): Promise<any> {
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

    private static async authenticate(scope: ChumsScopes): Promise<ChumsAuthData> {
        const path = "/auth/complete"
        const redirect_uri = `http://localhost:${this.CHUMS_PORT}${path}`

        const server = this.app.listen(this.CHUMS_PORT, () => {
            console.info(`Listening for Chums OAuth response at port ${this.CHUMS_PORT}`)
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
                    redirect_uri,
                }

                httpsRequest(CHURCHAPPS_API_URL, "/membership/oauth/token", "POST", {}, params, (err, data: ChumsAuthData) => {
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

                    setContentProviderAccess("chums", scope, data)
                    sendToMain(ToMain.CHUMS_CONNECT, { success: true, isFirstConnection: true })
                    resolve(data)
                })
            })

            const URL = `${CHUMS_APP_URL}/login?returnUrl=` + encodeURIComponent(`/oauth?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${scope}`)
            openURL(URL)
        })
    }

    private static hasExpired(access: ChumsAuthData): boolean {
        if (access === null) return true
        return (access.created_at + access.expires_in) * 1000 < Date.now()
    }

    private static refreshToken(access: ChumsAuthData): Promise<ChumsAuthData> {
        return new Promise((resolve) => {
            if (!access?.refresh_token) return resolve(null)
            console.info("Refreshing Chums OAuth token")

            const params = {
                grant_type: "refresh_token",
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: access.refresh_token,
            }

            httpsRequest(CHURCHAPPS_API_URL, "/membership/oauth/token", "POST", {}, params, (err, data: ChumsAuthData) => {
                if (err || data === null) {
                    this.disconnect()
                    sendToMain(ToMain.ALERT, "Could not refresh token! " + String(err?.message))
                    resolve(null)
                    return
                }

                this.CHUMS_ACCESS = data
                setContentProviderAccess("chums", data.scope, data)
                sendToMain(ToMain.CHUMS_CONNECT, { success: true })
                resolve(data)
            })
        })
    }
}
