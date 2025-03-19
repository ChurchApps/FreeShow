import express from "express"
import { toApp } from ".."
import { MAIN } from "../../types/Channels"
import { ToMain } from "../../types/IPC/ToMain"
import { stores } from "../data/store"
import { sendMain } from "../IPC/main"
import { openURL } from "../IPC/responsesMain"
import { getKey } from "../utils/keys"
import { httpsRequest } from "../utils/requests"
import { pcoLoadServices } from "./request"

const app = express()
const PCO_PORT = 5501

export const PCO_API_URL = "https://api.planningcenteronline.com"
const clientId = getKey("pco_id")
const clientSecret = getKey("pco_secret")

export type PCOScopes = "calendar" | "check_ins" | "giving" | "groups" | "people" | "publishing" | "services"
type PCOAuthData = {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: PCOScopes
} | null

export const DEFAULT_PCO_DATA: PCOAuthData = {
    access_token: "",
    refresh_token: "",
    token_type: "Bearer",
    created_at: 0,
    expires_in: 0,
    scope: "services",
}

const HTML_success = `
    <head>
        <title>Success!</title>
    </head>
    <body style="padding: 80px;background: #292c36;color: #f0f0ff;font-family: system-ui;font-size: 1.2em;">
        <h1 style="color: #f0008c;">Success!</h1>
        <p>You can close this page</p>
    </body>
`
const HTML_error = `
    <head>
        <title>Error!</title>
    </head>
    <body style="padding: 80px;background: #292c36;color: #f0f0ff;font-family: system-ui;font-size: 1.2em;">
        <h1>Could not complete authentication!</h1>
        <p>{error_msg}</p>
    </body>
`

let PCO_ACCESS: PCOAuthData = null
export async function pcoConnect(scope: PCOScopes): Promise<PCOAuthData> {
    let storedAccess = PCO_ACCESS || stores.ACCESS.get(`pco_${scope}`)
    if (storedAccess?.created_at) {
        if (hasExpired(storedAccess)) {
            PCO_ACCESS = await refreshToken(storedAccess)
            return PCO_ACCESS
        }

        toApp(MAIN, { channel: "PCO_CONNECT", data: { success: true } })
        if (!PCO_ACCESS) PCO_ACCESS = storedAccess
        return storedAccess
    }

    PCO_ACCESS = await pcoAuthenticate(scope)
    return PCO_ACCESS
}

function pcoAuthenticate(scope: PCOScopes): Promise<PCOAuthData> {
    const path = "/auth/complete"
    const redirect_uri = `http://localhost:${PCO_PORT}${path}`

    let server = app.listen(PCO_PORT, () => {
        console.log(`Listening for Planning Center OAuth response at port ${PCO_PORT}`)
    })

    server.once("error", (err: any) => {
        if (err.code === "EADDRINUSE") server.close()
    })

    app.use(express.json())

    return new Promise((resolve) => {
        app.get(path, async (req, res) => {
            let code = req.query.code?.toString() || ""
            if (!code) return resolve(null)

            console.log("OAuth code received!")

            const params = { grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri }
            httpsRequest(PCO_API_URL, "/oauth/token", "POST", {}, params, (err: any, data: PCOAuthData) => {
                if (err) {
                    res.setHeader("Content-Type", "text/html")
                    const errorPage = HTML_error.replace("{error_msg}", err.message)
                    res.send(errorPage)

                    sendMain(ToMain.ALERT, "Could not authorize! " + err.message)
                    return resolve(null)
                }

                // AUTHORIZED
                console.log("OAuth completed!")

                res.setHeader("Content-Type", "text/html")
                res.send(HTML_success)

                // close when request is completed!
                server.close()

                stores.ACCESS.set(`pco_${scope}`, data)
                toApp(MAIN, { channel: "PCO_CONNECT", data: { success: true, isFirstConnection: true } })
                resolve(data)
            })
        })

        const URL = `${PCO_API_URL}/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect_uri}&response_type=code&scope=${scope}`
        openURL(URL)
    })
}

function hasExpired(access: PCOAuthData) {
    if (access === null) return true
    return (access.created_at + access.expires_in) * 1000 < Date.now()
}

function refreshToken(access: PCOAuthData): Promise<PCOAuthData> {
    return new Promise((resolve) => {
        if (!access?.refresh_token) return resolve(null)
        console.log("Refreshing PCO OAuth token")

        const params = { grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: access.refresh_token }
        httpsRequest(PCO_API_URL, "/oauth/token", "POST", {}, params, (err: any, data: PCOAuthData) => {
            if (err || data === null) {
                sendMain(ToMain.ALERT, "Could not refresh token! " + err?.message)
                resolve(null)
                return
            }

            stores.ACCESS.set(`pco_${data.scope}`, data)
            toApp(MAIN, { channel: "PCO_CONNECT", data: { success: true } })
            resolve(data)
        })
    })
}

export function pcoDisconnect(scope: PCOScopes = "services") {
    stores.ACCESS.set(`pco_${scope}`, null)
    PCO_ACCESS = null
    return { success: true }
}

export function pcoStartupLoad(dataPath: string, scope: PCOScopes = "services") {
    if (!stores.ACCESS.get(`pco_${scope}`)) return
    pcoLoadServices(dataPath)
}
