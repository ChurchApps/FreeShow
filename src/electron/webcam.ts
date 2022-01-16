import { toApp } from "./index"
import { join } from "path"
import express from "express"
import http from "http"
import { Server } from "socket.io"
import { getOS } from "./servers"

var WEBCAM_PORT: number = 5512

const app = express()
const server = http.createServer(app)
const io = new Server(server)

// app.get("/", (_req: any, res: any) => {
//   res.status(200).send("Hello World")
// })
app.get("/", (_req: any, res: any) => res.sendFile(join(__dirname, "/webcam/index.html")))
app.use(express.static(__dirname + "/webcam"))
server.listen(WEBCAM_PORT, () => console.log("Webcam on *:" + WEBCAM_PORT))
server.once("error", (err: any) => {
  if (err.code === "EADDRINUSE") server.close()
})

io.on("connection", (socket: any) => {
  // if (Object.keys(connections.REMOTE).length > REMOTE_MAX) {
  //   io.emit(REMOTE, { channel: "ERROR", id: "overLimit", data: REMOTE_MAX })
  //   socket.disconnect()
  // } else {
  // initialize(REMOTE, socket)
  let name: string = getOS(socket.handshake.headers["user-agent"] || "")
  toApp("WEBCAM", { channel: "CONNECTION", id: socket.id, data: { name } })
  // }

  socket.on("WEBCAM", (msg: any) => toApp("WEBCAM", { id: socket.id, name, ...msg }))
})

//

// // import { Server } from "socket.io"
// import express from "express"
// // import http from "http"

// const port = 5012
// const socketPort = 5013

// const webcamExpressApp = express()
// // const remoteWebcam = http.createServer(webcamExpressApp)
// // const ioWebcam = new Server(remoteWebcam)

// const ProxyServer= 'http://localhost:'+ port;
// /**
//  * WebSocket Configuration
//  */
//  const io = require('socket.io')(socketPort, {
//   handlePreflightRequest: (req: any, res: any) => {
//       const headers = {
//           "Access-Control-Allow-Headers": "Content-Type, Authorization",
//           "Access-Control-Allow-Origin": req.headers.origin,
//           "Access-Control-Allow-Credentials": true
//       };
//       res.writeHead(200, headers);
//       res.end();
//   },
//   path: '/',
//   serveClient: true,
//   origins: '*:*',
//   pingInterval: 1000,
//   pingTimeout: 1000,
//   upgradeTimeout: 1000,
//   allowUpgrades: true
// });

// io.on('connection',function(socket: any){
//   socket.on('stream',function(data: any){
//       socket.broadcast.emit('stream',data);
//   });
// });

// io.of('/stream').clients((error: any, clients: any) => {
// if (error) throw error;
//   console.log(clients);
// });

// /**
// * Run Proxy Server
// */
// webcamExpressApp.all("/*", function(req: any, res: any) {
//   Proxy.web(req, res, {target: ProxyServer});
// });

// webcamExpressApp.listen(port, () => console.log(`\x1b[40m`,`\x1b[32m`,
// ` [+] Server         : http://localhost:${port}
//   [+] Socket         : ws://localhost:${socketPort}
//   [~] Running Server...
// `,`\x1b[0m`));
