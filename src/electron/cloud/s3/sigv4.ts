// ----- FreeShow -----
// AWS Signature Version 4 request signing for S3 compatible storage.
// https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html

import crypto from "crypto"

export const EMPTY_PAYLOAD_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

export interface SigningCredentials {
    accessKeyId: string
    secretAccessKey: string
    region: string
}

export interface SignRequestInput {
    method: string
    url: URL
    // headers to sign (in addition to host, x-amz-date and x-amz-content-sha256)
    headers?: { [key: string]: string }
    payloadHash?: string
    date?: Date
    service?: string
}

export function sha256Hex(data: string | Buffer | Uint8Array) {
    return crypto.createHash("sha256").update(data).digest("hex")
}

function hmac(key: string | Buffer, data: string) {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest()
}

// RFC 3986 encoding as required by SigV4 (encodeURIComponent leaves !'()* unescaped)
export function uriEncode(value: string) {
    return encodeURIComponent(value).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
}

// S3 object keys are encoded per segment, keeping the slashes
export function encodePath(path: string) {
    return path
        .split("/")
        .map((segment) => uriEncode(segment))
        .join("/")
}

function getCanonicalQuery(url: URL) {
    const params: [string, string][] = []
    url.searchParams.forEach((value, key) => params.push([uriEncode(key), uriEncode(value)]))
    params.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1))
    return params.map(([key, value]) => `${key}=${value}`).join("&")
}

function getAmzDate(date: Date) {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, "")
}

// returns the headers to send with the request, including the Authorization header
export function signRequest(input: SignRequestInput, credentials: SigningCredentials): { [key: string]: string } {
    const service = input.service || "s3"
    const payloadHash = input.payloadHash || EMPTY_PAYLOAD_HASH
    const amzDate = getAmzDate(input.date || new Date())
    const dateStamp = amzDate.slice(0, 8)

    const headers: { [key: string]: string } = {}
    Object.entries(input.headers || {}).forEach(([key, value]) => (headers[key.toLowerCase()] = String(value).trim().replace(/\s+/g, " ")))
    headers.host = input.url.host
    headers["x-amz-date"] = amzDate
    headers["x-amz-content-sha256"] = payloadHash

    const sortedKeys = Object.keys(headers).sort()
    const canonicalHeaders = sortedKeys.map((key) => `${key}:${headers[key]}\n`).join("")
    const signedHeaders = sortedKeys.join(";")

    // the URL pathname is already percent-encoded by the caller (see encodePath)
    const canonicalUri = input.url.pathname || "/"
    const canonicalRequest = [input.method.toUpperCase(), canonicalUri, getCanonicalQuery(input.url), canonicalHeaders, signedHeaders, payloadHash].join("\n")

    const scope = `${dateStamp}/${credentials.region}/${service}/aws4_request`
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n")

    const dateKey = hmac("AWS4" + credentials.secretAccessKey, dateStamp)
    const regionKey = hmac(dateKey, credentials.region)
    const serviceKey = hmac(regionKey, service)
    const signingKey = hmac(serviceKey, "aws4_request")
    const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex")

    const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    // host is set by fetch from the URL
    delete headers.host
    return { ...headers, authorization }
}
