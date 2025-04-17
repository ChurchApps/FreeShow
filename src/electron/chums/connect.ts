import express from "express"
import { ToMain } from "../../types/IPC/ToMain"
import { stores } from "../data/store"
import { sendToMain } from "../IPC/main"
import { openURL } from "../IPC/responsesMain"
import { getKey } from "../utils/keys"
import { httpsRequest } from "../utils/requests"
import { chumsLoadServices } from "./request"

const app = express()
const CHUMS_PORT = 5502

export const MEMBERSHIP_API_URL = "https://membershipapi.staging.churchapps.org"
export const DOING_API_URL = "https://doingapi.staging.churchapps.org"
export const CHUMS_API_URL = "http://localhost:3101"
const clientId = getKey("chums_id")
const clientSecret = getKey("chums_secret")

export type ChumsScopes = "plans"
type ChumsAuthData = {
  access_token: string
  refresh_token: string
  token_type: "Bearer"
  created_at: number
  expires_in: number
  scope: ChumsScopes
} | null

export const DEFAULT_CHUMS_DATA: ChumsAuthData = {
  access_token: "",
  refresh_token: "",
  token_type: "Bearer",
  created_at: 0,
  expires_in: 0,
  scope: "plans",
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

let CHUMS_ACCESS: ChumsAuthData = null
export async function chumsConnect(scope: ChumsScopes): Promise<ChumsAuthData> {
  let storedAccess = CHUMS_ACCESS || stores.ACCESS.get(`chums_${scope}`)
  if (storedAccess?.created_at) {
    if (hasExpired(storedAccess)) {
      CHUMS_ACCESS = await refreshToken(storedAccess)
      return CHUMS_ACCESS
    }

    sendToMain(ToMain.CHUMS_CONNECT, { success: true })
    if (!CHUMS_ACCESS) CHUMS_ACCESS = storedAccess
    return storedAccess
  }

  CHUMS_ACCESS = await chumsAuthenticate(scope)
  return CHUMS_ACCESS
}

function chumsAuthenticate(scope: ChumsScopes): Promise<ChumsAuthData> {
  const path = "/auth/complete"
  const redirect_uri = `http://localhost:${CHUMS_PORT}${path}`

  let server = app.listen(CHUMS_PORT, () => {
    console.log(`Listening for Chums OAuth response at port ${CHUMS_PORT}`)
  })

  server.once("error", (err: Error) => {
    if ((err as any).code === "EADDRINUSE") server.close()
  })

  app.use(express.json())

  return new Promise((resolve) => {
    app.get(path, async (req, res) => {
      let code = req.query.code?.toString() || ""
      if (!code) return resolve(null)

      console.log("OAuth code received!")

      const params = { grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri }

      console.log("URL", MEMBERSHIP_API_URL + "/oauth/token", params)

      httpsRequest(MEMBERSHIP_API_URL, "/oauth/token", "POST", {}, params, (err, data: ChumsAuthData) => {
        if (err) {
          res.setHeader("Content-Type", "text/html")
          const errorPage = HTML_error.replace("{error_msg}", err.message)
          res.send(errorPage)

          sendToMain(ToMain.ALERT, "Could not authorize! " + err.message)
          return resolve(null)
        }

        // AUTHORIZED
        console.log("OAuth completed!")

        res.setHeader("Content-Type", "text/html")
        res.send(HTML_success)

        // close when request is completed!
        server.close()

        stores.ACCESS.set(`chums_${scope}`, data)
        sendToMain(ToMain.CHUMS_CONNECT, { success: true, isFirstConnection: true })
        resolve(data)
      })
    })

    const URL = `${CHUMS_API_URL}/login?returnUrl=` + encodeURIComponent(`/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${scope}`)
    openURL(URL)
  })
}

function hasExpired(access: ChumsAuthData) {
  if (access === null) return true
  return (access.created_at + access.expires_in) * 1000 < Date.now()
}

function refreshToken(access: ChumsAuthData): Promise<ChumsAuthData> {
  return new Promise((resolve) => {
    if (!access?.refresh_token) return resolve(null)
    console.log("Refreshing Chums OAuth token")

    const params = { grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: access.refresh_token }
    httpsRequest(MEMBERSHIP_API_URL, "/oauth/token", "POST", {}, params, (err, data: ChumsAuthData) => {
      if (err || data === null) {
        sendToMain(ToMain.ALERT, "Could not refresh token! " + err?.message)
        resolve(null)
        return
      }

      stores.ACCESS.set(`chums_${data.scope}`, data)
      sendToMain(ToMain.CHUMS_CONNECT, { success: true })
      resolve(data)
    })
  })
}

export function chumsDisconnect(scope: ChumsScopes = "plans") {
  stores.ACCESS.set(`chums_${scope}`, null)
  CHUMS_ACCESS = null
  return { success: true }
}

export function chumsStartupLoad(dataPath: string, scope: ChumsScopes = "plans") {
  if (!stores.ACCESS.get(`chums_${scope}`)) return
  chumsLoadServices(dataPath)
}
