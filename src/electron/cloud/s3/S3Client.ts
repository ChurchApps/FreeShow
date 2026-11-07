// ----- FreeShow -----
// Minimal client for S3 compatible object storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO, Wasabi, ...).
// Only the few calls needed for cloud sync are implemented, so no SDK dependency is needed.

import { S3Error } from "./S3Error"
import { EMPTY_PAYLOAD_HASH, encodePath, sha256Hex, signRequest } from "./sigv4"

export { S3Error }

export interface S3Config {
    // e.g. https://<account>.r2.cloudflarestorage.com or http://localhost:9000 (empty for AWS)
    endpoint?: string
    region: string
    bucket: string
    // folder inside the bucket, so multiple setups can share one bucket
    prefix?: string
    accessKeyId: string
    secretAccessKey: string
    // https://endpoint/bucket/key instead of https://bucket.endpoint/key
    pathStyle?: boolean
}

export interface S3ObjectInfo {
    etag: string
    lastModified: number
    size: number
}

const DEFAULT_TIMEOUT = 2 * 60 * 1000

export function normalizeS3Config(config: S3Config): S3Config {
    const endpoint = (config.endpoint || "").trim().replace(/\/+$/, "")
    return {
        endpoint: endpoint && !/^https?:\/\//i.test(endpoint) ? "https://" + endpoint : endpoint,
        region: (config.region || "").trim() || "us-east-1",
        bucket: (config.bucket || "").trim(),
        prefix: (config.prefix || "").trim().replace(/^\/+|\/+$/g, ""),
        accessKeyId: (config.accessKeyId || "").trim(),
        secretAccessKey: (config.secretAccessKey || "").trim(),
        // custom endpoints are most compatible with path style, AWS prefers virtual hosted style
        pathStyle: config.pathStyle ?? !!endpoint
    }
}

export class S3Client {
    config: S3Config

    constructor(config: S3Config) {
        this.config = normalizeS3Config(config)
    }

    getKey(name: string) {
        return this.config.prefix ? `${this.config.prefix}/${name}` : name
    }

    getUrl(key = "", query: { [key: string]: string } = {}) {
        const { endpoint, region, bucket, pathStyle } = this.config
        const base = new URL(endpoint || `https://s3.${region}.amazonaws.com`)

        const encodedKey = key ? encodePath(key) : ""
        if (pathStyle) {
            base.pathname = `/${encodePath(bucket)}/${encodedKey}`
        } else {
            base.hostname = `${bucket}.${base.hostname}`
            base.pathname = `/${encodedKey}`
        }

        Object.entries(query).forEach(([k, v]) => base.searchParams.set(k, v))
        return base
    }

    private async request(method: string, url: URL, { body, headers, timeout }: { body?: Buffer; headers?: { [key: string]: string }; timeout?: number } = {}) {
        const payloadHash = body ? sha256Hex(body) : EMPTY_PAYLOAD_HASH
        const signedHeaders = signRequest({ method, url, headers, payloadHash }, this.config)

        const response = await fetch(url, {
            method,
            headers: signedHeaders,
            body: body ? new Uint8Array(body) : undefined,
            signal: AbortSignal.timeout(timeout || DEFAULT_TIMEOUT)
        })

        if (!response.ok) {
            const text = method === "HEAD" ? "" : await response.text().catch(() => "")
            const code = text.match(/<Code>([^<]+)<\/Code>/)?.[1] || response.statusText || "Error"
            const message = text.match(/<Message>([^<]+)<\/Message>/)?.[1] || `${method} ${url.pathname} failed (${response.status})`
            throw new S3Error(response.status, code, message)
        }

        return response
    }

    // check that the bucket exists and the credentials can list it
    async testConnection(): Promise<{ success: true } | { success: false; error: string }> {
        if (!this.config.bucket) return { success: false, error: "Missing bucket name" }
        if (!this.config.accessKeyId || !this.config.secretAccessKey) return { success: false, error: "Missing access key" }

        try {
            const query: { [key: string]: string } = { "list-type": "2", "max-keys": "1" }
            if (this.config.prefix) query.prefix = this.config.prefix + "/"
            await this.request("GET", this.getUrl("", query), { timeout: 20000 })
            return { success: true }
        } catch (err) {
            return { success: false, error: getErrorMessage(err) }
        }
    }

    // null if the object does not exist
    async headObject(key: string): Promise<S3ObjectInfo | null> {
        try {
            const response = await this.request("HEAD", this.getUrl(key), { timeout: 20000 })
            return getObjectInfo(response)
        } catch (err) {
            if (err instanceof S3Error && err.statusCode === 404) return null
            throw err
        }
    }

    // null if the object does not exist
    async getObject(key: string): Promise<{ data: Buffer; info: S3ObjectInfo } | null> {
        try {
            const response = await this.request("GET", this.getUrl(key))
            const data = Buffer.from(await response.arrayBuffer())
            return { data, info: getObjectInfo(response) }
        } catch (err) {
            if (err instanceof S3Error && err.statusCode === 404) return null
            throw err
        }
    }

    // returns the ETag of the stored object
    async putObject(key: string, body: Buffer, contentType = "application/octet-stream"): Promise<string> {
        const response = await this.request("PUT", this.getUrl(key), { body, headers: { "content-type": contentType } })
        return cleanEtag(response.headers.get("etag"))
    }
}

function cleanEtag(etag: string | null) {
    return (etag || "").replace(/"/g, "")
}

function getObjectInfo(response: Response): S3ObjectInfo {
    const lastModified = response.headers.get("last-modified")
    return {
        etag: cleanEtag(response.headers.get("etag")),
        lastModified: lastModified ? new Date(lastModified).getTime() : 0,
        size: Number(response.headers.get("content-length") || 0)
    }
}

// error text partly comes from the storage server, and alerts are rendered as HTML
export function getErrorMessage(err: any): string {
    return escapeHtml(describeError(err))
}

function escapeHtml(text: string) {
    return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}

function describeError(err: any): string {
    if (err instanceof S3Error) {
        if (err.statusCode === 403) return `Access denied (${err.code}). Check the access key and its permissions.`
        if (err.statusCode === 404) return `Bucket not found (${err.code}). Check the bucket name, region and endpoint.`
        if (err.statusCode === 301 || err.code === "PermanentRedirect" || err.code === "AuthorizationHeaderMalformed") return `Wrong region or endpoint (${err.code}): ${err.message}`
        return `${err.code}: ${err.message}`
    }

    if (err?.name === "TimeoutError" || err?.name === "AbortError") return "The storage server did not respond in time."
    const cause = err?.cause?.code || err?.code
    if (cause === "ENOTFOUND" || cause === "EAI_AGAIN") return "Could not reach the storage server. Check the endpoint and your internet connection."
    if (cause === "ECONNREFUSED") return "The storage server refused the connection. Check the endpoint."
    return err?.message || String(err)
}

export function isOfflineError(err: any) {
    const cause = err?.cause?.code || err?.code
    return cause === "ENOTFOUND" || cause === "EAI_AGAIN" || cause === "ENETUNREACH"
}
