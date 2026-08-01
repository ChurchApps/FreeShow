// ----- FreeShow -----
// HTTP routes for the headless server: serves the web build (SPA), a few JSON/utility
// endpoints, and the media virtual-filesystem gateway (see mediaRoutes.ts).

import type { Express, Request, Response } from "express"
import express from "express"
import path from "path"
import { doesPathExist } from "../../shared/data/fsCore"
import { HEADLESS_CAPABILITIES } from "../../shared/platform/capabilities"
import { registerMediaRoutes } from "./mediaRoutes"
import { registerThumbnailRoutes } from "./thumbnailRoutes"

export function getWebDir(): string {
    if (process.env.FREESHOW_WEB_DIR) return process.env.FREESHOW_WEB_DIR
    // default: build/web relative to where the server is started (repo root for `npm run start:server`)
    return path.join(process.cwd(), "build", "web")
}

function getPublicDir(): string {
    return process.env.FREESHOW_PUBLIC_DIR || path.join(process.cwd(), "public")
}

export function registerHttpRoutes(app: Express) {
    const webDir = getWebDir()

    // allow remote (cross-origin) clients to read JSON/media endpoints; token still gates protected routes
    app.use((_req: Request, res: Response, next) => {
        res.header("Access-Control-Allow-Origin", "*")
        res.header("Access-Control-Allow-Headers", "x-freeshow-token, content-type")
        next()
    })

    app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }))
    app.get("/capabilities", (_req: Request, res: Response) => res.json(HEADLESS_CAPABILITIES))

    // media virtual-fs gateway + thumbnails (must be before the SPA fallback below)
    registerMediaRoutes(app)
    registerThumbnailRoutes(app)

    if (doesPathExist(webDir)) {
        // built web bundle takes priority (its index.html + hashed /assets/*)
        app.use(express.static(webDir))

        // repo public dir only fills gaps (runtime assets not bundled into build/web);
        // it must NOT shadow the built index.html, so it comes AFTER webDir.
        const publicDir = getPublicDir()
        if (doesPathExist(publicDir)) app.use(express.static(publicDir, { index: false }))

        // SPA fallback -> built index.html
        app.get("*", (_req: Request, res: Response) => res.sendFile(path.join(webDir, "index.html")))
    } else {
        console.warn(`Web build not found at ${webDir}. Run "npm run build:web" first.`)
        app.get("/", (_req: Request, res: Response) => res.status(503).send("FreeShow web build not found. Run: npm run build:web"))
    }
}
