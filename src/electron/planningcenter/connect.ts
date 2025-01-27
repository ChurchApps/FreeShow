import express from "express"
import { toApp } from ".."
import { MAIN } from "../../types/Channels"
import { stores } from "../data/store"
import { httpsRequest } from "../utils/requests"
import { openURL } from "../utils/responses"
import { pcoLoadServices } from "./request"

const app = express()
const PCO_PORT = 5501

export const PCO_API_URL = "https://api.planningcenteronline.com"
const clientId = "4aa9d118669e415d68221da6e83bcd40b877879520afe118b48d5d431eb000fd"
const clientSecret = "" // need to get key here

export type PCOScopes = "calendar" | "check_ins" | "giving" | "groups" | "people" | "publishing" | "services"
type PCOAuthData = {
    access_token: string
    refresh_token: string
    token_type: "Bearer"
    created_at: number
    expires_in: number
    scope: PCOScopes
} | null

const HTML_success = `
    <h1>Success!</h1>
    <p>You can close this page</p>
`

let PCO_ACCESS: PCOAuthData = null
export async function pcoConnect(scope: PCOScopes): Promise<PCOAuthData> {
    let storedAccess = PCO_ACCESS || stores.ACCESS.get(`pco_${scope}`)
    if (storedAccess) {
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
            console.log(params)
            httpsRequest(PCO_API_URL, "/oauth/token", "POST", {}, params, (err: any, data: PCOAuthData) => {
                if (err) {
                    res.setHeader("Content-Type", "text/html")
                    res.send(`<h2>${err.message}</h2>`)

                    toApp(MAIN, { channel: "ALERT", data: err.message })
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
                toApp(MAIN, { channel: "ALERT", data: err ? err.message : "No data" })
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
    toApp(MAIN, { channel: "PCO_DISCONNECT", data: { success: true } })
}

export function pcoStartupLoad(dataPath: string, scope: PCOScopes = "services") {
    if (!stores.ACCESS.get(`pco_${scope}`)) return
    pcoLoadServices(dataPath)
}
