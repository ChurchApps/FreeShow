/**
 * WARNING: This file should ONLY be accessed through OnStageProvider.
 * Do not import or use functions from this file directly in other parts of the application.
 * Use ContentProviderRegistry or OnStageProvider instead.
 */

import { createHash, randomFillSync } from "crypto"
import express from "express"
import http from "http"

import { ToMain } from "../../../types/IPC/ToMain"
import { getContentProviderAccess, setContentProviderAccess } from "../../data/contentProviders"
import { sendToMain } from "../../IPC/main"
import { openURL } from "../../IPC/responsesMain"
import { httpsRequest } from "../../utils/requests"
import { OnStageProvider } from "./OnStageProvider"
import { onStageLoadServices } from "./request"

export type OnStageScopes = "presenter"
export const ONSTAGE_OAUTH_SCOPES = "events:read songs:read teams:switch"

export type OnStageAuthData = {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: OnStageScopes
    team_id?: string
    team_name?: string
} | null

// One token set per team, so switching to an authorized team needs no browser.
type OnStageAuthStore = {
    activeTeamId: string | null
    byTeam: { [teamId: string]: NonNullable<OnStageAuthData> }
}

const LEGACY_TEAM_KEY = "unknown"

function loadStore(scope: OnStageScopes): OnStageAuthStore {
    const stored = getContentProviderAccess("onstage", scope)
    if (!stored) return { activeTeamId: null, byTeam: {} }
    if (stored.byTeam) return stored as OnStageAuthStore
    // legacy single-token shape
    const teamId = stored.team_id || LEGACY_TEAM_KEY
    return { activeTeamId: teamId, byTeam: { [teamId]: stored } }
}

function saveTokens(scope: OnStageScopes, data: NonNullable<OnStageAuthData>): OnStageAuthStore {
    const store = loadStore(scope)
    const teamId = data.team_id || LEGACY_TEAM_KEY
    delete store.byTeam[LEGACY_TEAM_KEY]
    store.byTeam[teamId] = data
    store.activeTeamId = teamId
    setContentProviderAccess("onstage", scope, store)
    return store
}

function activeAccess(scope: OnStageScopes): OnStageAuthData {
    const store = loadStore(scope)
    return store.activeTeamId ? (store.byTeam[store.activeTeamId] ?? null) : null
}

export const ONSTAGE_API_URL = process.env.ONSTAGE_API_URL || "https://on-stage.app/api"

// httpsRequest is https-only and takes a bare hostname, so the base path and http (local dev) are handled here.
export function onStageApiRequest(path: string, method: "POST" | "GET", headers: object, content: object, callback: (err: Error | null, result?: any) => void) {
    const url = new URL(ONSTAGE_API_URL)
    const fullPath = url.pathname.replace(/\/$/, "") + path

    if (!ONSTAGE_API_URL.startsWith("http://")) {
        httpsRequest(url.hostname, fullPath, method, headers, content, callback)
        return
    }

    const dataString = Object.keys(content).length ? JSON.stringify(content) : ""
    const request = http.request(
        {
            hostname: url.hostname,
            port: url.port || 80,
            path: fullPath,
            method,
            headers: {
                ...(dataString.length ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(dataString) } : {}),
                ...headers
            }
        },
        (response) => {
            let data = ""
            response.on("data", (chunk) => (data += chunk))
            response.on("end", () => {
                if ((response.statusCode || 0) >= 400) return callback(new Error(`HTTP ${response.statusCode}: ${data}`))
                try {
                    callback(null, data ? JSON.parse(data) : null)
                } catch (err: any) {
                    callback(err)
                }
            })
        }
    )
    request.on("error", (err) => callback(err))
    if (dataString) request.write(dataString)
    request.end()
}

const ONSTAGE_PORT = 5503
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

let announcedThisRun = false
// Two concurrent flows would each open a tab with its own PKCE verifier, so all callers share one.
let pendingAuthentication: Promise<OnStageAuthData> | null = null
let pendingAuthUrl = ""
// An abandoned flow never hits the callback, so the pending promise is released after a timeout.
const AUTH_FLOW_TIMEOUT_MS = 10 * 60 * 1000

function onStageAuthenticate(scope: OnStageScopes, teamIdHint?: string): Promise<OnStageAuthData> {
    if (pendingAuthentication) {
        // re-open the same flow so a closed tab can be recovered
        if (pendingAuthUrl) openURL(pendingAuthUrl)
        return pendingAuthentication
    }
    pendingAuthentication = startAuthentication(scope, teamIdHint)
    pendingAuthentication.finally(() => {
        pendingAuthentication = null
        pendingAuthUrl = ""
    })
    return pendingAuthentication
}

function startAuthentication(scope: OnStageScopes, teamIdHint?: string): Promise<OnStageAuthData> {
    const path = "/auth/complete"
    const redirect_uri = `http://localhost:${ONSTAGE_PORT}${path}`

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)

    const app = express()
    app.use(express.json())

    return new Promise((resolve) => {
        let settled = false
        const finish = (result: OnStageAuthData) => {
            if (settled) return
            settled = true
            clearTimeout(abandonTimer)
            server.close()
            resolve(result)
        }

        const abandonTimer = setTimeout(() => finish(null), AUTH_FLOW_TIMEOUT_MS)

        const server = app.listen(ONSTAGE_PORT, () => {
            console.info(`Listening for OnStage OAuth response at port ${ONSTAGE_PORT}`)
        })

        server.once("error", (err: Error) => {
            if ((err as any).code === "EADDRINUSE") finish(null)
        })

        app.get(path, (req, res) => {
            const code = req.query.code?.toString() || ""
            if (!code) {
                return finish(null)
            }

            const params = {
                grant_type: "authorization_code",
                code,
                client_id: OnStageProvider.CLIENT_ID,
                redirect_uri,
                code_verifier: codeVerifier
            }

            onStageApiRequest("/oauth/token", "POST", {}, params, (err, data: OnStageAuthData) => {
                if (err) {
                    res.setHeader("Content-Type", "text/html")
                    res.send(HTML_error.replace("{error_msg}", err.message))

                    sendToMain(ToMain.ALERT, "Could not authorize! " + err.message)
                    return finish(null)
                }

                console.info("OnStage OAuth completed!")

                res.setHeader("Content-Type", "text/html")
                res.send(HTML_success)

                const storedData = { ...data, scope } as NonNullable<OnStageAuthData>
                saveTokens(scope, storedData)
                connectionInitialized(true)
                finish(storedData)
            })
        })

        const URL = `${ONSTAGE_API_URL}/oauth/authorize?client_id=${OnStageProvider.CLIENT_ID}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${encodeURIComponent(ONSTAGE_OAUTH_SCOPES)}&code_challenge=${codeChallenge}&code_challenge_method=S256${teamIdHint ? `&team_id=${encodeURIComponent(teamIdHint)}` : ""}`

        pendingAuthUrl = URL
        openURL(URL)
    })
}

function hasExpired(access: OnStageAuthData): boolean {
    if (!access?.created_at || !access?.expires_in) return true

    const expirationTime = (access.created_at + access.expires_in) * 1000
    return Date.now() >= expirationTime
}

function refreshToken(access: OnStageAuthData): Promise<OnStageAuthData> {
    return new Promise((resolve) => {
        if (!access?.refresh_token) {
            console.warn("No refresh token available, cannot refresh OnStage OAuth token")
            return resolve(null)
        }

        const params = { grant_type: "refresh_token", client_id: OnStageProvider.CLIENT_ID, refresh_token: access.refresh_token }

        onStageApiRequest("/oauth/token", "POST", {}, params, (err: any, data: OnStageAuthData) => {
            if (err || data === null) {
                // OnStage revokes the grant on refresh token reuse, so a failure needs a new authorization
                return resolve(handleRefreshFailure(access.scope))
            }

            const storedData = { ...data, scope: access.scope } as NonNullable<OnStageAuthData>
            saveTokens(access.scope, storedData)
            return resolve(storedData)
        })
    })
}

async function handleRefreshFailure(scope: OnStageScopes): Promise<OnStageAuthData> {
    try {
        return await onStageAuthenticate(scope)
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

export function onStageInitialize() {
    announcedThisRun = false
}

export async function onStageConnect(scope: OnStageScopes): Promise<OnStageAuthData> {
    let accessData = activeAccess(scope)

    if (hasExpired(accessData)) accessData = await refreshToken(accessData)
    if (!accessData) accessData = await onStageAuthenticate(scope)
    if (!accessData) return null

    if (!announcedThisRun) {
        connectionInitialized()
        announcedThisRun = true
    }

    return accessData
}

/** Instant for a cached team; otherwise the server mints tokens under the teams:switch scope. */
export async function onStageSwitchTeam(teamId: string, scope: OnStageScopes = "presenter"): Promise<{ success: boolean }> {
    const store = loadStore(scope)
    if (store.byTeam[teamId]) {
        store.activeTeamId = teamId
        setContentProviderAccess("onstage", scope, store)
        return { success: true }
    }

    const silent = await silentSwitch(teamId, scope)
    if (silent) return { success: true }

    const auth = await onStageAuthenticate(scope, teamId)
    return { success: !!auth }
}

function silentSwitch(teamId: string, scope: OnStageScopes): Promise<boolean> {
    return new Promise((resolve) => {
        onStageConnect(scope).then((access) => {
            if (!access) return resolve(false)
            onStageApiRequest("/integrations/v1/switch-team", "POST", { Authorization: `Bearer ${access.access_token}` }, { teamId }, (err, data: OnStageAuthData) => {
                if (err || !data?.access_token) return resolve(false)
                saveTokens(scope, { ...data, scope } as NonNullable<OnStageAuthData>)
                resolve(true)
            })
        })
    })
}

/** The team the active token is bound to. */
export function onStageActiveTeam(scope: OnStageScopes = "presenter"): { id: string; name: string } | null {
    const access = activeAccess(scope)
    return access?.team_id ? { id: access.team_id, name: access.team_name || "" } : null
}

export function onStageDisconnect(scope: OnStageScopes = "presenter") {
    // revoke server-side so the user does not have to clean up from OnStage
    const store = loadStore(scope)
    Object.values(store.byTeam).forEach((access) => {
        if (access?.refresh_token) onStageApiRequest("/oauth/revoke", "POST", {}, { token: access.refresh_token }, () => undefined)
    })
    setContentProviderAccess("onstage", scope, null)
    announcedThisRun = false
    return { success: true }
}

export async function onStageStartupLoad(scope: OnStageScopes = "presenter", providerData?: unknown) {
    if (!getContentProviderAccess("onstage", scope)) return
    await onStageLoadServices(providerData)
}

function connectionInitialized(isFirstConnection = false): void {
    sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "onstage", success: true, isFirstConnection })
}
