import express from "express"
import fs from "fs"
import type { AddressInfo } from "net"
import type { Server } from "http"
import os from "os"
import path from "path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { setAuthToken } from "./auth"
import { setDataRoot } from "./data/dataPaths"
import { registerMediaRoutes } from "./mediaRoutes"

let server: Server
let base = ""
let tmpDir = ""
let outsidePng = ""

const url = (p: string, token?: string) => `${base}/media?path=${encodeURIComponent(p)}${token ? `&token=${token}` : ""}`

beforeAll(async () => {
    setAuthToken("")
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fs-media-"))
    setDataRoot(tmpDir) // sandbox root
    fs.writeFileSync(path.join(tmpDir, "pic.png"), "HELLO_PNG_BYTES_0123456789")
    fs.writeFileSync(path.join(tmpDir, "notes.txt"), "secret")
    // a media file OUTSIDE the sandbox (in the parent temp dir) to prove confinement
    outsidePng = path.join(os.tmpdir(), `fs-outside-${process.pid}.png`)
    fs.writeFileSync(outsidePng, "OUTSIDE")

    const app = express()
    registerMediaRoutes(app)
    await new Promise<void>((resolve) => {
        server = app.listen(0, resolve)
    })
    base = `http://localhost:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
    server?.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
    fs.rmSync(outsidePng, { force: true })
})

describe("media gateway /media", () => {
    it("streams a sandbox-relative media file", async () => {
        const res = await fetch(url("pic.png"))
        expect(res.status).toBe(200)
        expect(res.headers.get("content-type")).toBe("image/png")
        expect(await res.text()).toBe("HELLO_PNG_BYTES_0123456789")
    })

    it("also accepts an absolute path INSIDE the sandbox", async () => {
        const res = await fetch(url(path.join(tmpDir, "pic.png")))
        expect(res.status).toBe(200)
    })

    it("supports HTTP range requests", async () => {
        const res = await fetch(url("pic.png"), { headers: { Range: "bytes=0-4" } })
        expect(res.status).toBe(206)
        expect(res.headers.get("content-range")).toBe("bytes 0-4/26")
        expect(await res.text()).toBe("HELLO")
    })

    it("rejects non-media extensions with 415", async () => {
        expect((await fetch(url("notes.txt"))).status).toBe(415)
    })

    it("returns 404 for a missing file", async () => {
        expect((await fetch(url("nope.png"))).status).toBe(404)
    })

    it("blocks ../ traversal out of the sandbox (403)", async () => {
        expect((await fetch(url("../../etc/hosts.png"))).status).toBe(403)
    })

    it("blocks an absolute path OUTSIDE the sandbox (403), even if it exists", async () => {
        expect((await fetch(url(outsidePng))).status).toBe(403)
    })
})

describe("media upload /media/upload", () => {
    const upload = (query: string, body: string) => fetch(`${base}/media/upload?${query}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body })

    it("writes an uploaded media file into the sandbox folder", async () => {
        const res = await upload("path=&name=uploaded.png", "DATA")
        expect(res.status).toBe(200)
        expect(await res.json()).toMatchObject({ name: "uploaded.png" })
        expect(fs.readFileSync(path.join(tmpDir, "uploaded.png"), "utf8")).toBe("DATA")
    })

    it("rejects non-media extensions (415)", async () => {
        expect((await upload("path=&name=bad.txt", "x")).status).toBe(415)
    })

    it("rejects folders outside the sandbox (403)", async () => {
        expect((await upload("path=../../escape&name=evil.png", "x")).status).toBe(403)
    })

    it("strips directory components from the file name (no traversal)", async () => {
        const res = await upload("path=&name=" + encodeURIComponent("../../evil.png"), "x")
        expect(res.status).toBe(200)
        expect(fs.existsSync(path.join(tmpDir, "evil.png"))).toBe(true)
        expect(fs.existsSync(path.join(tmpDir, "..", "..", "evil.png"))).toBe(false)
    })
})

describe("media gateway auth", () => {
    it("requires the token when one is configured", async () => {
        setAuthToken("secret")
        expect((await fetch(url("pic.png"))).status).toBe(401)
        expect((await fetch(url("pic.png", "wrong"))).status).toBe(401)
        expect((await fetch(url("pic.png", "secret"))).status).toBe(200)
        setAuthToken("")
    })
})
