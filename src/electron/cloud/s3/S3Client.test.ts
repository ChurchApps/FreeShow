import { afterEach, describe, expect, it, vi } from "vitest"
import { getErrorMessage, normalizeS3Config, S3Client, S3Error } from "./S3Client"

const base = { region: "auto", bucket: "freeshow", accessKeyId: "key", secretAccessKey: "secret" }

afterEach(() => {
    vi.unstubAllGlobals()
})

describe("normalizeS3Config", () => {
    it("adds https, trims slashes and defaults to path style for custom endpoints", () => {
        const config = normalizeS3Config({ ...base, endpoint: "abc.r2.cloudflarestorage.com/", prefix: "/church/main/" })
        expect(config.endpoint).toBe("https://abc.r2.cloudflarestorage.com")
        expect(config.prefix).toBe("church/main")
        expect(config.pathStyle).toBe(true)
    })

    it("defaults to AWS virtual hosted style without an endpoint", () => {
        const config = normalizeS3Config({ ...base, region: "" })
        expect(config.region).toBe("us-east-1")
        expect(config.pathStyle).toBe(false)
    })
})

describe("S3Client URLs", () => {
    it("builds path style URLs", () => {
        const client = new S3Client({ ...base, endpoint: "http://localhost:9000", prefix: "team a" })
        expect(client.getUrl(client.getKey("current.zip")).toString()).toBe("http://localhost:9000/freeshow/team%20a/current.zip")
    })

    it("builds virtual hosted AWS URLs", () => {
        const client = new S3Client({ ...base, region: "eu-west-1" })
        expect(client.getUrl("current.zip").toString()).toBe("https://freeshow.s3.eu-west-1.amazonaws.com/current.zip")
    })
})

describe("S3Client requests", () => {
    it("returns null for a missing object", async () => {
        const fetchMock = vi.fn(async () => new Response(null, { status: 404 }))
        vi.stubGlobal("fetch", fetchMock)

        const client = new S3Client({ ...base, endpoint: "http://localhost:9000" })
        expect(await client.headObject("current.zip")).toBeNull()
        expect(fetchMock).toHaveBeenCalledOnce()
    })

    it("uploads with a signed payload hash and returns the ETag", async () => {
        const fetchMock = vi.fn(async (_url: URL, _init: RequestInit) => new Response(null, { status: 200, headers: { ETag: '"abc123"' } }))
        vi.stubGlobal("fetch", fetchMock)

        const client = new S3Client({ ...base, endpoint: "http://localhost:9000" })
        const etag = await client.putObject("current.zip", Buffer.from("data"), "application/zip")

        expect(etag).toBe("abc123")
        const init = fetchMock.mock.calls[0][1]
        const headers = init.headers as { [key: string]: string }
        expect(init.method).toBe("PUT")
        expect(headers["x-amz-content-sha256"]).toBe("3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7")
        expect(headers.authorization).toContain("SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date")
    })

    it("reports S3 error codes when testing the connection", async () => {
        const body = "<Error><Code>InvalidAccessKeyId</Code><Message>The key does not exist.</Message></Error>"
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(body, { status: 403 }))
        )

        const result = await new S3Client({ ...base, endpoint: "http://localhost:9000" }).testConnection()
        expect(result).toEqual({ success: false, error: "Access denied (InvalidAccessKeyId). Check the access key and its permissions." })
    })

    it("gives a readable message for unreachable endpoints", () => {
        const err = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } })
        expect(getErrorMessage(err)).toContain("Could not reach the storage server")
        expect(getErrorMessage(new S3Error(500, "InternalError", "Oops"))).toBe("InternalError: Oops")
    })
})
