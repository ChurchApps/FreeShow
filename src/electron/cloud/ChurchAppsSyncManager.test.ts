import crypto from "crypto"
import fs from "fs"
import path from "path"
import { afterAll, describe, expect, it, vi } from "vitest"
import { getChurchAppsSyncManager } from "./ChurchAppsSyncManager"

const h = vi.hoisted(() => {
    const path = require("path")
    return { tempRoot: path.join(__dirname, "../../../tmp_test_churchapps_sync"), cloudContent: "", cloudLastModified: "", requests: [] as string[] }
})

vi.mock("electron", () => ({ app: { getPath: () => h.tempRoot } }))
vi.mock("../contentProviders", () => ({ ContentProviderRegistry: { getProvider: () => ({}) } }))
vi.mock("../IPC/main", () => ({ sendToMain: vi.fn() }))
vi.mock("../data/contentProviders", () => ({ getContentProviderAccess: () => true }))

// fake S3: HEAD returns the ETag (MD5) of the current cloud content, GET writes it to the output file
vi.mock("../utils/requests", () => ({
    httpsRequest: (_host: string, urlPath: string, method: string, _headers: any, _content: any, callback: any, outputFilePath?: string) => {
        h.requests.push(`${method} ${urlPath.split("?")[0]}`)
        if (!h.cloudContent) return callback({ statusCode: 404 })
        if (method === "HEAD") return callback(null, { etag: `"${crypto.createHash("md5").update(h.cloudContent).digest("hex")}"`, "last-modified": h.cloudLastModified })

        const fs = require("fs")
        fs.mkdirSync(require("path").dirname(outputFilePath), { recursive: true })
        fs.writeFileSync(outputFilePath, h.cloudContent)
        callback(null, outputFilePath)
    }
}))

describe("ChurchAppsSyncManager download cache", () => {
    const manager = getChurchAppsSyncManager()!
    const outputFolder = path.join(h.tempRoot, "extract")
    const getDownloads = () => h.requests.filter((a) => a.startsWith("GET"))

    afterAll(() => {
        fs.rmSync(h.tempRoot, { recursive: true, force: true })
    })

    it("only downloads current.zip when the cloud copy changed", async () => {
        h.cloudContent = "version 1"
        const first = await manager.getData("church", "team", outputFolder)
        expect(fs.readFileSync(first!, "utf8")).toBe("version 1")
        expect(getDownloads().length).toBe(1)

        // unchanged: served from local cache
        const second = await manager.getData("church", "team", outputFolder)
        expect(fs.readFileSync(second!, "utf8")).toBe("version 1")
        expect(getDownloads().length).toBe(1)

        // another device uploaded: downloaded again
        h.cloudContent = "version 2"
        const third = await manager.getData("church", "team", outputFolder)
        expect(fs.readFileSync(third!, "utf8")).toBe("version 2")
        expect(getDownloads().length).toBe(2)
    })

    it("checks the backup date without downloading it", async () => {
        h.requests = []
        h.cloudLastModified = "Wed, 07 Oct 2026 12:00:00 GMT"
        expect(await manager.getBackupModified("church", "team")).toBe(new Date(h.cloudLastModified).getTime())
        expect(getDownloads().length).toBe(0)

        h.cloudContent = ""
        expect(await manager.getBackupModified("church", "team")).toBe(0)
    })
})
