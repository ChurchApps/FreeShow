/**
 * WARNING: This file should ONLY be accessed through PlanningCenterProvider.
 * Do not import or use functions from this file directly in other parts of the application.
 * Use ContentProviderRegistry or PlanningCenterProvider instead.
 */

import express from "express"
import { randomFillSync, createHash } from "crypto"

import { ToMain } from "../../../types/IPC/ToMain"
import { getContentProviderAccess, setContentProviderAccess } from "../../data/contentProviders"
import { sendToMain } from "../../IPC/main"
import { openURL } from "../../IPC/responsesMain"
import { getKey } from "../../utils/keys"
import { httpsRequest } from "../../utils/requests"
import { pcoLoadServices } from "./request"

export type PCOScopes = "calendar" | "check_ins" | "giving" | "groups" | "people" | "publishing" | "services"

type PCOAuthData = {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: PCOScopes
} | null

export const PCO_API_URL = "https://api.planningcenteronline.com"

export const DEFAULT_PCO_DATA: PCOAuthData = {
    access_token: "",
    refresh_token: "",
    token_type: "Bearer",
    created_at: 0,
    expires_in: 0,
    scope: "services",
}

const app = express()
const PCO_PORT = 5501
const clientId = getKey("pco_id")
const HTML_success = `
    <head>
        <title>Success!</title>
    </head>
    <body style="padding: 80px;background: #242832;color: #f0f0ff;font-family: system-ui;font-size: 1.2em;">
        <h1 style="color: #f0008c;">Success!</h1>
        <p>You can close this page</p>
    </body>
`
const HTML_error = `
    <head>
        <title>Error!</title>
    </head>
    <body style="padding: 80px;background: #242832;color: #f0f0ff;font-family: system-ui;font-size: 1.2em;">
        <h1>Could not complete authentication!</h1>
        <p>{error_msg}</p>
    </body>
`

let PCO_ACCESS: PCOAuthData = null

function pcoAuthenticate(scope: PCOScopes): Promise<PCOAuthData> {
    const path = "/auth/complete"
    const redirect_uri = `http://localhost:${PCO_PORT}${path}`

    // Generate PKCE values
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)

    const server = app.listen(PCO_PORT, () => {
        console.info(`Listening for Planning Center OAuth response at port ${PCO_PORT}`)
    })

    server.once("error", (err: Error) => {
        if ((err as any).code === "EADDRINUSE") server.close()
    })

    app.use(express.json())

    return new Promise((resolve) => {
        app.get(path, (req, res) => {
            const code = req.query.code?.toString() || ""
            console.info(`OAuth code received: ${code}`)
            if (!code) return resolve(null)

            const params = {
                grant_type: "authorization_code",
                code,
                client_id: clientId,
                redirect_uri,
                code_verifier: codeVerifier
            }

            httpsRequest(PCO_API_URL, "/oauth/token", "POST", {}, params, (err, data: PCOAuthData) => {
                if (err) {
                    res.setHeader("Content-Type", "text/html")
                    const errorPage = HTML_error.replace("{error_msg}", err.message)
                    res.send(errorPage)

                    sendToMain(ToMain.ALERT, "Could not authorize! " + err.message)
                    return resolve(null)
                }

                // AUTHORIZED
                console.info("OAuth completed!")

                res.setHeader("Content-Type", "text/html")
                res.send(HTML_success)

                // close when request is completed!
                server.close()

                setContentProviderAccess("planningcenter", scope, data)
                sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "planningcenter", success: true, isFirstConnection: true })
                resolve(data)
            })
        })

        const URL = `${PCO_API_URL}/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect_uri}&response_type=code&scope=${scope}&code_challenge=${codeChallenge}&code_challenge_method=S256`

        openURL(URL)
    })
}

function hasExpired(access: PCOAuthData): boolean {
    if (access === null) return true

    const expirationTime = (access.created_at + access.expires_in) * 1000
    const currentTime = Date.now()

    // TODO: consider whether we want to allow a small buffer for expiration (to avoid issues with a token expiring right at the moment of use)
    // e.g., 5 minutes before actual expiration

    return currentTime >= expirationTime
}

function refreshToken(access: PCOAuthData): Promise<PCOAuthData> {
    return new Promise((resolve) => {
        if (!access?.refresh_token) {
            console.warn("No refresh token available, cannot refresh PCO OAuth token")
            return resolve(null)
        }

        console.info("refreshToken: Refreshing PCO OAuth token")

        const params = { grant_type: "refresh_token", client_id: clientId, refresh_token: access.refresh_token }

        httpsRequest(PCO_API_URL, "/oauth/token", "POST", {}, params, (err: any, data: PCOAuthData) => {
            if (err || data === null) {
                // If refresh fails, fallback to full authentication flow
                return handleRefreshFailure(access.scope)
            }

            setContentProviderAccess("planningcenter", data.scope, data)
            sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "planningcenter", success: true })

            return resolve(data)
        })
    })
}

async function handleRefreshFailure(scope: PCOScopes): Promise<PCOAuthData> {
    try {
        const newData = await pcoAuthenticate(scope)
        return newData
    } catch (authErr: any) {
        sendToMain(ToMain.ALERT, "Could not refresh token! " + String(authErr?.message))
        return null
    }
}

function generateCodeVerifier() {
    const array = new Uint8Array(32)
    randomFillSync(array)
    return Buffer.from(array).toString("base64url")
}

function generateCodeChallenge(verifier: string) {
    const hash = createHash("sha256").update(verifier).digest()
    return Buffer.from(hash).toString("base64url")
}

export async function pcoConnect(scope: PCOScopes): Promise<PCOAuthData> {
    const storedAccess = PCO_ACCESS || getContentProviderAccess("planningcenter", scope)

    if (storedAccess?.created_at) {
        if (hasExpired(storedAccess)) {
            PCO_ACCESS = await refreshToken(storedAccess)
            return PCO_ACCESS
        }

        sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "planningcenter", success: true })
        if (!PCO_ACCESS) PCO_ACCESS = storedAccess
        return storedAccess
    }

    PCO_ACCESS = await pcoAuthenticate(scope)

    return PCO_ACCESS
}

export function pcoDisconnect(scope: PCOScopes = "services") {
    setContentProviderAccess("planningcenter", scope, null)
    PCO_ACCESS = null
    return { success: true }
}

export async function pcoStartupLoad(scope: PCOScopes = "services") {
    if (!getContentProviderAccess("planningcenter", scope)) return
    await pcoLoadServices()
}
