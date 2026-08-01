// ----- FreeShow -----
// Simple token auth for the headless server. If a token is configured (CLI
// --token or env FREESHOW_TOKEN), both the Socket.IO handshake and the HTTP
// file routes must present it. If no token is configured, access is open (LAN
// dev). A production deployment should always set a token behind TLS.

import type { NextFunction, Request, Response } from "express"
import type { Socket } from "socket.io"

let authToken = ""

export function setAuthToken(token: string) {
    authToken = token || ""
}

export function isAuthConfigured(): boolean {
    return !!authToken
}

/** Socket.IO middleware: reject connections without the correct token. */
export function socketAuth(socket: Socket, next: (err?: Error) => void) {
    if (!authToken) return next()
    const provided = (socket.handshake.auth as { token?: string })?.token || socket.handshake.headers["x-freeshow-token"]
    if (provided === authToken) return next()
    next(new Error("unauthorized"))
}

/** Express middleware for HTTP file routes (media/thumbnails). */
export function httpAuth(req: Request, res: Response, next: NextFunction) {
    if (!authToken) return next()
    const provided = (req.query.token as string) || req.headers["x-freeshow-token"]
    if (provided === authToken) return next()
    res.status(401).send("unauthorized")
}
