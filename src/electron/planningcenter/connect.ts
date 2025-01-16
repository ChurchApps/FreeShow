import express from "express"
import { postRequestSecure } from "../utils/requests"
import { openURL } from "../utils/responses"
import { stores } from "../data/store"
import { toApp } from ".."
import { MAIN } from "../../types/Channels"

const app = express()
const PCO_PORT = 5501

const apiLink = "https://api.planningcenteronline.com"
const clientId = "4aa9d118669e415d68221da6e83bcd40b877879520afe118b48d5d431eb000fd"
const clientSecret = process.env.PCO_SECRET || "" // confidential
const redirect_uri = "http://localhost:" + PCO_PORT

type PCOScopes = "calendar" | "check_ins" | "giving" | "groups" | "people" | "publishing" | "services"
type PCOAuthData = {
    access_token: string
    token_type: "Bearer"
    expires_in: number
    refresh_token: string
    scope: PCOScopes
    created_at: number
}

let access: PCOAuthData | null = null
export function pcoConnect() {
    if (stores.ACCESS.get("pco")) {
        access = stores.ACCESS.get("pco")
        toApp(MAIN, ["PCO_CONNECT"], { success: true })
    }

    let server = app.listen(PCO_PORT, () => {
        console.log(`Listening for Planning Center OAuth response at port ${PCO_PORT}`)
    })

    server.once("error", (err: any) => {
        if (err.code === "EADDRINUSE") server.close()
    })

    app.use(express.json())

    // WIP host a html page telling the user that it is completed, and can be closed!

    let code = ""
    app.get("/auth/complete", async (req, _res) => {
        if (!code) {
            code = req.query.code?.toString() || ""
            if (!code) return

            console.log("OAuth code received!")

            const params = { grant_type: "authorization_code", code: code, client_id: clientId, client_secret: clientSecret, redirect_uri: "http://localhost:5501/auth/complete" }
            postRequestSecure(apiLink, "/oauth/token", params, (err: any, data: PCOAuthData) => {
                if (err) {
                    toApp(MAIN, ["PCO_CONNECT"], { error: err })
                    return
                }

                // close when request is completed!
                server.close()

                console.log("OAuth completed!")

                stores.ACCESS.set("pco", data)
                access = data
                toApp(MAIN, ["PCO_CONNECT"], { success: true })
            })
            return
        }
    })

    const URL = `${apiLink}/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect_uri}/auth/complete&response_type=code&scope=people`
    openURL(URL)
}

export function pcoRequest() {
    if (!access) return

    // curl -H 'Authorization: Bearer 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' https://api.planningcenteronline.com/people/v2/people
    console.log(access)
}
