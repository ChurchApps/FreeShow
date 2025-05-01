import express from "express"
import { ToMain } from "../../types/IPC/ToMain"
import { stores } from "../data/store"
import { sendToMain } from "../IPC/main"
import { openURL } from "../IPC/responsesMain"
import { getKey } from "../utils/keys"
import { httpsRequest } from "../utils/requests"
import { apiRequest, chumsLoadServices } from "./request"
import { getDocumentsFolder, parseShow, readFile } from "../utils/files"
//import { Show } from "../../types/Show"
import path from "path"

const app = express()
const CHUMS_PORT = 5502

//Prod
/*
export const MEMBERSHIP_API_URL = "https://membershipapi.churchapps.org"
export const DOING_API_URL = "https://doingapi.churchapps.org"
export const CONTENT_API_URL = "https://contentapi.churchapps.org"
export const CHUMS_API_URL = "https://app.chums.org"
*/

//Dev
export const MEMBERSHIP_API_URL = "https://membershipapi.staging.churchapps.org"
export const DOING_API_URL = "https://doingapi.staging.churchapps.org"
export const CONTENT_API_URL = "https://contentapi.staging.churchapps.org"
export const CHUMS_API_URL = "https://app.staging.chums.org"

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
  const storedAccess: any = CHUMS_ACCESS || stores.ACCESS.get(`chums_${scope}`)
  // console.log("Stored access", storedAccess)
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

  const server = app.listen(CHUMS_PORT, () => {
    console.info(`Listening for Chums OAuth response at port ${CHUMS_PORT}`)
  })

  server.once("error", (err: Error) => {
    if ((err as any).code === "EADDRINUSE") server.close()
  })

  app.use(express.json())

  return new Promise((resolve) => {
    app.get(path, (req, res) => {
      const code = req.query.code?.toString() || ""
      if (!code) return resolve(null)

      console.info("OAuth code received!")

      const params = { grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri }

      console.info("URL", MEMBERSHIP_API_URL + "/oauth/token", params)

      httpsRequest(MEMBERSHIP_API_URL, "/oauth/token", "POST", {}, params, (err, data: ChumsAuthData) => {
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

        stores.ACCESS.set(`chums_${scope}`, data)
        sendToMain(ToMain.CHUMS_CONNECT, { success: true, isFirstConnection: true })
        sendSongsToChums();
        resolve(data)
      })
    })

    const URL = `${CHUMS_API_URL}/login?returnUrl=` + encodeURIComponent(`/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${scope}`)
    openURL(URL)
  })
}

function hasExpired(access: ChumsAuthData) {
  if (access === null) return true
  console.info((access.created_at + access.expires_in) * 1000, Date.now(), (access.created_at + access.expires_in) * 1000 < Date.now())
  return (access.created_at + access.expires_in) * 1000 < Date.now()
}

function refreshToken(access: ChumsAuthData): Promise<ChumsAuthData> {
  return new Promise((resolve) => {
    if (!access?.refresh_token) return resolve(null)
    console.info("Refreshing Chums OAuth token")

    const params = { grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: access.refresh_token }
    httpsRequest(MEMBERSHIP_API_URL, "/oauth/token", "POST", {}, params, (err, data: ChumsAuthData) => {
      if (err || data === null) {
        sendToMain(ToMain.ALERT, "Could not refresh token! " + String(err?.message))
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

export function chumsStartupLoad(scope: ChumsScopes = "plans") {
  if (!stores.ACCESS.get(`chums_${scope}`)) return
  sendSongsToChums()
  chumsLoadServices()
}

function loadShowData(showName: string) {
  const showsPath = getDocumentsFolder();
  const showPath: string = path.join(showsPath, `${showName}.show`)
  const jsonData = readFile(showPath) || "{}"
  const show = parseShow(jsonData)
  return show;

}

async function sendSongsToChums() {
  const songData = getChumsSongData();
  const batchSize = 10;
  //send the data in batches
  for (let i = 0; i < songData.length; i += batchSize) {
    const batch = songData.slice(i, i + batchSize);
    console.log("Sending batch", batch);
    await apiRequest({ api: "content", authenticated: true, scope: "plans", endpoint: "/songs/import", method: "POST", data: batch })
  }
  sendToMain(ToMain.TOAST, "Synced song library to Chums")
}

function getChumsSongData() {
  const songList: any = [];
  const shows = stores.SHOWS.store as { [key: string]: any }
  Object.keys(shows).forEach((key: string) => {
    const show = shows[key];
    if (show.category === "song") {
      //console.log("Show", show);
      const showData = loadShowData(show.name);
      if (showData) {
        songList.push({
          freeShowId: key,
          title: showData[1].meta?.title || showData[1].name || "",
          artist: showData[1].meta?.artist || "",
          lyrics: "",
          ccliNumber: showData[1].meta?.CCLI || ""
        })

        //Add lyrics
        Object.keys(showData[1].slides).forEach((slideKey: string) => {
          const slide = showData[1].slides?.[slideKey];
          slide.items.forEach((item: any) => {
            item.lines.forEach((line: any) => {
              songList[songList.length - 1].lyrics += line.text?.[0]?.value + "\n" || "";
            });
          });
          songList[songList.length - 1].lyrics += "\n";
        });
        songList[songList.length - 1].lyrics = songList[songList.length - 1].lyrics.replaceAll("\n\n", "\n");

      }
    }
  });
  //console.log("Song List", songList);
  return songList
}
