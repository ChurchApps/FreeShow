// const http = require('http');

// // Create an instance of the http server to handle HTTP requests
// let httpServer = http.createServer((req, res) => {
//     // Set a response type of plain text for the response
//     res.writeHead(200, {'Content-Type': 'text/plain'});

//     // Send back a response and end the connection
//     res.end('Hello World!\n');
// });

// // Start the server on port 3000
// httpServer.listen(3000, '127.0.0.1');
// httpServer.listen(3000, '192.168.10.104');
// httpServer.listen(8080, '192.168.10.104');
// console.log('Node server running on port 3000');

// const net = require('net');

// const netServer = net.createServer((socket) => {
//   socket.end('goodbye\n');
// }).on('error', (err) => {
//   // Handle errors here.
//   throw err;
// });

// // Grab an arbitrary unused port.
// netServer.listen(() => {
//   console.log('opened server on', netServer.address());
// });

const REMOTE_PORT = 5510
const STAGE_PORT = 5511

const express = require("express")
const remoteExpressApp = express()
const stageExpressApp = express()
const http = require("http")
const remoteServer = http.createServer(remoteExpressApp)
const stageServer = http.createServer(stageExpressApp)
const { Server } = require("socket.io")
const { ipcMain } = require("electron")
const { toApp } = require("..")
// const { BrowserWindow } = require('electron');
const ioRemote = new Server(remoteServer)
const ioStage = new Server(stageServer)

remoteExpressApp.get("/", (req, res) => {
  res.sendFile(__dirname + "/remote.html")
  // res.sendFile(__dirname + '/main.js');
  // res.sendFile('../src/App.svelte');
})

remoteServer.listen(REMOTE_PORT, () => {
  console.log("Remote on *:" + REMOTE_PORT)
})

stageExpressApp.get("/", (req, res) => {
  res.sendFile(__dirname + "/stage.html")
})
stageServer.listen(STAGE_PORT, () => {
  console.log("Stage on *:" + STAGE_PORT)
})

// REMOTE

var connections = {}
const maxConnections = 10 // get
const password = "show" // get

ioRemote.on("connection", (socket) => {
  // console.log(socket);
  let id = socket.id
  let platform = socket.handshake.headers["user-agent"]
  let connected = false

  const broadcast = (msg) => {
    console.log(msg)
    toApp("lan", { id, data: msg })
  }

  broadcast("Client connected! Platform: " + getOS(platform) + ". [" + id + "]")
  // let clients = await ioRemote.sockets.allSockets();
  // console.log(clients);
  // ioRemote.sockets.socket.forEach(socket, s => console.log(s.id));
  if (Object.keys(connections).length > maxConnections) {
    ioRemote.emit("error", { id: "maxConn", text: "Cannot connect! There are more than " + maxConnections + " devices connected!" })
    socket.disconnect()
  } else {
    ioRemote.emit("connected")
    socket.on("name", (name) => (connections[id].name = name))

    socket.on("password", (data) => {
      // https://stackoverflow.com/questions/18279141/javascript-string-encryption-and-decryption
      // if (CryptoJS.AES.decrypt(data, id) === password) { // TODO: encryption
      if (data === password) {
        // correct password

        // REQUEST DATA
        connected = true
        toApp("lan", { id, action: "request" }) // request, update, change
      } else ioRemote.emit("error", { id: "wrongPass", text: "Wrong password" })
    })

    socket.on("getShow", (data) => {
      // if (connected) toApp('lan', {action: 'setShow', projectID: data.projectID, id: data.id, type: null});
      if (connected) toApp("lan", { action: "getShow", id: data.socket, data: { id: data.id, type: data.type } })
    })

    // SEND DATA FROM APP TO CLIENT
    ipcMain.on("lan", (e, data) => {
      if (data.id === id) ioRemote.to(data.id).emit(data.channel, data.data)
    })

    // main
    // socket.on('currentShow', show => {
    // if (connected)
    // })
  }

  socket.on("disconnect", () => {
    broadcast("Device " + id + " disconnected")
    delete connections[id]
  })
})

function getOS(ua) {
  // https://stackoverflow.com/a/59706252
  let os = "Unknown"
  const device = {
    "Generic Linux": /Linux/i,
    Android: /Android/i,
    BlackBerry: /BlackBerry/i,
    Bluebird: /EF500/i,
    "Chrome OS": /CrOS/i,
    Datalogic: /DL-AXIS/i,
    Honeywell: /CT50/i,
    iPad: /iPad/i,
    iPhone: /iPhone/i,
    iPod: /iPod/i,
    macOS: /Macintosh/i,
    Windows: /IEMobile|Windows/i,
    Zebra: /TC70|TC55/i,
  }
  Object.keys(device).map((v) => ua.match(device[v]) && (os = v))
  return os
}

// STAGE
let stageConnections = 0
ioStage.on("connection", (socket) => {
  stageConnections++
  toApp("LAN", "Stage: +1 (" + stageConnections + ")")
  // request stage
  toApp("STAGE", "request")

  socket.on("disconnect", () => {
    stageConnections--
    toApp("LAN", "Stage: -1 (" + stageConnections + ")")
  })
})

// SEND DATA FROM APP TO CLIENT
ipcMain.on("STAGE", (e, data) => {
  console.log("Stage data: " + data)
  ioStage.emit("STAGE", data)
})

// https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.xhtml?&page=94

// var net = require('net');
// var netServer = net.createServer(function(socket) {
//     // confirm socket connection from client
//     console.log((new Date())+'A client connected to server...');
//     socket.on('data', function(data) {
//             var string = (data.toString());
//             console.log(string)
//     });
//     // send info to client
//     socket.write('Echo from server: NODE.JS Server \r\n');
//     socket.pipe(socket);
//     // res.writeHead(200, {'Content-Type': 'text/plain'});
//     // res.end('Hello World!\n');
//     // socket.setEncoding('utf8');

//     socket.end();
//     console.log('The client has disconnected...\n');
// }).listen(port, () => {
//   console.log('Opened server on', netServer.address());
// });

// FREE = 6 18 5 5: 61855
// 5510

// CLIENT
// var client = new net.Socket();
// client.connect(port, function() { // port, '192.168.10.104', () =>
// console.log('Connected');  // acknowledge socket connection
// client.write('Hello, server! Love, Client.'); // send info to Server
// });

// client.on('data', function(data) {
// console.log('Received: ' + data); // display info received from server
// client.destroy(); // kill client after server's response
// });

// client.on('close', function() {
// console.log('Connection closed');
// });
