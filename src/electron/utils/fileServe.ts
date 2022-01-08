// not in use

import path from "path"
import http from "http"
import express from "express"
import cors from "cors"

// let folderPath: string
// ipcMain.on("SERVE_PATH", (_e, path: string) => (folderPath = path))

const expressApp = express()
const router = express.Router()
expressApp.use(cors())

// router.get("/file/:name", (req, res) => {
//   let name = folderPath + path.sep + req.params.name
//   console.log("Serving file:", name)
//   res.sendFile(name)
// })

export const fileServe = (folderPath: string) => {
  router.get("/file/:name", (req, res) => {
    let name = folderPath + path.sep + req.params.name
    console.log("Serving file:", name)
    res.sendFile(name)
  })
}

expressApp.use("/", router)
http.createServer(expressApp).listen(5005)
console.log("Started file serve at: 5005")
