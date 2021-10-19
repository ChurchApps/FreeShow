"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Channels_1 = require("./../types/Channels");
const path_1 = require("path");
const REMOTE_PORT = 5510;
const STAGE_PORT = 5511;
const express_1 = __importDefault(require("express"));
const remoteExpressApp = (0, express_1.default)();
const stageExpressApp = (0, express_1.default)();
const http_1 = __importDefault(require("http"));
const remoteServer = http_1.default.createServer(remoteExpressApp);
const stageServer = http_1.default.createServer(stageExpressApp);
const socket_io_1 = require("socket.io");
const electron_1 = require("electron");
const index_1 = require("./index");
// import { BrowserWindow } from 'electron')
const ioRemote = new socket_io_1.Server(remoteServer);
const ioStage = new socket_io_1.Server(stageServer);
remoteExpressApp.get("/", (_req, res) => {
    // console.log(join(__dirname, "..", "public", "build", "remote.html"))
    // console.log(join(__dirname, "..", "public", "remote.html"))
    // console.log(join(__dirname, "public", "remote.html"))
    // console.log(join(__dirname, "remote.html"))
    // res.sendFile(join(__dirname, "..", "public", "build", "remote.html"))
    res.sendFile((0, path_1.join)(__dirname, "/remote/index.html"));
    // res.sendFile(__dirname + "/server/remote/remote.html")
    // res.sendFile(__dirname + "/server/remote/client.js")
    // res.sendFile(__dirname + "/server/remote/styles.css")
    // res.sendFile(__dirname + '/main.js');
    // res.sendFile('../src/App.svelte');
});
// remoteExpressApp.use(__dirname + "/remote")
remoteExpressApp.use(express_1.default.static(__dirname + "/remote"));
remoteServer.listen(REMOTE_PORT, () => {
    console.log("Remote on *:" + REMOTE_PORT);
    // console.log(remoteServer.listeners)
});
stageExpressApp.get("/", (_req, res) => {
    res.sendFile((0, path_1.join)(__dirname, "/stage/index.html"));
});
stageExpressApp.use(express_1.default.static(__dirname + "/stage"));
stageServer.listen(STAGE_PORT, () => {
    console.log("Stage on *:" + STAGE_PORT);
});
// REMOTE
var connections = {};
const maxConnections = 10; // get
const password = "show"; // get
ioRemote.on("connection", (socket) => {
    // console.log(socket);
    let id = socket.id;
    let platform = socket.handshake.headers["user-agent"];
    let connected = false;
    const broadcast = (msg) => {
        console.log(msg);
        (0, index_1.toApp)(Channels_1.REMOTE, { id, data: msg });
    };
    broadcast("Client connected! Platform: " + getOS(platform) + ". [" + id + "]");
    // let clients = await ioRemote.sockets.allSockets();
    // console.log(clients);
    // ioRemote.sockets.socket.forEach(socket, s => console.log(s.id));
    if (Object.keys(connections).length > maxConnections) {
        ioRemote.emit("error", { id: "maxConn", text: "Cannot connect! There are more than " + maxConnections + " devices connected!" });
        socket.disconnect();
    }
    else {
        ioRemote.emit("connected");
        socket.on("name", (name) => (connections[id].name = name));
        socket.on("password", (data) => {
            // https://stackoverflow.com/questions/18279141/javascript-string-encryption-and-decryption
            // if (CryptoJS.AES.decrypt(data, id) === password) { // TODO: encryption
            if (data === password) {
                // correct password
                // REQUEST DATA
                connected = true;
                (0, index_1.toApp)(Channels_1.REMOTE, { id, action: "request" }); // request, update, change
            }
            else
                ioRemote.emit("error", { id: "wrongPass", text: "Wrong password" });
        });
        socket.on("getShow", (data) => {
            // if (connected) toApp('lan', {action: 'setShow', projectID: data.projectID, id: data.id, type: null});
            if (connected)
                (0, index_1.toApp)(Channels_1.REMOTE, { action: "getShow", id: data.socket, data: { id: data.id, type: data.type } });
        });
        // SEND DATA FROM APP TO CLIENT
        electron_1.ipcMain.on(Channels_1.REMOTE, (_e, data) => {
            if (data.id === id)
                ioRemote.to(data.id).emit(data.channel, data.data);
        });
        // main
        // socket.on('currentShow', show => {
        // if (connected)
        // })
    }
    socket.on("disconnect", () => {
        broadcast("Device " + id + " disconnected");
        delete connections[id];
    });
});
function getOS(ua) {
    // https://stackoverflow.com/a/59706252
    let os = "Unknown";
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
    };
    Object.keys(device).map((v) => ua.match(device[v]) && (os = v));
    return os;
}
// STAGE
var stageConnections = {};
const maxStageConnections = 10; // get
ioStage.on("connection", (socket) => {
    let id = socket.id;
    // let platform: string = socket.handshake.headers["user-agent"]!
    // let connected: boolean = false
    // toApp(STAGE, "Stage: +1 (" + stageConnections + ")")
    // // request stage
    // toApp(STAGE, "REQUEST")
    if (Object.keys(connections).length > maxStageConnections) {
        ioRemote.emit("error", { id: "maxConn", text: "Cannot connect! There are more than " + maxStageConnections + " devices connected!" });
        socket.disconnect();
    }
    else {
        // ioRemote.emit("connected")
        // socket.on("name", (name) => (connections[id].name = name))
        socket.on("password", (data) => {
            // https://stackoverflow.com/questions/18279141/javascript-string-encryption-and-decryption
            // if (CryptoJS.AES.decrypt(data, id) === password) { // TODO: encryption
            if (data === password) {
                // if has password.....
                // correct password
                // REQUEST DATA
                // connected = true
                (0, index_1.toApp)(Channels_1.STAGE, { id, action: "request" });
            }
            else
                ioRemote.emit("error", { id: "wrongPass", text: "Wrong password" });
        });
        // socket.on("getShow", (data) => {
        //   // if (connected) toApp('lan', {action: 'setShow', projectID: data.projectID, id: data.id, type: null});
        //   if (connected) toApp(STAGE, { action: "getShow", id: data.socket, data: { id: data.id, type: data.type } })
        // })
        // SEND DATA FROM APP TO CLIENT
        electron_1.ipcMain.on(Channels_1.STAGE, (_e, data) => {
            if (data.id === id)
                ioRemote.to(data.id).emit(data.channel, data.data);
        });
    }
    socket.on("disconnect", () => {
        (0, index_1.toApp)(Channels_1.STAGE, { connection: stageConnections[id] });
        // broadcast("Device " + id + " disconnected")
        delete connections[id];
    });
});
// SEND DATA FROM APP TO CLIENT
electron_1.ipcMain.on(Channels_1.STAGE, (_e, data) => {
    console.log("Stage data: " + data);
    ioStage.emit(Channels_1.STAGE, data);
});
///////////////////////////////////////////////////////////
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
//# sourceMappingURL=servers.js.map