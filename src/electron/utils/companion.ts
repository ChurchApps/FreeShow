import express from "express"
import { toApp } from ".."
import { MAIN } from "../../types/Channels"

const app = express()
let server: any
const DEFAULT_PORT = 5505

export function startCompanionListener(PORT: number | undefined) {
    if (!PORT) PORT = DEFAULT_PORT
    server = app.listen(PORT, () => {
        console.log(`Listening for Companion at http://localhost:${PORT}`)
    })
    server.once("error", (err: any) => {
        if (err.code === "EADDRINUSE") console.log(`Could not start server. Port ${PORT} in use!`)
    })

    app.use(express.json())
    app.post("/", (req) => {
        let data = req.body
        toApp(MAIN, { channel: "COMPANION_TRIGGER", data })
    })
}

export function stopCompanionListener() {
    if (!server) return

    console.log("Stopping Companion listener")
    server.close()
}
